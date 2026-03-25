"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

const navLinks = [
  { href: "/class", label: "Class" },
  { href: "/shop", label: "Shop" },
  { href: "/cart", label: "장바구니" },
  { href: "/mypage", label: "마이페이지" },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // 초기 세션 확인
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getUser();

    // 인증 상태 변경 구독
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsOpen(false);
    router.refresh();
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          <span className="text-primary">UNTITLED</span>PROJECTS
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sub-text font-medium transition-colors duration-200 hover:text-primary"
            >
              {link.label}
            </Link>
          ))}

          {loading ? (
            <div className="h-9 w-20 animate-pulse rounded-xl bg-card" />
          ) : user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-white">
                {displayName}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-sub-text transition-all duration-200 hover:border-primary hover:text-primary"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-background transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5"
            >
              로그인
            </Link>
          )}
        </nav>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="메뉴 열기"
        >
          <span
            className={`block h-0.5 w-6 bg-foreground transition-transform duration-300 ${isOpen ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-foreground transition-opacity duration-300 ${isOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-foreground transition-transform duration-300 ${isOpen ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden overflow-hidden border-t border-border bg-background"
          >
            <div className="flex flex-col gap-4 px-6 py-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="text-sub-text text-lg font-medium transition-colors hover:text-primary"
                >
                  {link.label}
                </Link>
              ))}

              {loading ? null : user ? (
                <>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-sm font-medium text-white">
                      {displayName}님
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="rounded-xl border border-border px-5 py-3 text-center font-semibold text-sub-text transition-all duration-200 hover:border-primary hover:text-primary"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="mt-2 rounded-xl bg-primary px-5 py-3 text-center font-semibold text-background transition-all duration-200 hover:brightness-110"
                >
                  로그인
                </Link>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
