"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";

/* ── 콘텐츠 타입 정의 ── */
type ContentType = "link" | "text" | "spacer" | "group" | "sns" | "video" | "music";
type SpacerSize = "small" | "medium" | "large";

/* ── SNS 플랫폼 목록 ── */
const SNS_PLATFORMS: { value: string; label: string; emoji: string }[] = [
  { value: "instagram", label: "인스타그램", emoji: "📷" },
  { value: "youtube", label: "유튜브", emoji: "▶️" },
  { value: "twitter", label: "트위터", emoji: "🐦" },
  { value: "tiktok", label: "틱톡", emoji: "🎵" },
  { value: "facebook", label: "페이스북", emoji: "👥" },
  { value: "linkedin", label: "링크드인", emoji: "💼" },
];

/* ── 그룹 링크 항목 타입 ── */
interface GroupItem {
  label: string;
  url: string;
}

interface MainLink {
  id: string;
  title: string;
  url: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  type: string;
  metadata: Record<string, unknown>;
}

/* ── 타입 선택 모달에서 보여줄 타입 목록 ── */
const CONTENT_TYPES: {
  emoji: string;
  label: string;
  type: string;
  supported: boolean;
}[] = [
  { emoji: "🔗", label: "단일 링크", type: "link", supported: true },
  { emoji: "🔗🔗", label: "그룹 링크", type: "group", supported: true },
  { emoji: "📸", label: "SNS 연결", type: "sns", supported: true },
  { emoji: "▶️", label: "동영상", type: "video", supported: true },
  { emoji: "🅣", label: "텍스트", type: "text", supported: true },
  { emoji: "🖼️", label: "갤러리", type: "gallery", supported: false },
  { emoji: "⬜", label: "여백", type: "spacer", supported: true },
  { emoji: "🎵", label: "음악", type: "music", supported: true },
  { emoji: "📍", label: "지도", type: "map", supported: false },
  { emoji: "📎", label: "파일공유", type: "file", supported: false },
];

