import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sanitize } from "@/utils/sanitize";
import { createRateLimiter } from "@/utils/rateLimit";
import { sendLeadNotification } from "@/utils/email";

/**
 * POST /api/production/lead
 *
 * /production 랜딩페이지의 기획 진단 신청 + /checklist 다운로드 리드를 저장합니다.
 * - RLS로 공개 접근이 차단된 leads 테이블에 Service Role로만 기록
 * - 허니팟 필드(website)가 채워져 있으면 저장하지 않고 성공으로 응답 (봇 혼란 방지)
 * - 같은 연락처(전화/이메일)로 10분 내 중복 제출 차단
 * - 저장 후 디스코드 웹훅(LEAD_WEBHOOK_URL) + 관리자 메일(Resend) 알림
 */

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const PHONE_REGEX = /^01[016789]-?\d{3,4}-?\d{4}$/;

interface LeadBody {
  type: "diagnosis" | "checklist";
  name: string;
  profession?: string;
  orgName?: string;
  specialty?: string;
  phone?: string;
  email?: string;
  hasChannel?: boolean | null;
  channelUrl?: string;
  goals?: string[];
  availableTime?: string;
  interestedPackage?: string;
  budgetRange?: string;
  message?: string;
  source?: string;
  utmSource?: string;
  utmCampaign?: string;
  consent?: boolean;
  /** 허니팟 — 사람은 채우지 않는 숨김 필드 */
  website?: string;
}

const PROFESSION_LABEL: Record<string, string> = {
  hospital: "병원",
  legal: "법률",
  other: "기타 전문직",
};

async function notifyDiscord(body: LeadBody) {
  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const lines = [
    body.type === "diagnosis"
      ? "📋 **새 기획 진단 신청**"
      : "📄 **체크리스트 다운로드**",
    `직군: ${PROFESSION_LABEL[body.profession ?? ""] ?? body.profession ?? "-"}`,
    `기관명: ${body.orgName || "-"}`,
    `이름: ${body.name}`,
    `연락처: ${body.phone || "-"} / ${body.email || "-"}`,
  ];
  if (body.type === "diagnosis") {
    lines.push(
      `관심 상품: ${body.interestedPackage || "-"}`,
      `예산: ${body.budgetRange || "-"}`,
      `유입: ${body.source || "-"}${body.utmSource ? ` (utm: ${body.utmSource})` : ""}`
    );
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: lines.join("\n") }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const blocked = rateLimiter(request);
    if (blocked) return blocked;

    const raw = (await request.json()) as LeadBody;

    /* ── 허니팟: 봇이면 저장 없이 성공 응답 ── */
    if (raw.website && raw.website.trim().length > 0) {
      return NextResponse.json({ success: true });
    }

    const type = raw.type === "checklist" ? "checklist" : "diagnosis";
    const name = sanitize(raw.name || "").trim();
    const phone = sanitize(raw.phone || "").trim().replace(/\s/g, "");
    const email = sanitize(raw.email || "").trim();
    const orgName = sanitize(raw.orgName || "").trim();

    /* ── 검증 ── */
    if (!name) {
      return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
    }
    if (!raw.consent) {
      return NextResponse.json(
        { error: "개인정보 수집·이용에 동의해 주세요." },
        { status: 400 }
      );
    }
    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "이메일 형식을 확인해 주세요." },
        { status: 400 }
      );
    }

    if (type === "diagnosis") {
      if (!raw.profession) {
        return NextResponse.json({ error: "직군을 선택해 주세요." }, { status: 400 });
      }
      if (!orgName) {
        return NextResponse.json(
          { error: "병원·사무소 이름을 입력해 주세요." },
          { status: 400 }
        );
      }
      if (!phone || !PHONE_REGEX.test(phone)) {
        return NextResponse.json(
          { error: "휴대폰 번호 형식을 확인해 주세요. (예: 010-1234-5678)" },
          { status: 400 }
        );
      }
      if (raw.hasChannel === null || raw.hasChannel === undefined) {
        return NextResponse.json(
          { error: "유튜브 채널 보유 여부를 선택해 주세요." },
          { status: 400 }
        );
      }
    } else {
      // 체크리스트: 연락처 또는 이메일 중 하나는 필요
      if (!orgName) {
        return NextResponse.json(
          { error: "병원·사무소 이름을 입력해 주세요." },
          { status: 400 }
        );
      }
      if (!phone && !email) {
        return NextResponse.json(
          { error: "연락처 또는 이메일 중 하나는 입력해 주세요." },
          { status: 400 }
        );
      }
      if (phone && !PHONE_REGEX.test(phone)) {
        return NextResponse.json(
          { error: "휴대폰 번호 형식을 확인해 주세요. (예: 010-1234-5678)" },
          { status: 400 }
        );
      }
    }

    /* ── Supabase 서비스 클라이언트 ── */
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "서버 설정 오류가 발생했습니다." },
        { status: 500 }
      );
    }
    const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);

    /* ── 같은 연락처 중복 제출 차단 (10분) ── */
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    let dupQuery = adminClient
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", tenMinAgo);
    if (phone && email) {
      dupQuery = dupQuery.or(`phone.eq.${phone},email.eq.${email}`);
    } else if (phone) {
      dupQuery = dupQuery.eq("phone", phone);
    } else {
      dupQuery = dupQuery.eq("email", email);
    }
    const { count: dupCount } = await dupQuery;
    if ((dupCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "방금 접수된 신청이 있습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 }
      );
    }

    /* ── INSERT ── */
    const goals = Array.isArray(raw.goals)
      ? raw.goals.slice(0, 10).map((g) => sanitize(g).trim()).filter(Boolean)
      : null;

    const { error: insertError } = await adminClient.from("leads").insert({
      type,
      name,
      profession: sanitize(raw.profession || "").trim() || null,
      org_name: orgName || null,
      specialty: sanitize(raw.specialty || "").trim() || null,
      phone: phone || null,
      email: email || null,
      has_channel: typeof raw.hasChannel === "boolean" ? raw.hasChannel : null,
      channel_url: sanitize(raw.channelUrl || "").trim() || null,
      goals,
      available_time: sanitize(raw.availableTime || "").trim() || null,
      interested_package: sanitize(raw.interestedPackage || "").trim() || null,
      budget_range: sanitize(raw.budgetRange || "").trim() || null,
      message: sanitize(raw.message || "").trim() || null,
      source: sanitize(raw.source || "").trim() || null,
      utm_source: sanitize(raw.utmSource || "").trim() || null,
      utm_campaign: sanitize(raw.utmCampaign || "").trim() || null,
      consent_at: new Date().toISOString(),
      status: "new",
    });

    if (insertError) {
      console.error("[production/lead] 저장 실패:", insertError.message);
      return NextResponse.json(
        { error: "신청 저장에 실패했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 500 }
      );
    }

    /* ── 알림 (실패해도 신청은 성공 처리) ── */
    try {
      await notifyDiscord({ ...raw, name, phone, email, orgName });
    } catch (err) {
      console.error("[production/lead] 디스코드 알림 실패:", err);
    }
    try {
      await sendLeadNotification({
        type,
        name,
        profession: PROFESSION_LABEL[raw.profession ?? ""] ?? raw.profession,
        orgName,
        phone,
        email,
        interestedPackage: raw.interestedPackage,
        budgetRange: raw.budgetRange,
        source: raw.source,
        utmSource: raw.utmSource,
        message: raw.message,
      });
    } catch (err) {
      console.error("[production/lead] 메일 알림 실패:", err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[production/lead] 오류:", err);
    return NextResponse.json(
      { error: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
