"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { BrandMark } from "./BrandMark";

const NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/financiero", label: "Financiero" },
  { href: "/prensa-general", label: "Prensa general" },
  { href: "/archivo", label: "Fue noticia" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-(--border-strong) bg-(--background)/95 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0"
            onClick={() => setMenuOpen(false)}
          >
            <BrandMark size={28} />
            <span className="font-serif text-lg font-semibold tracking-tight">
              Matizal <span className="font-mono text-[13px] font-normal uppercase tracking-widest text-(--accent)">News</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 font-mono text-xs uppercase tracking-wider">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 transition-colors ${
                  isActive(pathname, item.href)
                    ? "text-(--foreground) border-b-2 border-(--accent)"
                    : "text-(--muted) hover:text-(--foreground)"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:block">
            <ThemeToggle />
          </div>

          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden flex flex-col justify-center gap-1.5 h-11 w-11 -mr-2 items-center cursor-pointer"
          >
            <span
              className={`block h-px w-6 bg-(--foreground) transition-transform ${
                menuOpen ? "translate-y-[3.5px] rotate-45" : ""
              }`}
            />
            <span
              className={`block h-px w-6 bg-(--foreground) transition-transform ${
                menuOpen ? "-translate-y-[3.5px] -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-(--border) bg-(--background)">
          <nav className="flex flex-col font-mono text-sm uppercase tracking-wider">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`px-4 py-3.5 border-b border-(--border) ${
                  isActive(pathname, item.href)
                    ? "text-(--accent)"
                    : "text-(--ink-2)"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="p-4">
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
}
