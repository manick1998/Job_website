"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Briefcase, Menu, Moon, Sun, X } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { newsletterAction } from "@/app/actions/shared";
import { ActionForm, Field } from "@/components/form";
import { buttonClass, cn } from "@/components/ui";
import { SITE_NAME } from "@/lib/utils";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const height = size === "lg" ? "h-12" : size === "sm" ? "h-8" : "h-9";
  return (
    <Link href="/" className="inline-flex items-center" aria-label={`${SITE_NAME} home`}>
      <Image
        src="/logo.png"
        alt={`${SITE_NAME} logo`}
        width={140}
        height={78}
        priority
        className={cn(height, "w-auto select-none")}
      />
    </Link>
  );
}

function ThemeToggle() {
  // The theme script in <head> sets the `dark` class before hydration, so read
  // it lazily on the client. suppressHydrationWarning covers the icon/aria mismatch.
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      suppressHydrationWarning
      className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-fg hover:bg-surface-2"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

type HeaderUser = { name: string; role: "candidate" | "recruiter" | "admin"; dashboard: string } | null;

const NAV = [
  { href: "/jobs", label: "Search Jobs" },
  { href: "/companies", label: "Companies" },
  { href: "/career-advice", label: "Career Advice" },
  { href: "/salary-insights", label: "Salary Insights" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader({ user }: { user: HeaderUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Reset the mobile menu when the route changes (render-time, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-fg",
                  pathname?.startsWith(n.href) && "text-fg",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {user ? (
            <>
              <Link href={user.dashboard} className={buttonClass("secondary", "sm")}>
                Dashboard
              </Link>
              <form action={logoutAction}>
                <button type="submit" className={buttonClass("ghost", "sm")}>
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost", "sm")}>
                Login
              </Link>
              <Link href="/register" className={buttonClass("secondary", "sm")}>
                Register
              </Link>
              <Link href="/login?as=recruiter" className={buttonClass("secondary", "sm")}>
                Recruiter Login
              </Link>
            </>
          )}
          <Link href="/register?role=recruiter" className={buttonClass("primary", "sm")}>
            <Briefcase className="h-4 w-4" /> Post a Job
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation"
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-fg"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-line bg-surface px-4 py-4 lg:hidden">
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2.5 text-sm font-medium text-fg hover:bg-surface-2">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {user ? (
              <>
                <Link href={user.dashboard} className={buttonClass("secondary")}>
                  Dashboard
                </Link>
                <form action={logoutAction}>
                  <button type="submit" className={buttonClass("secondary", "md") + " w-full"}>
                    Logout
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className={buttonClass("secondary")}>
                  Login
                </Link>
                <Link href="/register" className={buttonClass("secondary")}>
                  Register
                </Link>
                <Link href="/login?as=recruiter" className={buttonClass("secondary")}>
                  Recruiter Login
                </Link>
              </>
            )}
            <Link href="/register?role=recruiter" className={cn(buttonClass("primary"), "col-span-2")}>
              Post a Job
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo size="lg" />
          <p className="mt-4 max-w-sm text-sm text-muted">
            Manick Job Portal connects skilled professionals and fresh graduates with verified employers across India. Built for
            Bharat&apos;s next million hires.
          </p>
          <div className="mt-6 max-w-sm">
            <p className="text-sm font-semibold text-fg">Get jobs in your inbox</p>
            <ActionForm action={newsletterAction} submitLabel="Subscribe" className="mt-3 space-y-2">
              <Field name="email" label="" type="email" placeholder="you@example.com" autoComplete="email" />
            </ActionForm>
          </div>
        </div>
        <FooterCol
          title="Job seekers"
          links={[
            ["Search jobs", "/jobs"],
            ["Fresher jobs", "/jobs?fresher=1"],
            ["Remote jobs", "/jobs?workMode=remote"],
            ["Walk-in interviews", "/jobs?q=walk-in"],
            ["Career advice", "/career-advice"],
          ]}
        />
        <FooterCol
          title="Employers"
          links={[
            ["Post a job", "/register?role=recruiter"],
            ["Recruiter login", "/login?as=recruiter"],
            ["Candidate search", "/recruiter/candidates"],
            ["Pricing", "/pricing"],
            ["Companies", "/companies"],
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            ["Salary insights", "/salary-insights"],
            ["Privacy & data", "/settings"],
            ["Register", "/register"],
            ["Login", "/login"],
          ]}
        />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Manick Job Portal Technologies Pvt. Ltd. All rights reserved.</p>
          <p>Personal data handled per the Digital Personal Data Protection Act, 2023.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-fg">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-sm text-muted hover:text-brand">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