export default function AdminLinksPage() {
  const [links, setLinks] = useState<MainLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  /* ── 타입 선택 모달 ── */
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);

  /* ── 추가 폼 공통 ── */
  const [adding, setAdding] = useState(false);

  /* ── link 타입 폼 ── */
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newThumbnailFile, setNewThumbnailFile] = useState<File | null>(null);
  const [newThumbnailPreview, setNewThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const newThumbInputRef = useRef<HTMLInputElement>(null);

  /* ── text 타입 폼 ── */
  const [newTextContent, setNewTextContent] = useState("");

  /* ── spacer 타입 폼 ── */
  const [spacerSize, setSpacerSize] = useState<SpacerSize>("medium");

  /* ── group 타입 폼 ── */
  const [groupTitle, setGroupTitle] = useState("");
  const [groupItems, setGroupItems] = useState<GroupItem[]>([{ label: "", url: "" }]);

  /* ── sns 타입 폼 ── */
  const [snsPlatform, setSnsPlatform] = useState("instagram");
  const [snsUrl, setSnsUrl] = useState("");

  /* ── video 타입 폼 ── */
  const [videoUrl, setVideoUrl] = useState("");
  const [videoCaption, setVideoCaption] = useState("");

  /* ── music 타입 폼 ── */
  const [musicUrl, setMusicUrl] = useState("");
  const [musicCaption, setMusicCaption] = useState("");

  /* ── 인라인 수정 ── */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editThumbnailFile, setEditThumbnailFile] = useState<File | null>(null);
  const [editThumbnailPreview, setEditThumbnailPreview] = useState<string | null>(null);
  const [editThumbnailRemoved, setEditThumbnailRemoved] = useState(false);
  const [uploadingEditThumb, setUploadingEditThumb] = useState(false);
  const editThumbInputRef = useRef<HTMLInputElement>(null);
  const [editTextContent, setEditTextContent] = useState("");
  const [editSpacerSize, setEditSpacerSize] = useState<SpacerSize>("medium");

  /* ── 인라인 수정: group ── */
  const [editGroupTitle, setEditGroupTitle] = useState("");
  const [editGroupItems, setEditGroupItems] = useState<GroupItem[]>([]);

  /* ── 인라인 수정: sns ── */
  const [editSnsPlatform, setEditSnsPlatform] = useState("instagram");
  const [editSnsUrl, setEditSnsUrl] = useState("");

  /* ── 인라인 수정: video ── */
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editVideoCaption, setEditVideoCaption] = useState("");

  /* ── 인라인 수정: music ── */
  const [editMusicUrl, setEditMusicUrl] = useState("");
  const [editMusicCaption, setEditMusicCaption] = useState("");

  const fetchLinks = useCallback(async () => {
    const res = await fetch("/api/admin/links");
    const data = await res.json();
    setLinks(data.links ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  /* ── 폼 초기화 ── */
  const resetForm = () => {
    setSelectedType(null);
    setNewTitle("");
    setNewUrl("");
    setNewThumbnailFile(null);
    setNewThumbnailPreview(null);
    setUploadingThumb(false);
    setNewTextContent("");
    setSpacerSize("medium");
    setGroupTitle("");
    setGroupItems([{ label: "", url: "" }]);
    setSnsPlatform("instagram");
    setSnsUrl("");
    setVideoUrl("");
    setVideoCaption("");
    setMusicUrl("");
    setMusicCaption("");
  };

  /* ── 순서 변경 ── */
  const moveLink = async (index: number, dir: "up" | "down") => {
    const next = [...links];
    const swapIdx = dir === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;

    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];

    const reordered = next.map((l, i) => ({ ...l, sort_order: i + 1 }));
    setLinks(reordered);

    await fetch("/api/admin/links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orders: reordered.map((l) => ({ id: l.id, sort_order: l.sort_order })),
      }),
    });
  };

  /* ── 활성/비활성 토글 ── */
  const toggleActive = async (link: MainLink) => {
    setSaving(link.id);
    setLinks((prev) =>
      prev.map((l) =>
        l.id === link.id ? { ...l, is_active: !l.is_active } : l
      )
    );
    await fetch("/api/admin/links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: link.id, is_active: !link.is_active }),
    });
    setSaving(null);
  };

  /* ── 인라인 수정 저장 ── */
  const saveEdit = async (link: MainLink) => {
    const id = link.id;
    setSaving(id);

    let body: Record<string, unknown> = { id };

    if (link.type === "text") {
      /* 텍스트 타입 저장 */
      if (!editTextContent.trim()) { setSaving(null); return; }
      body = {
        id,
        title: editTextContent.slice(0, 20),
        url: "",
        metadata: { content: editTextContent },
      };
    } else if (link.type === "spacer") {
      /* 스페이서 타입 저장 */
      body = {
        id,
        title: "spacer",
        url: "",
        metadata: { size: editSpacerSize },
      };
    } else if (link.type === "group") {
      /* 그룹 링크 타입 저장 */
      if (!editGroupTitle.trim()) { setSaving(null); return; }
      const validItems = editGroupItems.filter((it) => it.label.trim() && it.url.trim());
      if (validItems.length === 0) { setSaving(null); return; }
      body = {
        id,
        title: editGroupTitle,
        url: "",
        metadata: { items: validItems },
      };
    } else if (link.type === "sns") {
      /* SNS 타입 저장 */
      if (!editSnsUrl.trim()) { setSaving(null); return; }
      const platform = SNS_PLATFORMS.find((p) => p.value === editSnsPlatform);
      body = {
        id,
        title: platform?.label ?? editSnsPlatform,
        url: editSnsUrl,
        metadata: { platform: editSnsPlatform, url: editSnsUrl },
      };
    } else if (link.type === "video") {
      /* 동영상 타입 저장 */
      if (!editVideoUrl.trim()) { setSaving(null); return; }
      body = {
        id,
        title: editVideoCaption || "동영상",
        url: editVideoUrl,
        metadata: { video_url: editVideoUrl, caption: editVideoCaption || undefined },
      };
    } else if (link.type === "music") {
      /* 음악 타입 저장 */
      if (!editMusicUrl.trim()) { setSaving(null); return; }
      body = {
        id,
        title: editMusicCaption || "음악",
        url: editMusicUrl,
        metadata: { music_url: editMusicUrl, caption: editMusicCaption || undefined },
      };
    } else {
      /* link 타입 저장 */
      if (!editTitle.trim() || !editUrl.trim()) { setSaving(null); return; }
      let thumbnailUrl: string | null | undefined = undefined;
      if (editThumbnailFile) {
        setUploadingEditThumb(true);
        const fd = new FormData();
        fd.append("file", editThumbnailFile);
        const uploadRes = await fetch("/api/admin/upload-thumbnail", { method: "POST", body: fd });
        setUploadingEditThumb(false);
        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json();
          alert(uploadData.error || "썸네일 업로드 실패");
          setSaving(null);
          return;
        }
        const uploadData = await uploadRes.json();
        thumbnailUrl = uploadData.url as string;
      } else if (editThumbnailRemoved) {
        thumbnailUrl = null;
      } else {
        thumbnailUrl = (link.metadata?.thumbnail_url as string) ?? undefined;
      }
      body = {
        id,
        title: editTitle,
        url: editUrl,
        metadata: { thumbnail_url: thumbnailUrl ?? undefined },
      };
    }

    const res = await fetch("/api/admin/links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "수정 실패");
      setSaving(null);
      return;
    }

    /* 로컬 상태 업데이트 */
    setLinks((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (link.type === "text") {
          return { ...l, title: editTextContent.slice(0, 20), metadata: { content: editTextContent } };
        } else if (link.type === "spacer") {
          return { ...l, metadata: { size: editSpacerSize } };
        } else if (link.type === "group") {
          const validItems = editGroupItems.filter((it) => it.label.trim() && it.url.trim());
          return { ...l, title: editGroupTitle, metadata: { items: validItems } };
        } else if (link.type === "sns") {
          const platform = SNS_PLATFORMS.find((p) => p.value === editSnsPlatform);
          return { ...l, title: platform?.label ?? editSnsPlatform, url: editSnsUrl, metadata: { platform: editSnsPlatform, url: editSnsUrl } };
        } else if (link.type === "video") {
          return { ...l, title: editVideoCaption || "동영상", url: editVideoUrl, metadata: { video_url: editVideoUrl, caption: editVideoCaption || undefined } };
        } else if (link.type === "music") {
          return { ...l, title: editMusicCaption || "음악", url: editMusicUrl, metadata: { music_url: editMusicUrl, caption: editMusicCaption || undefined } };
        } else {
          let savedThumbUrl: string | null | undefined = undefined;
          if (editThumbnailFile) {
            savedThumbUrl = editThumbnailPreview ?? undefined;
          } else if (editThumbnailRemoved) {
            savedThumbUrl = null;
          } else {
            savedThumbUrl = (link.metadata?.thumbnail_url as string) ?? undefined;
          }
          return { ...l, title: editTitle, url: editUrl, metadata: { thumbnail_url: savedThumbUrl ?? undefined } };
        }
      })
    );
    setEditThumbnailFile(null);
    setEditThumbnailPreview(null);
    setEditThumbnailRemoved(false);
    setEditingId(null);
    setSaving(null);
  };

  /* ── 삭제 ── */
  const deleteLink = async (id: string) => {
    if (!window.confirm("이 항목을 삭제하시겠습니까?")) return;
    setDeleting(id);
    await fetch("/api/admin/links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLinks((prev) => prev.filter((l) => l.id !== id));
    setDeleting(null);
  };

  /* ── 콘텐츠 추가 ── */
  const addContent = async () => {
    if (!selectedType) return;
    setAdding(true);

    let body: Record<string, unknown> = { type: selectedType };

    if (selectedType === "link") {
      if (!newTitle.trim() || !newUrl.trim()) { setAdding(false); return; }
      let thumbUrl: string | undefined = undefined;
      if (newThumbnailFile) {
        setUploadingThumb(true);
        const fd = new FormData();
        fd.append("file", newThumbnailFile);
        const uploadRes = await fetch("/api/admin/upload-thumbnail", { method: "POST", body: fd });
        setUploadingThumb(false);
        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json();
          alert(uploadData.error || "썸네일 업로드 실패");
          setAdding(false);
          return;
        }
        const uploadData = await uploadRes.json();
        thumbUrl = uploadData.url as string;
      }
      body = {
        type: "link",
        title: newTitle.trim(),
        url: newUrl.trim(),
        metadata: thumbUrl ? { thumbnail_url: thumbUrl } : {},
      };
    } else if (selectedType === "text") {
      if (!newTextContent.trim()) { setAdding(false); return; }
      body = {
        type: "text",
        title: newTextContent.slice(0, 20),
        url: "",
        metadata: { content: newTextContent.trim() },
      };
    } else if (selectedType === "spacer") {
      body = {
        type: "spacer",
        title: "spacer",
        url: "",
        metadata: { size: spacerSize },
      };
    } else if (selectedType === "group") {
      /* 그룹 링크 추가 */
      if (!groupTitle.trim()) { setAdding(false); return; }
      const validItems = groupItems.filter((it) => it.label.trim() && it.url.trim());
      if (validItems.length === 0) { setAdding(false); return; }
      body = {
        type: "group",
        title: groupTitle.trim(),
        url: "",
        metadata: { items: validItems },
      };
    } else if (selectedType === "sns") {
      /* SNS 추가 */
      if (!snsUrl.trim()) { setAdding(false); return; }
      const platform = SNS_PLATFORMS.find((p) => p.value === snsPlatform);
      body = {
        type: "sns",
        title: platform?.label ?? snsPlatform,
        url: snsUrl.trim(),
        metadata: { platform: snsPlatform, url: snsUrl.trim() },
      };
    } else if (selectedType === "video") {
      /* 동영상 추가 */
      if (!videoUrl.trim()) { setAdding(false); return; }
      body = {
        type: "video",
        title: videoCaption.trim() || "동영상",
        url: videoUrl.trim(),
        metadata: {
          video_url: videoUrl.trim(),
          ...(videoCaption.trim() ? { caption: videoCaption.trim() } : {}),
        },
      };
    } else if (selectedType === "music") {
      /* 음악 추가 */
      if (!musicUrl.trim()) { setAdding(false); return; }
      body = {
        type: "music",
        title: musicCaption.trim() || "음악",
        url: musicUrl.trim(),
        metadata: {
          music_url: musicUrl.trim(),
          ...(musicCaption.trim() ? { caption: musicCaption.trim() } : {}),
        },
      };
    }

    const res = await fetch("/api/admin/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "추가 실패");
      setAdding(false);
      return;
    }

    if (data.link) {
      setLinks((prev) => [...prev, data.link]);
    }

    resetForm();
    setAdding(false);
  };

  /* ── 수정 모드 진입 시 초기값 세팅 ── */
  const startEdit = (link: MainLink) => {
    setEditingId(link.id);
    setEditTitle(link.title);
    setEditUrl(link.url);
    setEditThumbnailFile(null);
    setEditThumbnailPreview((link.metadata?.thumbnail_url as string) ?? null);
    setEditThumbnailRemoved(false);
    setEditTextContent((link.metadata?.content as string) ?? "");
    setEditSpacerSize(((link.metadata?.size as SpacerSize) ?? "medium"));
    /* group 수정 초기값 */
    setEditGroupTitle(link.title);
    setEditGroupItems(
      Array.isArray(link.metadata?.items)
        ? (link.metadata.items as GroupItem[])
        : [{ label: "", url: "" }]
    );
    /* sns 수정 초기값 */
    setEditSnsPlatform((link.metadata?.platform as string) ?? "instagram");
    setEditSnsUrl((link.metadata?.url as string) ?? link.url);
    /* video 수정 초기값 */
    setEditVideoUrl((link.metadata?.video_url as string) ?? link.url);
    setEditVideoCaption((link.metadata?.caption as string) ?? "");
    /* music 수정 초기값 */
    setEditMusicUrl((link.metadata?.music_url as string) ?? link.url);
    setEditMusicCaption((link.metadata?.caption as string) ?? "");
  };

  /* ── 타입별 라벨 ── */
  const getTypeLabel = (type: string) => {
    const found = CONTENT_TYPES.find((t) => t.type === type);
    return found ? `${found.emoji} ${found.label}` : type;
  };

  /* ── 그룹 항목 추가 (추가 폼) ── */
  const addGroupItem = () => {
    if (groupItems.length >= 10) return;
    setGroupItems((prev) => [...prev, { label: "", url: "" }]);
  };

  /* ── 그룹 항목 제거 (추가 폼) ── */
  const removeGroupItem = (idx: number) => {
    setGroupItems((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ── 그룹 항목 수정 (추가 폼) ── */
  const updateGroupItem = (idx: number, field: keyof GroupItem, value: string) => {
    setGroupItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    );
  };

  /* ── 그룹 항목 추가 (수정 폼) ── */
  const addEditGroupItem = () => {
    if (editGroupItems.length >= 10) return;
    setEditGroupItems((prev) => [...prev, { label: "", url: "" }]);
  };

  /* ── 그룹 항목 제거 (수정 폼) ── */
  const removeEditGroupItem = (idx: number) => {
    setEditGroupItems((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ── 그룹 항목 수정 (수정 폼) ── */
  const updateEditGroupItem = (idx: number, field: keyof GroupItem, value: string) => {
    setEditGroupItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    );
  };

  /* ── 공통 인풋 스타일 ── */
  const inputClass =
    "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="pt-20 pb-12">
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">
              🔗 메인 링크 <span className="text-primary">관리</span>
            </h1>
            <p className="mt-1 text-sm text-sub-text">
              메인 페이지에 노출될 콘텐츠를 추가·수정·순서 변경할 수 있습니다.
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowTypeModal(true); }}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110"
          >
            + 콘텐츠 추가
          </button>
        </div>

        {/* ── 타입 선택 모달 ── */}
        {showTypeModal && !selectedType && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-primary">콘텐츠 유형 선택</h2>
              <button
                onClick={() => setShowTypeModal(false)}
                className="text-sub-text hover:text-white transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct.type}
                  onClick={() => {
                    if (!ct.supported) return;
                    setSelectedType(ct.type as ContentType);
                  }}
                  disabled={!ct.supported}
                  className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                    ct.supported
                      ? "border-border hover:border-primary/60 hover:bg-background cursor-pointer"
                      : "border-border/30 opacity-40 cursor-not-allowed"
                  }`}
                >
                  <span className="text-2xl">{ct.emoji}</span>
                  <span className="text-xs text-sub-text leading-tight">{ct.label}</span>
                  {!ct.supported && (
                    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-border px-1.5 py-0.5 text-[9px] text-sub-text">
                      준비중
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── link 타입 추가 폼 ── */}
        {showTypeModal && selectedType === "link" && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">🔗 단일 링크 추가</h2>
              <button onClick={() => setSelectedType(null)} className="text-xs text-sub-text hover:text-white">← 뒤로</button>
            </div>
            <input
              type="text"
              placeholder="버튼 이름 (예: 인스타그램)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="URL (예: https://instagram.com/...)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className={inputClass}
            />
            {/* 썸네일 이미지 파일 업로드 */}
            <div className="space-y-1.5">
              <label className="text-xs text-sub-text">썸네일 이미지 (선택)</label>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={newThumbInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setNewThumbnailFile(file);
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setNewThumbnailPreview(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  } else {
                    setNewThumbnailPreview(null);
                  }
                  e.target.value = "";
                }}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => newThumbInputRef.current?.click()}
                  className="rounded-xl border border-border px-4 py-2 text-xs text-sub-text hover:border-primary/50 hover:text-primary transition-colors"
                >
                  파일 선택
                </button>
                {newThumbnailPreview && (
                  <>
                    <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-background flex-shrink-0">
                      <Image src={newThumbnailPreview} alt="썸네일 미리보기" fill className="object-cover" unoptimized />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setNewThumbnailFile(null); setNewThumbnailPreview(null); }}
                      className="text-xs text-sub-text hover:text-red-400 transition-colors"
                    >
                      제거
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={addContent}
                disabled={adding || uploadingThumb || !newTitle.trim() || !newUrl.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-50"
              >
                {adding || uploadingThumb ? "추가 중..." : "추가"}
              </button>
              <button
                onClick={() => { setShowTypeModal(false); resetForm(); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-sub-text hover:text-white transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── text 타입 추가 폼 ── */}
        {showTypeModal && selectedType === "text" && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">🅣 텍스트 추가</h2>
              <button onClick={() => setSelectedType(null)} className="text-xs text-sub-text hover:text-white">← 뒤로</button>
            </div>
            <textarea
              placeholder="표시할 텍스트 내용을 입력하세요"
              value={newTextContent}
              onChange={(e) => setNewTextContent(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder:text-sub-text/50 focus:border-primary focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={addContent}
                disabled={adding || !newTextContent.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-50"
              >
                {adding ? "추가 중..." : "추가"}
              </button>
              <button
                onClick={() => { setShowTypeModal(false); resetForm(); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-sub-text hover:text-white transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── spacer 타입 추가 폼 ── */}
        {showTypeModal && selectedType === "spacer" && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">⬜ 여백 추가</h2>
              <button onClick={() => setSelectedType(null)} className="text-xs text-sub-text hover:text-white">← 뒤로</button>
            </div>
            <div className="flex gap-2">
              {(["small", "medium", "large"] as SpacerSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setSpacerSize(size)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition-all ${
                    spacerSize === size
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-sub-text hover:text-white"
                  }`}
                >
                  {size === "small" ? "작게" : size === "medium" ? "보통" : "크게"}
                </button>
              ))}
            </div>
            {/* 여백 크기 미리보기 */}
            <div className="rounded-lg border border-border/50 bg-background p-2 flex flex-col items-center">
              <div className="w-full bg-border/20 rounded" style={{ height: spacerSize === "small" ? 16 : spacerSize === "medium" ? 32 : 64 }} />
              <span className="mt-1 text-[10px] text-sub-text/50">{spacerSize === "small" ? "16px" : spacerSize === "medium" ? "32px" : "64px"}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={addContent}
                disabled={adding}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-50"
              >
                {adding ? "추가 중..." : "즉시 추가"}
              </button>
              <button
                onClick={() => { setShowTypeModal(false); resetForm(); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-sub-text hover:text-white transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── group 타입 추가 폼 ── */}
        {showTypeModal && selectedType === "group" && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">🔗🔗 그룹 링크 추가</h2>
              <button onClick={() => setSelectedType(null)} className="text-xs text-sub-text hover:text-white">← 뒤로</button>
            </div>
            {/* 그룹 제목 입력 */}
            <input
              type="text"
              placeholder="그룹 제목 (예: SNS 채널)"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              className={inputClass}
            />
            {/* 링크 항목 목록 */}
            <div className="space-y-2">
              {groupItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      placeholder={`항목 ${idx + 1} 라벨`}
                      value={item.label}
                      onChange={(e) => updateGroupItem(idx, "label", e.target.value)}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      placeholder="URL"
                      value={item.url}
                      onChange={(e) => updateGroupItem(idx, "url", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  {/* 항목 삭제 버튼 (항목이 2개 이상일 때만) */}
                  {groupItems.length > 1 && (
                    <button
                      onClick={() => removeGroupItem(idx)}
                      className="mt-1 text-sub-text hover:text-red-400 transition-colors text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {/* 항목 추가 버튼 (최대 10개) */}
            {groupItems.length < 10 && (
              <button
                onClick={addGroupItem}
                className="w-full rounded-xl border border-dashed border-border py-2 text-xs text-sub-text hover:border-primary/50 hover:text-primary transition-colors"
              >
                + 항목 추가
              </button>
            )}
            <div className="flex gap-2">
              <button
                onClick={addContent}
                disabled={adding || !groupTitle.trim() || groupItems.every((it) => !it.label.trim() || !it.url.trim())}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-50"
              >
                {adding ? "추가 중..." : "추가"}
              </button>
              <button
                onClick={() => { setShowTypeModal(false); resetForm(); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-sub-text hover:text-white transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── sns 타입 추가 폼 ── */}
        {showTypeModal && selectedType === "sns" && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">📸 SNS 연결 추가</h2>
              <button onClick={() => setSelectedType(null)} className="text-xs text-sub-text hover:text-white">← 뒤로</button>
            </div>
            {/* 플랫폼 선택 드롭다운 */}
            <select
              value={snsPlatform}
              onChange={(e) => setSnsPlatform(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
            >
              {SNS_PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.emoji} {p.label}
                </option>
              ))}
            </select>
            {/* SNS URL 입력 */}
            <input
              type="text"
              placeholder={`${SNS_PLATFORMS.find((p) => p.value === snsPlatform)?.label ?? "SNS"} URL`}
              value={snsUrl}
              onChange={(e) => setSnsUrl(e.target.value)}
              className={inputClass}
            />
            <div className="flex gap-2">
              <button
                onClick={addContent}
                disabled={adding || !snsUrl.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-50"
              >
                {adding ? "추가 중..." : "추가"}
              </button>
              <button
                onClick={() => { setShowTypeModal(false); resetForm(); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-sub-text hover:text-white transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── video 타입 추가 폼 ── */}
        {showTypeModal && selectedType === "video" && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">▶️ 동영상 추가</h2>
              <button onClick={() => setSelectedType(null)} className="text-xs text-sub-text hover:text-white">← 뒤로</button>
            </div>
            {/* 유튜브 URL 입력 */}
            <input
              type="text"
              placeholder="유튜브 URL (예: https://youtu.be/xxxxx)"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className={inputClass}
            />
            {/* 캡션 입력 (선택) */}
            <input
              type="text"
              placeholder="캡션 (선택) — 미입력 시 '동영상'으로 저장"
              value={videoCaption}
              onChange={(e) => setVideoCaption(e.target.value)}
              className={inputClass}
            />
            <div className="flex gap-2">
              <button
                onClick={addContent}
                disabled={adding || !videoUrl.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-50"
              >
                {adding ? "추가 중..." : "추가"}
              </button>
              <button
                onClick={() => { setShowTypeModal(false); resetForm(); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-sub-text hover:text-white transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── music 타입 추가 폼 ── */}
        {showTypeModal && selectedType === "music" && (
          <div className="mt-6 rounded-xl border border-primary/40 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">🎵 음악 추가</h2>
              <button onClick={() => setSelectedType(null)} className="text-xs text-sub-text hover:text-white">← 뒤로</button>
            </div>
            {/* 음악 URL 입력 */}
            <input
              type="text"
              placeholder="유튜브 또는 사운드클라우드 URL"
              value={musicUrl}
              onChange={(e) => setMusicUrl(e.target.value)}
              className={inputClass}
            />
            {/* 캡션 입력 (선택) */}
            <input
              type="text"
              placeholder="캡션 (선택) — 미입력 시 '음악'으로 저장"
              value={musicCaption}
              onChange={(e) => setMusicCaption(e.target.value)}
              className={inputClass}
            />
            <div className="flex gap-2">
              <button
                onClick={addContent}
                disabled={adding || !musicUrl.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-50"
              >
                {adding ? "추가 중..." : "추가"}
              </button>
              <button
                onClick={() => { setShowTypeModal(false); resetForm(); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-sub-text hover:text-white transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── 링크 목록 ── */}
        <div className="mt-6 space-y-3">
          {links.length === 0 && (
            <div className="rounded-xl border border-border bg-card py-12 text-center text-sub-text">
              등록된 콘텐츠가 없습니다.
            </div>
          )}

          {links.map((link, index) => (
            <div
              key={link.id}
              className={`rounded-xl border bg-card transition-all ${
                link.is_active ? "border-border" : "border-border/40 opacity-50"
              }`}
            >
              {editingId === link.id ? (
                /* ── 수정 모드 ── */
                <div className="p-4 space-y-2">
                  {link.type === "text" ? (
                    /* 텍스트 타입 수정 */
                    <textarea
                      value={editTextContent}
                      onChange={(e) => setEditTextContent(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none resize-none"
                      placeholder="텍스트 내용"
                    />
                  ) : link.type === "spacer" ? (
                    /* 스페이서 타입 수정 */
                    <div className="flex gap-2">
                      {(["small", "medium", "large"] as SpacerSize[]).map((size) => (
                        <button
                          key={size}
                          onClick={() => setEditSpacerSize(size)}
                          className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition-all ${
                            editSpacerSize === size
                              ? "border-primary text-primary bg-primary/10"
                              : "border-border text-sub-text hover:text-white"
                          }`}
                        >
                          {size === "small" ? "작게" : size === "medium" ? "보통" : "크게"}
                        </button>
                      ))}
                    </div>
                  ) : link.type === "group" ? (
                    /* 그룹 링크 타입 수정 */
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editGroupTitle}
                        onChange={(e) => setEditGroupTitle(e.target.value)}
                        placeholder="그룹 제목"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      />
                      {editGroupItems.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                          <div className="flex-1 space-y-1">
                            <input
                              type="text"
                              placeholder={`항목 ${idx + 1} 라벨`}
                              value={item.label}
                              onChange={(e) => updateEditGroupItem(idx, "label", e.target.value)}
                              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                            />
                            <input
                              type="text"
                              placeholder="URL"
                              value={item.url}
                              onChange={(e) => updateEditGroupItem(idx, "url", e.target.value)}
                              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                            />
                          </div>
                          {editGroupItems.length > 1 && (
                            <button
                              onClick={() => removeEditGroupItem(idx)}
                              className="mt-1 text-sub-text hover:text-red-400 transition-colors text-sm"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      {editGroupItems.length < 10 && (
                        <button
                          onClick={addEditGroupItem}
                          className="w-full rounded-xl border border-dashed border-border py-2 text-xs text-sub-text hover:border-primary/50 hover:text-primary transition-colors"
                        >
                          + 항목 추가
                        </button>
                      )}
                    </div>
                  ) : link.type === "sns" ? (
                    /* SNS 타입 수정 */
                    <div className="space-y-2">
                      <select
                        value={editSnsPlatform}
                        onChange={(e) => setEditSnsPlatform(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      >
                        {SNS_PLATFORMS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.emoji} {p.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editSnsUrl}
                        onChange={(e) => setEditSnsUrl(e.target.value)}
                        placeholder="SNS URL"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      />
                    </div>
                  ) : link.type === "video" ? (
                    /* 동영상 타입 수정 */
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editVideoUrl}
                        onChange={(e) => setEditVideoUrl(e.target.value)}
                        placeholder="유튜브 URL"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      />
                      <input
                        type="text"
                        value={editVideoCaption}
                        onChange={(e) => setEditVideoCaption(e.target.value)}
                        placeholder="캡션 (선택)"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      />
                    </div>
                  ) : link.type === "music" ? (
                    /* 음악 타입 수정 */
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editMusicUrl}
                        onChange={(e) => setEditMusicUrl(e.target.value)}
                        placeholder="유튜브 또는 사운드클라우드 URL"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      />
                      <input
                        type="text"
                        value={editMusicCaption}
                        onChange={(e) => setEditMusicCaption(e.target.value)}
                        placeholder="캡션 (선택)"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      />
                    </div>
                  ) : (
                    /* link 타입 수정 */
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="버튼 이름"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      />
                      <input
                        type="text"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="URL"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      />
                      {/* 썸네일 이미지 파일 업로드 */}
                      <div className="space-y-1">
                        <label className="text-xs text-sub-text">썸네일 이미지 (선택)</label>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={editThumbInputRef}
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setEditThumbnailFile(file);
                            setEditThumbnailRemoved(false);
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => setEditThumbnailPreview(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                            e.target.value = "";
                          }}
                        />
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => editThumbInputRef.current?.click()}
                            className="rounded-xl border border-border px-4 py-2 text-xs text-sub-text hover:border-primary/50 hover:text-primary transition-colors"
                          >
                            파일 선택
                          </button>
                          {editThumbnailPreview && !editThumbnailRemoved && (
                            <>
                              <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-background flex-shrink-0">
                                <Image src={editThumbnailPreview} alt="썸네일 미리보기" fill className="object-cover" unoptimized />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditThumbnailFile(null);
                                  setEditThumbnailPreview(null);
                                  setEditThumbnailRemoved(true);
                                }}
                                className="text-xs text-sub-text hover:text-red-400 transition-colors"
                              >
                                제거
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => saveEdit(link)}
                      disabled={saving === link.id || uploadingEditThumb}
                      className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-background hover:brightness-110 disabled:opacity-50"
                    >
                      {saving === link.id || uploadingEditThumb ? "저장 중..." : "저장"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-border px-4 py-1.5 text-xs text-sub-text hover:text-white transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                /* ── 일반 모드 ── */
                <div className="flex items-center gap-3 p-4">
                  {/* 순서 화살표 */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveLink(index, "up")}
                      disabled={index === 0}
                      className="flex h-6 w-6 items-center justify-center rounded text-sub-text hover:text-white transition-colors disabled:opacity-20"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveLink(index, "down")}
                      disabled={index === links.length - 1}
                      className="flex h-6 w-6 items-center justify-center rounded text-sub-text hover:text-white transition-colors disabled:opacity-20"
                    >
                      ▼
                    </button>
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    {/* 타입 뱃지 */}
                    <p className="text-[10px] text-sub-text/60 mb-0.5">
                      {getTypeLabel(link.type)}
                    </p>
                    {link.type === "spacer" ? (
                      <p className="text-sm text-sub-text">
                        여백 — {(link.metadata?.size as string) ?? "medium"}
                      </p>
                    ) : link.type === "text" ? (
                      <p className="truncate text-sm text-sub-text">
                        {(link.metadata?.content as string)?.slice(0, 40) ?? link.title}
                      </p>
                    ) : link.type === "group" ? (
                      <>
                        <p className="truncate text-sm font-semibold text-white">{link.title}</p>
                        <p className="text-xs text-sub-text mt-0.5">
                          항목 {Array.isArray(link.metadata?.items) ? (link.metadata.items as GroupItem[]).length : 0}개
                        </p>
                      </>
                    ) : link.type === "sns" ? (
                      <>
                        <p className="truncate text-sm font-semibold text-white">
                          {SNS_PLATFORMS.find((p) => p.value === (link.metadata?.platform as string))?.emoji ?? ""} {link.title}
                        </p>
                        <p className="truncate text-xs text-sub-text mt-0.5">{link.url}</p>
                      </>
                    ) : link.type === "video" ? (
                      <>
                        <p className="truncate text-sm font-semibold text-white">{link.title}</p>
                        <p className="truncate text-xs text-sub-text mt-0.5">{link.url}</p>
                      </>
                    ) : link.type === "music" ? (
                      <>
                        <p className="truncate text-sm font-semibold text-white">{link.title}</p>
                        <p className="truncate text-xs text-sub-text mt-0.5">{link.url}</p>
                      </>
                    ) : (
                      /* link 타입 기본 표시 */
                      <>
                        <p className="truncate text-sm font-semibold text-white">
                          {link.title}
                        </p>
                        <p className="truncate text-xs text-sub-text mt-0.5">
                          {link.url}
                        </p>
                      </>
                    )}
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* 활성/비활성 토글 */}
                    <button
                      onClick={() => toggleActive(link)}
                      disabled={saving === link.id}
                      title={link.is_active ? "비활성화" : "활성화"}
                      className={`h-8 w-14 rounded-full transition-all duration-200 ${
                        link.is_active ? "bg-primary" : "bg-border"
                      }`}
                    >
                      <div
                        className={`mx-0.5 h-7 w-7 rounded-full bg-white shadow transition-transform duration-200 ${
                          link.is_active ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </button>

                    {/* 수정 */}
                    <button
                      onClick={() => startEdit(link)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-sub-text hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      수정
                    </button>

                    {/* 삭제 */}
                    <button
                      onClick={() => deleteLink(link.id)}
                      disabled={deleting === link.id}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-sub-text hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {deleting === link.id ? "..." : "삭제"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 미리보기 안내 */}
        {links.length > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-card/50 p-4 text-center">
            <p className="text-xs text-sub-text">
              활성화된 콘텐츠가 메인 페이지(
              <a href="/" target="_blank" className="text-primary hover:underline">
                /
              </a>
              )에 바로 반영됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
