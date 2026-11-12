"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Bell,
  BarChart3,
  Bookmark,
  Briefcase,
  Building2,
  FileText,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Flag,
  Newspaper,
  Users,
  UserCircle,
  ClipboardList,
  Mail,
  Database,
} from "lucide-react";
import { Logo } from "@/components/site";
import { cn } from "@/components/ui";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const NAV: Record<"candidate" | "recruiter" | "admin", NavItem[]> = {
  candidate: [
    { href: "/candidate/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/candidate/profile", label: "My Profile", icon: UserCircle },
    { href: "/candidate/resumes", label: "Resumes", icon: FileText },
    { href: "/candidate/applications", label: "Applications", icon: ClipboardList },
    { href: "/candidate/saved", label: "Saved & Alerts", icon: Bookmark },
    { href: "/jobs", label: "Search Jobs", icon: Search },
    { href: "/inbox", label: "Inbox", icon: Bell },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
  recruiter: [
    { href: "/recruiter", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/recruiter/jobs", label: "Jobs", icon: Briefcase },
    { href: "/recruiter/jobs/new", label: "Post a Job", icon: Plus },
    { href: "/recruiter/candidates", label: "Candidate Search", icon: Users },
    { href: "/recruiter/company", label: "Company & Team", icon: Building2 },
    { href: "/inbox", label: "Inbox", icon: Mail },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
  admin: [
    { href: "/admin", label: "Overview", icon: BarChart3, exact: true },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/jobs", label: "Jobs", icon: Briefcase },
    { href: "/admin/companies", label: "Companies", icon: Building2 },
    { href: "/admin/reports", label: "Reports", icon: Flag },
    { href: "/admin/content", label: "Content", icon: Newspaper },
    { href: "/admin/system", label: "System", icon: Database },
    { href: "/inbox", label: "Inbox", icon: Mail },
  ],
};

const ROLE_LABEL = { candidate: "Job seeker", recruiter: "Recruiter", admin: "Administrator" } as const;

export function DashboardShell({
  role,
  userName,
  children,
  unread = 0,
}: {
  role: "candidate" | "recruiter" | "admin";
  userName: string;
  children: ReactNode;
  unread?: number;
}) {
  const pathname = usePathname() ?? "";
  const items = NAV[role];
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-fg">{userName}</p>
              <p className="text-xs text-muted">
                {ROLE_LABEL[role]}
                {unread > 0 && <span className="ml-2 rounded-full bg-brand px-1.5 text-[10px] text-white">{unread} new</span>}
              </p>
            </div>
            <div className="brand-gradient grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white">
              {userName.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:py-8">
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav aria-label="Dashboard" className="sticky top-24 space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
                    active ? "bg-surface text-brand shadow-sm ring-1 ring-line" : "text-muted hover:bg-surface hover:text-fg",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <nav aria-label="Dashboard mobile" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
            {items.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium",
                    active ? "border-brand bg-brand text-white" : "border-line bg-surface text-muted",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="animate-fade-up">{children}</div>
        </div>
      </div>
    </div>
  );
}

