import ShopDetailClient from "./ShopDetailClient";

/* ── 동적 렌더링 강제 ── */
export const dynamic = "force-dynamic";

/* ── 페이지 ── */
export default async function ShopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShopDetailClient productId={id} />;
}
