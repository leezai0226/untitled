"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { sanitize } from "@/utils/sanitize";

const CATEGORY_OPTIONS = [
  { value: "컬러 프리셋", label: "컬러 프리셋" },
  { value: "자막 템플릿", label: "자막 템플릿" },
  { value: "효과음/BGM", label: "효과음/BGM" },
  { value: "Free", label: "Free" },
] as const;

interface FaqItem {
  q: string;
  a: string;
}

interface ProductData {
  id: string;
  title: string;
  price: number;
  category: string;
  description: string;
  thumbnail_url: string | null;
  detail_images: string[];
  file_url: string | null;
  sort_order: number;
  remaining_seats: number | null;
  faqs: FaqItem[] | null;
  refund_policy: FaqItem[] | null;
}

export default function AdminShopEditPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const supabase = createClient();

  /* ── 상태 ── */
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [unlimited, setUnlimited] = useState(true);
  const [remainingSeats, setRemainingSeats] = useState<number | "">("");
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [refundPolicy, setRefundPolicy] = useState<FaqItem[]>([]);

  // 기존 이미지 URL
  const [existingThumbnail, setExistingThumbnail] = useState<string | null>(null);
  const [existingDetails, setExistingDetails] = useState<string[]>([]);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);

  // 새 파일
  const [newThumbnailFile, setNewThumbnailFile] = useState<File | null>(null);
  const [newThumbnailPreview, setNewThumbnailPreview] = useState<string | null>(null);
  const [newDetailFiles, setNewDetailFiles] = useState<File[]>([]);
  const [newDetailPreviews, setNewDetailPreviews] = useState<string[]>([]);
  const [newProductFile, setNewProductFile] = useState<File | null>(null);

  const thumbnailRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── 기존 데이터 로드 ── */
  useEffect(() => {
    const fetchProduct = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (error || !data) {
        alert("상품을 찾을 수 없습니다.");
        router.replace("/admin/shop");
        return;
      }

      const p = data as ProductData;
      setTitle(p.title);
      setCategory(p.category || "");
      setPrice(p.price);
      setDescription(p.description || "");
      setSortOrder(p.sort_order || 0);
      setUnlimited(p.remaining_seats === null);
      setRemainingSeats(p.remaining_seats ?? "");
      setExistingThumbnail(p.thumbnail_url);
      setExistingDetails(p.detail_images || []);
      setExistingFileUrl(p.file_url);
      setFaqs(Array.isArray(p.faqs) ? p.faqs : []);
      setRefundPolicy(Array.isArray(p.refund_policy) ? p.refund_policy : []);
      setLoading(false);
    };
    fetchProduct();
  }, [productId]);

  /* ── 안전한 파일명 ── */
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
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  };

  /* ── 썸네일 변경 ── */
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewThumbnailFile(file);
    setNewThumbnailPreview(URL.createObjectURL(file));
  };

  /* ── 상세 이미지 추가 ── */
  const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setNewDetailFiles((prev) => [...prev, ...files]);
    setNewDetailPreviews((prev) => [
      ...prev,
      ...files.map((f) => URL.createObjectURL(f)),
    ]);
  };

  /* ── 기존 상세 이미지 삭제 ── */
  const removeExistingDetail = (index: number) => {
    setExistingDetails((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── 새 상세 이미지 삭제 ── */
  const removeNewDetail = (index: number) => {
    setNewDetailFiles((prev) => prev.filter((_, i) => i !== index));
    setNewDetailPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── 유효성 ── */
  const isValid =
    title.trim() !== "" &&
    category !== "" &&
    price !== "" &&
    Number(price) >= 0 &&
    description.trim() !== "";

  /* ── 제출 ── */
  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);

    try {
      const folder = `product-${Date.now()}`;

      // 1) 썸네일: 새로 업로드했으면 교체, 아니면 기존 유지
      let finalThumbnailUrl = existingThumbnail;
      if (newThumbnailFile) {
        const thumbnailPath = `${folder}/${safeFileName(newThumbnailFile.name)}`;
        finalThumbnailUrl = await uploadFile("shop-thumbnails", newThumbnailFile, thumbnailPath);
      }

      // 2) 상세 이미지: 기존 유지분 + 새 업로드분
      const finalDetailUrls = [...existingDetails];
      for (let i = 0; i < newDetailFiles.length; i++) {
        const f = newDetailFiles[i];
        const detailPath = `${folder}/detail-${i}-${safeFileName(f.name)}`;
        const url = await uploadFile("shop-details", f, detailPath);
        finalDetailUrls.push(url);
      }

      // 3) 판매 파일: 새로 업로드했으면 교체, 아니면 기존 유지
      let finalFileUrl = existingFileUrl;
      if (newProductFile) {
        const filePath = `${folder}/${safeFileName(newProductFile.name)}`;
        const { error: fileError } = await supabase.storage
          .from("shop-files")
          .upload(filePath, newProductFile, {
            cacheControl: "3600",
            upsert: false,
          });
        if (fileError) throw new Error(`파일 업로드 실패: ${fileError.message}`);
        finalFileUrl = filePath;
      }

      // 4) 서버 API를 통해 DB update (관리자 이중 검증)
      const updateRes = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productId,
          title: title.trim(),
          category,
          price: Number(price),
          description: description.trim(),
          thumbnail_url: finalThumbnailUrl,
          detail_images: finalDetailUrls,
          file_url: finalFileUrl,
          sort_order: sortOrder,
          remaining_seats: unlimited ? null : Number(remainingSeats),
          faqs: faqs.filter((f) => f.q.trim() && f.a.trim()),
          refund_policy: refundPolicy.filter((f) => f.q.trim() && f.a.trim()),
        }),
      });

      const updateData = await updateRes.json();
      if (!updateRes.ok) throw new Error(updateData.error || "상품 수정 실패");

      alert("상품이 수정되었습니다!");
      router.push("/admin/shop");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── 로딩 ── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  /* ── UI ── */
  return (
    <div className="pt-20 pb-12">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <button
          onClick={() => router.push("/admin/shop")}
          className="text-sm text-sub-text hover:text-primary transition-colors"
        >
          ← 상품 목록으로
        </button>

        <h1 className="mt-4 text-2xl font-bold text-white md:text-3xl">
          상품 <span className="text-primary">수정</span>
        </h1>

        {/* ── 상품명 ── */}
        <div className="mt-10">
          <label className="block text-sm font-medium text-sub-text mb-2">
            상품명 <span className="text-primary">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
            className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-base text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none transition-colors"
          />
        </div>

        {/* ── 진열 순서 ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            진열 순서 (낮을수록 앞)
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            className="w-32 rounded-xl border border-border bg-card px-4 py-3 text-base text-white focus:border-primary focus:outline-none transition-colors"
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

        {/* ── 썸네일 이미지 ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            썸네일 이미지
          </label>
          <input
            ref={thumbnailRef}
            type="file"
            accept="image/*"
            onChange={handleThumbnailChange}
            className="hidden"
          />
          {newThumbnailPreview ? (
            <div className="relative">
              <img
                src={newThumbnailPreview}
                alt="새 썸네일"
                className="w-full max-h-48 object-cover rounded-xl border border-border"
              />
              <button
                onClick={() => {
                  setNewThumbnailFile(null);
                  setNewThumbnailPreview(null);
                }}
                className="absolute top-2 right-2 rounded-lg bg-background/80 px-2 py-1 text-xs text-sub-text hover:text-red-400 transition-colors"
              >
                취소
              </button>
              <p className="mt-1 text-xs text-primary">새 이미지로 교체됩니다</p>
            </div>
          ) : existingThumbnail ? (
            <div className="relative">
              <img
                src={existingThumbnail}
                alt="현재 썸네일"
                className="w-full max-h-48 object-cover rounded-xl border border-border"
              />
              <button
                onClick={() => thumbnailRef.current?.click()}
                className="absolute bottom-2 right-2 rounded-lg bg-primary/90 px-3 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-primary"
              >
                이미지 변경
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

        {/* ── 상세 이미지 ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            상세페이지 이미지
          </label>
          <input
            ref={detailRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleDetailChange}
            className="hidden"
          />

          {/* 기존 상세 이미지 */}
          {existingDetails.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs text-sub-text">기존 이미지</p>
              <div className="grid grid-cols-3 gap-2">
                {existingDetails.map((src, i) => (
                  <div key={`existing-${i}`} className="relative">
                    <img
                      src={src}
                      alt={`기존 ${i + 1}`}
                      className="h-24 w-full object-cover rounded-lg border border-border"
                    />
                    <button
                      onClick={() => removeExistingDetail(i)}
                      className="absolute top-1 right-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-sub-text hover:text-red-400 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 새 상세 이미지 */}
          {newDetailPreviews.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs text-primary">새로 추가될 이미지</p>
              <div className="grid grid-cols-3 gap-2">
                {newDetailPreviews.map((src, i) => (
                  <div key={`new-${i}`} className="relative">
                    <img
                      src={src}
                      alt={`새 ${i + 1}`}
                      className="h-24 w-full object-cover rounded-lg border border-primary/50"
                    />
                    <button
                      onClick={() => removeNewDetail(i)}
                      className="absolute top-1 right-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-sub-text hover:text-red-400 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => detailRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-border py-6 text-center text-sm text-sub-text transition-colors hover:border-primary/50 hover:text-primary"
          >
            + 상세 이미지 추가
          </button>
        </div>

        {/* ── 판매용 파일 ── */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-sub-text mb-2">
            판매용 디지털 파일
          </label>
          <input
            ref={fileRef}
            type="file"
            onChange={(e) => setNewProductFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          {newProductFile ? (
            <div className="flex items-center justify-between rounded-xl border border-primary/50 bg-card px-4 py-3">
              <span className="truncate text-sm text-white">
                📎 {newProductFile.name}{" "}
                <span className="text-primary">(새 파일)</span>
              </span>
              <button
                onClick={() => setNewProductFile(null)}
                className="text-xs text-sub-text hover:text-red-400 transition-colors ml-2"
              >
                취소
              </button>
            </div>
          ) : existingFileUrl ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="truncate text-sm text-white">
                📎 기존 파일 유지 중
              </span>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-lg bg-primary/20 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/30"
              >
                파일 변경
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

        {/* ── 수정 완료 버튼 ── */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className={`mt-10 w-full rounded-xl py-4 text-lg font-semibold transition-all duration-200 ${
            isValid && !submitting
              ? "bg-primary text-background hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 cursor-pointer"
              : "bg-border text-sub-text cursor-not-allowed"
          }`}
        >
          {submitting ? "수정 중..." : "수정 완료"}
        </button>
      </div>
    </div>
  );
}
