"use client";

/*
 * ──────────────────────────────────────────────────────────
 * 관리자 전용 — Shop 디지털 에셋 등록 폼  (/admin/shop/new)
 *
 * [Supabase Storage 버킷 사전 생성 필요]
 * 아래 3개 버킷을 Supabase 대시보드 > Storage 에서 직접 생성해야 합니다:
 *   1. shop-thumbnails  (Public)  — 상품 썸네일 이미지
 *   2. shop-details     (Public)  — 상세페이지 이미지 (다중)
 *   3. shop-files       (Private) — 판매용 디지털 파일 (zip, pdf 등)
 *
 * [보안 참고]
 * 현재는 테스트를 위해 접속 제한이 없습니다.
 * 향후 /admin 경로는 관리자 권한(user_metadata.role === 'admin')
 * 확인 후 접근을 허용하도록 수정할 예정입니다.
 * ──────────────────────────────────────────────────────────
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { sanitize } from "@/utils/sanitize";

const CATEGORY_OPTIONS = [
  { value: "컬러 프리셋", label: "🎨 컬러 프리셋" },
  { value: "자막 템플릿", label: "✏️ 자막 템플릿" },
  { value: "효과음/BGM", label: "🎵 효과음/BGM" },
  { value: "Free", label: "🆓 Free" },
] as const;

export default function AdminShopNewPage() {
  const router = useRouter();
  const supabase = createClient();

  /* ── 폼 상태 ── */
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [remainingSeats, setRemainingSeats] = useState<number | "">("");
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>([]);
  const [refundPolicy, setRefundPolicy] = useState<{ q: string; a: string }[]>([]);

  /* ── 파일 상태 ── */
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  /* ── 슬라이더 미디어 (4:5 비율, 이미지+영상 혼합) ── */
  const [sliderFiles, setSliderFiles] = useState<File[]>([]);
  const [sliderPreviews, setSliderPreviews] = useState<
    { url: string; type: "image" | "video" }[]
  >([]);

  const [detailFiles, setDetailFiles] = useState<File[]>([]);
  const [detailPreviews, setDetailPreviews] = useState<string[]>([]);

  const [productFile, setProductFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const thumbnailRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── 썸네일 선택 ── */
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  /* ── 상세 이미지 다중 선택 ── */
  const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setDetailFiles((prev) => [...prev, ...files]);
    setDetailPreviews((prev) => [
      ...prev,
      ...files.map((f) => URL.createObjectURL(f)),
    ]);
  };

  const removeDetailImage = (index: number) => {
    setDetailFiles((prev) => prev.filter((_, i) => i !== index));
    setDetailPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── 슬라이더 미디어 다중 선택 (이미지 + 영상) ── */
  const MAX_SLIDER_IMAGE_MB = 10;   // 이미지 10MB 제한
  const MAX_SLIDER_VIDEO_MB = 100;  // 영상 100MB 제한

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const allowedImage = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    const allowedVideo = ["video/mp4", "video/quicktime"]; // .mp4, .mov

    const accepted: File[] = [];
    const previews: { url: string; type: "image" | "video" }[] = [];

    for (const f of files) {
      const isImage = allowedImage.includes(f.type) || /\.(jpg|jpeg|png|webp)$/i.test(f.name);
      const isVideo = allowedVideo.includes(f.type) || /\.(mp4|mov)$/i.test(f.name);

      if (!isImage && !isVideo) {
        alert(`지원하지 않는 파일 형식입니다: ${f.name}\n(jpg, png, webp, mp4, mov 만 가능)`);
        continue;
      }

      const sizeMB = f.size / 1024 / 1024;
      if (isImage && sizeMB > MAX_SLIDER_IMAGE_MB) {
        alert(`이미지 파일은 ${MAX_SLIDER_IMAGE_MB}MB 이하여야 합니다: ${f.name}`);
        continue;
      }
      if (isVideo && sizeMB > MAX_SLIDER_VIDEO_MB) {
        alert(`영상 파일은 ${MAX_SLIDER_VIDEO_MB}MB 이하여야 합니다: ${f.name}`);
        continue;
      }

      accepted.push(f);
      previews.push({
        url: URL.createObjectURL(f),
        type: isVideo ? "video" : "image",
      });
    }

    if (accepted.length === 0) return;

    setSliderFiles((prev) => [...prev, ...accepted]);
    setSliderPreviews((prev) => [...prev, ...previews]);
    // input 재선택 허용
    if (sliderRef.current) sliderRef.current.value = "";
  };

  const removeSliderMedia = (index: number) => {
    setSliderFiles((prev) => prev.filter((_, i) => i !== index));
    setSliderPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  /* 슬라이더 미디어 순서 변경 (위/아래 화살표) */
  const moveSliderMedia = (from: number, to: number) => {
    if (to < 0 || to >= sliderFiles.length) return;
    setSliderFiles((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
    setSliderPreviews((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  };

  /* ── 유효성 ── */
  const isValid =
    title.trim() !== "" &&
    category !== "" &&
    price !== "" &&
    Number(price) >= 0 &&
    description.trim() !== "" &&
    thumbnailFile !== null &&
    productFile !== null;

  /* ── 안전한 파일명 생성 (한글·공백 제거, 영문+숫자+확장자만) ── */
  const safeFileName = (originalName: string) => {
    const ext = originalName.split(".").pop()?.toLowerCase() ?? "bin";
    const random = Math.random().toString(36).substring(2, 10);
    return `${Date.now()}-${random}.${ext}`;
  };

  /* ── 업로드 헬퍼 ── */
  const uploadFile = async (bucket: string, file: File, path: string) => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw new Error(`${bucket} 업로드 실패: ${error.message}`);

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  };

  /* ── 제출 ── */
  const handleSubmit = async () => {
    if (!isValid || !thumbnailFile || !productFile) return;
    setSubmitting(true);

    try {
      const folder = `product-${Date.now()}`;

      // 1) 썸네일 업로드
      const thumbnailPath = `${folder}/${safeFileName(thumbnailFile.name)}`;
      const thumbnailUrl = await uploadFile(
        "shop-thumbnails",
        thumbnailFile,
        thumbnailPath,
      );

      // 2) 상세 이미지 다중 업로드
      const detailUrls: string[] = [];
      for (let i = 0; i < detailFiles.length; i++) {
        const f = detailFiles[i];
        const detailPath = `${folder}/detail-${i}-${safeFileName(f.name)}`;
        const url = await uploadFile("shop-details", f, detailPath);
        detailUrls.push(url);
      }

      // 2-1) 슬라이더 미디어 업로드 (이미지 + 영상)
      const sliderMedia: { url: string; type: "image" | "video" }[] = [];
      for (let i = 0; i < sliderFiles.length; i++) {
        const f = sliderFiles[i];
        const mediaType = sliderPreviews[i].type;
        const sliderPath = `${folder}/slider-${i}-${safeFileName(f.name)}`;
        const url = await uploadFile("shop-details", f, sliderPath);
        sliderMedia.push({ url, type: mediaType });
      }

      // 3) 판매 파일 업로드 (Private 버킷 → path만 저장)
      const filePath = `${folder}/${safeFileName(productFile.name)}`;
      const { error: fileError } = await supabase.storage
        .from("shop-files")
        .upload(filePath, productFile, {
          cacheControl: "3600",
          upsert: false,
        });
      if (fileError)
        throw new Error(`파일 업로드 실패: ${fileError.message}`);

      // 4) 서버 API를 통해 DB insert (관리자 이중 검증)
      const insertRes = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          price: Number(price),
          description: description.trim(),
          remaining_seats: unlimited ? null : Number(remainingSeats),
          faqs: faqs.filter((f) => f.q.trim() && f.a.trim()),
          refund_policy: refundPolicy.filter((f) => f.q.trim() && f.a.trim()),
          thumbnail_url: thumbnailUrl,
          detail_images: detailUrls,
          slider_media: sliderMedia,
          file_url: filePath,
        }),
      });

      const insertContentType = insertRes.headers.get("content-type") || "";
      if (!insertContentType.includes("application/json")) {
        throw new Error(`서버 오류 (${insertRes.status}). 배포가 완료되었는지 확인해주세요.`);
      }
      const insertData = await insertRes.json();
      if (!insertRes.ok)
        throw new Error(insertData.error || "상품 등록 실패");

      alert("상품이 등록되었습니다!");
      router.push("/admin/shop");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── UI ── */
  return (
    <div className="pt-20 pb-12">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold text-white md:text-3xl">
          🛍️ 디지털 에셋 <span className="text-primary">등록</span>
        </h1>
        <p className="mt-2 text-base text-sub-text">
          Shop 페이지에 노출할 상품 정보를 입력하세요.
        </p>

        {/* ── 상품명 ── */}
        <div className="mt-10">
          <label className="block text-sm font-medium text-sub-text mb-2">
            상품명 <span className="text-primary">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 시네마틱 컬러 프리셋 팩"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
          />
        </div>

        {/* ── 카테고리 ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            카테고리 <span className="text-primary">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-white focus:border-primary focus:outline-none transition-colors appearance-none"
          >
            <option value="" disabled>카테고리를 선택하세요</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* ── 가격 ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            가격 (원) <span className="text-primary">*</span>
          </label>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) =>
              setPrice(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="0 (무료일 경우 0 입력)"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
          />
        </div>

        {/* ── 간단 설명 ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            간단 설명 <span className="text-primary">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Shop 카드에 보일 한 줄 소개를 입력하세요."
            className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
          />
        </div>

        {/* ── 잔여 수량 (재고) ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            잔여 수량 (재고)
          </label>
          <div className="flex items-center gap-3 mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={unlimited}
                onChange={(e) => {
                  setUnlimited(e.target.checked);
                  if (e.target.checked) setRemainingSeats("");
                }}
                className="h-4 w-4 rounded border-border bg-card accent-primary"
              />
              <span className="text-sm text-white">수량 제한 없음 (무제한)</span>
            </label>
          </div>
          {!unlimited && (
            <input
              type="number"
              min={0}
              value={remainingSeats}
              onChange={(e) =>
                setRemainingSeats(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="예: 20 (최대 수강 인원)"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
            />
          )}
          <p className="mt-1.5 text-xs text-sub-text/60">
            클래스처럼 인원 제한이 있는 상품은 체크를 해제하고 수량을 입력하세요.
          </p>
        </div>

        {/* ── 썸네일 이미지 (단일) ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            썸네일 이미지 <span className="text-primary">*</span>
          </label>
          <input
            ref={thumbnailRef}
            type="file"
            accept="image/*"
            onChange={handleThumbnailChange}
            className="hidden"
          />
          {thumbnailPreview ? (
            <div className="relative">
              <img
                src={thumbnailPreview}
                alt="썸네일 미리보기"
                className="w-full max-h-48 object-cover rounded-xl border border-border"
              />
              <button
                onClick={() => {
                  setThumbnailFile(null);
                  setThumbnailPreview(null);
                }}
                className="absolute top-2 right-2 rounded-lg bg-background/80 px-2 py-1 text-xs text-sub-text hover:text-red-400 transition-colors"
              >
                삭제
              </button>
            </div>
          ) : (
            <button
              onClick={() => thumbnailRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-border py-10 text-center text-sub-text transition-colors hover:border-primary/50 hover:text-primary"
            >
              클릭하여 이미지 선택
            </button>
          )}
        </div>

        {/* ── 슬라이더 미디어 (4:5 비율, 사진+영상 혼합) ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            상단 슬라이더 미디어{" "}
            <span className="text-sub-text/60">
              (선택 · 사진 + 영상 혼합 · 4:5 비율로 노출)
            </span>
          </label>
          <input
            ref={sliderRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,.jpg,.jpeg,.png,.webp,.mp4,.mov"
            multiple
            onChange={handleSliderChange}
            className="hidden"
          />

          {sliderPreviews.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {sliderPreviews.map((item, i) => (
                <div
                  key={i}
                  className="relative overflow-hidden rounded-lg border border-border bg-background"
                >
                  <div className="relative aspect-[4/5] w-full">
                    {item.type === "video" ? (
                      <video
                        src={item.url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.url}
                        alt={`슬라이더 ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                    )}
                    {/* 타입 뱃지 */}
                    <span className="absolute left-1.5 top-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white backdrop-blur-sm">
                      {item.type === "video" ? "🎬 Video" : "🖼 Image"}
                    </span>
                    {/* 순서 뱃지 */}
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-bold text-background">
                      {i + 1}
                    </span>
                  </div>
                  {/* 컨트롤 */}
                  <div className="flex items-center justify-between gap-1 border-t border-border bg-card p-1.5">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveSliderMedia(i, i - 1)}
                        disabled={i === 0}
                        aria-label="앞으로"
                        className="rounded p-1 text-sub-text transition-colors hover:text-primary disabled:opacity-30"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSliderMedia(i, i + 1)}
                        disabled={i === sliderPreviews.length - 1}
                        aria-label="뒤로"
                        className="rounded p-1 text-sub-text transition-colors hover:text-primary disabled:opacity-30"
                      >
                        ▶
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSliderMedia(i)}
                      className="rounded px-1.5 py-0.5 text-[11px] text-sub-text transition-colors hover:text-red-400"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => sliderRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-border py-6 text-center text-sm text-sub-text transition-colors hover:border-primary/50 hover:text-primary"
          >
            + 슬라이더 미디어 추가 (.jpg, .png, .webp, .mp4, .mov)
          </button>
          <p className="mt-1.5 text-xs text-sub-text/60">
            업로드한 순서대로 슬라이더에 노출되며, 화살표 버튼으로 순서를 조정할 수 있습니다.
            <br />
            이미지 최대 {MAX_SLIDER_IMAGE_MB}MB / 영상 최대 {MAX_SLIDER_VIDEO_MB}MB.
            미디어를 추가하지 않으면 상세 페이지에서 슬라이더 영역이 표시되지 않습니다.
          </p>
        </div>

        {/* ── 상세페이지 이미지 (다중) ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            상세페이지 이미지{" "}
            <span className="text-sub-text/60">(선택, 다중 업로드 가능)</span>
          </label>
          <input
            ref={detailRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleDetailChange}
            className="hidden"
          />
          {detailPreviews.length > 0 && (
            <div className="mb-3 grid grid-cols-3 gap-2">
              {detailPreviews.map((src, i) => (
                <div key={i} className="relative">
                  <img
                    src={src}
                    alt={`상세 ${i + 1}`}
                    className="h-24 w-full object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={() => removeDetailImage(i)}
                    className="absolute top-1 right-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-sub-text hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => detailRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-border py-6 text-center text-sm text-sub-text transition-colors hover:border-primary/50 hover:text-primary"
          >
            + 상세 이미지 추가
          </button>
        </div>

        {/* ── 판매용 디지털 파일 (단일) ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            판매용 디지털 파일 <span className="text-primary">*</span>
          </label>
          <input
            ref={fileRef}
            type="file"
            onChange={(e) => setProductFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          {productFile ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="truncate text-sm text-white">
                📎 {productFile.name}{" "}
                <span className="text-sub-text">
                  ({(productFile.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              </span>
              <button
                onClick={() => setProductFile(null)}
                className="text-xs text-sub-text hover:text-red-400 transition-colors ml-2"
              >
                삭제
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-border py-10 text-center text-sub-text transition-colors hover:border-primary/50 hover:text-primary"
            >
              클릭하여 파일 선택 (zip, pdf 등)
            </button>
          )}
        </div>

        {/* ── 자주 묻는 질문 (FAQ) ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            자주 묻는 질문 (FAQ){" "}
            <span className="text-sub-text/60">(선택)</span>
          </label>

          {faqs.length > 0 && (
            <div className="space-y-4 mb-4">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-primary">
                      FAQ #{i + 1}
                    </span>
                    <button
                      onClick={() =>
                        setFaqs((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-xs text-sub-text hover:text-red-400 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                  <input
                    type="text"
                    value={faq.q}
                    onChange={(e) =>
                      setFaqs((prev) =>
                        prev.map((f, idx) =>
                          idx === i ? { ...f, q: e.target.value } : f
                        )
                      )
                    }
                    placeholder="질문 (Q)"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
                  />
                  <textarea
                    value={faq.a}
                    onChange={(e) =>
                      setFaqs((prev) =>
                        prev.map((f, idx) =>
                          idx === i ? { ...f, a: e.target.value } : f
                        )
                      )
                    }
                    rows={2}
                    placeholder="답변 (A)"
                    className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setFaqs((prev) => [...prev, { q: "", a: "" }])}
            className="w-full rounded-xl border-2 border-dashed border-border py-4 text-center text-sm text-sub-text transition-colors hover:border-primary/50 hover:text-primary"
          >
            + 자주 묻는 질문 추가
          </button>
        </div>

        {/* ── 환불 규정 ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            환불 규정{" "}
            <span className="text-sub-text/60">(선택)</span>
          </label>

          {refundPolicy.length > 0 && (
            <div className="space-y-4 mb-4">
              {refundPolicy.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-yellow-400">
                      환불 #{i + 1}
                    </span>
                    <button
                      onClick={() =>
                        setRefundPolicy((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-xs text-sub-text hover:text-red-400 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.q}
                    onChange={(e) =>
                      setRefundPolicy((prev) =>
                        prev.map((f, idx) =>
                          idx === i ? { ...f, q: e.target.value } : f
                        )
                      )
                    }
                    placeholder="항목 (예: 7일 전 취소)"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
                  />
                  <textarea
                    value={item.a}
                    onChange={(e) =>
                      setRefundPolicy((prev) =>
                        prev.map((f, idx) =>
                          idx === i ? { ...f, a: e.target.value } : f
                        )
                      )
                    }
                    rows={2}
                    placeholder="상세 내용 (예: 결제 금액의 100% 환불)"
                    className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setRefundPolicy((prev) => [...prev, { q: "", a: "" }])}
            className="w-full rounded-xl border-2 border-dashed border-border py-4 text-center text-sm text-sub-text transition-colors hover:border-yellow-400/50 hover:text-yellow-400"
          >
            + 환불 규정 추가
          </button>
        </div>

        {/* ── 등록 버튼 ── */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className={`mt-10 w-full rounded-xl py-4 text-lg font-semibold transition-all duration-200 ${
            isValid && !submitting
              ? "bg-primary text-background hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 cursor-pointer"
              : "bg-border text-sub-text cursor-not-allowed"
          }`}
        >
          {submitting ? "업로드 중..." : "상품 등록"}
        </button>
      </div>
    </div>
  );
}
