import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendPrivateReply, getInstagramEnv } from "@/lib/instagram";

/**
 * Instagram Webhooks — 댓글 이벤트 수신 → 키워드 매칭 → 비공개 답장 DM
 *
 * GET  : Meta 웹훅 검증 (hub.challenge 에코)
 * POST : comments 이벤트 처리
 *   · X-Hub-Signature-256 서명 검증 (APP_SECRET)
 *   · 내 계정이 단 댓글은 무시 (무한루프 방지)
 *   · comment_id 유니크 로그로 중복 발송 방지 (댓글당 DM 1회 정책)
 */

export const dynamic = "force-dynamic";

function getAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/* ── 검증 핸드셰이크 ── */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const { verifyToken } = getInstagramEnv();
  if (mode === "subscribe" && token && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "검증 실패" }, { status: 403 });
}

/* ── 이벤트 수신 ── */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // 서명 검증 — Meta 가 보낸 요청인지 확인
  const { appSecret } = getInstagramEnv();
  if (appSecret) {
    const signature = request.headers.get("x-hub-signature-256") || "";
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
    const valid =
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  // Meta 는 2xx 응답을 빨리 원함 — 처리 후 항상 200
  try {
    const body = JSON.parse(rawBody);
    const adminClient = getAdminClient();

    for (const entry of body.entry ?? []) {
      const igUserId = String(entry.id ?? "");
      for (const change of entry.changes ?? []) {
        if (change.field !== "comments") continue;
        const v = change.value ?? {};
        const commentId = String(v.id ?? "");
        const commentText: string = v.text ?? "";
        const fromId = String(v.from?.id ?? "");
        const fromUsername: string = v.from?.username ?? "";
        const mediaId = String(v.media?.id ?? "");

        if (!commentId || !commentText) continue;
        // 내 계정이 단 댓글(답글 등)은 무시
        if (fromId && fromId === igUserId) continue;

        await processComment(adminClient, {
          igUserId,
          commentId,
          commentText,
          fromUsername,
          mediaId,
        });
      }
    }
  } catch (err) {
    console.error("[instagram/webhook] 처리 오류:", err);
  }

  return NextResponse.json({ received: true });
}

/* ── 댓글 1건 처리 ── */
async function processComment(
  adminClient: ReturnType<typeof getAdminClient>,
  input: {
    igUserId: string;
    commentId: string;
    commentText: string;
    fromUsername: string;
    mediaId: string;
  }
) {
  // 계정 조회
  const { data: account } = await adminClient
    .from("instagram_accounts")
    .select("id, ig_user_id, access_token, is_active")
    .eq("ig_user_id", input.igUserId)
    .maybeSingle();
  if (!account || !account.is_active) return;

  // 활성 규칙 조회
  const { data: rules } = await adminClient
    .from("instagram_dm_rules")
    .select("*")
    .eq("account_id", account.id)
    .eq("is_active", true);
  if (!rules || rules.length === 0) return;

  // 키워드 매칭 (대소문자 무시, 게시물 필터)
  const text = input.commentText.toLowerCase();
  const matched = rules.find((r) => {
    if (r.media_id && r.media_id !== input.mediaId) return false;
    const keywords = (r.keywords as string[]) ?? [];
    return keywords.some(
      (k) => k.trim() && text.includes(k.trim().toLowerCase())
    );
  });
  if (!matched) return;

  // 중복 발송 방지 — comment_id 유니크 insert 가 레이스에서도 1회를 보장
  const { error: dedupeError } = await adminClient
    .from("instagram_dm_logs")
    .insert({
      rule_id: matched.id,
      account_id: account.id,
      comment_id: input.commentId,
      commenter_username: input.fromUsername,
      comment_text: input.commentText,
      media_id: input.mediaId,
      status: "pending",
    });
  if (dedupeError) return; // 이미 처리된 댓글 (unique 충돌)

  // DM 발송
  try {
    const hasButton = !!(matched.button_label && matched.button_url);
    await sendPrivateReply({
      igUserId: account.ig_user_id,
      token: account.access_token,
      commentId: input.commentId,
      ...(hasButton
        ? {
            card: {
              title: matched.card_title || matched.dm_text || "안내",
              subtitle: matched.card_subtitle || undefined,
              buttonLabel: matched.button_label,
              buttonUrl: matched.button_url,
            },
          }
        : { text: matched.dm_text }),
    });

    await adminClient
      .from("instagram_dm_logs")
      .update({ status: "sent" })
      .eq("comment_id", input.commentId);
    await adminClient
      .from("instagram_dm_rules")
      .update({ sent_count: (matched.sent_count ?? 0) + 1 })
      .eq("id", matched.id);
  } catch (err) {
    console.error("[instagram/webhook] DM 발송 실패:", err);
    await adminClient
      .from("instagram_dm_logs")
      .update({
        status: "failed",
        error: err instanceof Error ? err.message : "unknown",
      })
      .eq("comment_id", input.commentId);
  }
}
