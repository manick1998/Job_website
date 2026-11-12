import type { ReactNode } from "react";
import { DashboardShell } from "@/components/shell";
import { requireUser } from "@/lib/auth";
import { getNotifications } from "@/lib/queries/dashboards";

export const dynamic = "force-dynamic";

export default async function RecruiterLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("recruiter");
  const { unread } = await getNotifications(user.id, 1);
  return (
    <DashboardShell role="recruiter" userName={user.name} unread={unread}>
      {children}
    </DashboardShell>
  );
}
