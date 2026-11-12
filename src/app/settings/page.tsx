import Link from "next/link";
import { requireUser, dashboardPathFor } from "@/lib/auth";
import { changePasswordAction, deleteAccountAction } from "@/app/actions/shared";
import { ActionForm, Field } from "@/components/form";
import { Badge, Card, PageHeader, buttonClass } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const current = await getCurrentUser();
  return (
    <>
      <PageHeader title="Account settings" description="Security, privacy and your data." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <h2 className="font-bold text-fg">Account</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-muted">Name</dt>
            <dd className="text-fg">{user.name}</dd>
            <dt className="text-muted">Email</dt>
            <dd className="text-fg">{user.email}</dd>
            <dt className="text-muted">Role</dt>
            <dd><Badge tone="brand">{user.role}</Badge></dd>
            <dt className="text-muted">Email verified</dt>
            <dd className="text-fg">{current?.emailVerifiedAt ? formatDate(current.emailVerifiedAt) : "Not yet"}</dd>
          </dl>
          <Link href={dashboardPathFor(user.role)} className={buttonClass("secondary", "sm")}>Go to dashboard</Link>
        </Card>

        <Card className="p-6">
          <h2 className="font-bold text-fg">Change password</h2>
          <div className="mt-5">
            <ActionForm action={changePasswordAction} submitLabel="Update password" pendingLabel="Updating…">
              <Field name="currentPassword" label="Current password" type="password" required autoComplete="current-password" />
              <Field name="newPassword" label="New password" type="password" required autoComplete="new-password" hint="8+ characters with a letter and a number." />
            </ActionForm>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="font-bold text-fg">Your data (DPDP Act)</h2>
          <p className="text-sm text-muted">Download a complete JSON copy of your profile, resumes metadata, applications and notifications.</p>
          <a href="/api/account/export" className={buttonClass("secondary")}>Download my data</a>
        </Card>

        <Card className="border-red-200 p-6 dark:border-red-500/30">
          <h2 className="font-bold text-red-700 dark:text-red-400">Delete account</h2>
          <p className="mt-1 text-sm text-muted">Permanently removes your profile, resumes, applications and messages. This cannot be undone.</p>
          <div className="mt-5">
            <ActionForm action={deleteAccountAction} submitLabel="Delete my account" pendingLabel="Deleting…">
              <Field name="password" label="Confirm your password" type="password" required autoComplete="current-password" />
              <Field name="confirm" label="Type DELETE to confirm" required placeholder="DELETE" />
            </ActionForm>
          </div>
        </Card>
      </div>
    </>
  );
}
