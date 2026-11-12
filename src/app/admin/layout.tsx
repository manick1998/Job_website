import type { ReactNode } from "react";
import { DashboardShell } from "@/components/shell";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("admin");
  return (
    <DashboardShell role="admin" userName={user.name}>
      {children}
    </DashboardShell>
  );
}
