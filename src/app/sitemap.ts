import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * /sitemap.xml — 네이버 서치어드바이저·구글 서치콘솔에 제출하는 페이지 목록.
 * 공개 페이지만 포함. 새 공개 페이지가 생기면 여기에 추가.
 * 메인(/)은 링크 허브라 검색 대표 페이지가 되지 않도록 의도적으로 제외 (page.tsx 에 noindex).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${SITE_URL}/production`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/checklist`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/shop`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/class`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/course`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.1,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.1,
    },
  ];
}
