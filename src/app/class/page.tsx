import { createClient as createServiceClient } from "@supabase/supabase-js";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
}

async function getActiveCourses(): Promise<CourseRow[]> {
  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabase
      .from("courses")
      .select("id, title, description, thumbnail_url, price")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function CourseListPage() {
  const courses = await getActiveCourses();

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* 헤더 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white md:text-4xl">
            온라인 <span className="text-primary">강의</span>
          </h1>
          <p className="mt-3 text-base text-sub-text">
            언제 어디서나 원하는 속도로 배우세요.
          </p>
        </div>

        {/* 강좌 목록 */}
        {courses.length === 0 ? (
          <div className="mt-20 text-center">
            <p className="text-5xl mb-6">🎬</p>
            <h2 className="text-xl font-bold text-white mb-3">
              강의 준비 중입니다
            </h2>
            <p className="text-sm text-sub-text">
              곧 새로운 온라인 강의로 찾아올게요!
            </p>
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/class/${course.id}`}
                className="group block overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
              >
                {/* 썸네일 */}
                <div className="relative aspect-video w-full bg-background">
                  {course.thumbnail_url ? (
                    <Image
                      src={course.thumbnail_url}
                      alt={course.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">
                      🎬
                    </div>
                  )}
                </div>

                {/* 정보 */}
                <div className="p-5">
                  <h2 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                    {course.title}
                  </h2>
                  {course.description && (
                    <p className="mt-2 text-sm text-sub-text line-clamp-2 leading-relaxed">
                      {course.description}
                    </p>
                  )}
                  <p className="mt-4 font-display text-xl font-bold text-primary">
                    ₩{course.price.toLocaleString("ko-KR")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
