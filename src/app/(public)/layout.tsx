import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site";
import { dashboardPathFor, getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [user, maintenance] = await Promise.all([getCurrentUser(), getSetting("maintenance_mode")]);
  return (
    <div className="flex min-h-screen flex-col">
      {maintenance === "on" && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
          Manick Job Portal is under scheduled maintenance. Browsing works; new applications are paused.
        </div>
      )}
      <SiteHeader user={user ? { name: user.name, role: user.role, dashboard: dashboardPathFor(user.role) } : null} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
