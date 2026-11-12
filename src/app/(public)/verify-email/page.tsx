import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { resendVerificationAction, verifyEmailToken } from "@/app/actions/auth";
import { ActionForm } from "@/components/form";
import { Card, Notice, buttonClass } from "@/components/ui";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { dashboardPathFor, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;

  if (sp.token) {
    const result = await verifyEmailToken(sp.token);
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 py-12">
        <Card className="w-full p-8 text-center">
          {result === "ok" ? (
            <>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-2xl text-emerald-600">✓</div>
              <h1 className="mt-4 text-2xl font-bold text-fg">Email verified</h1>
              <p className="mt-2 text-sm text-muted">Your account is active. Log in to continue.</p>
              <Link href="/login?verified=1" className={`${buttonClass("primary")} mt-6`}>Continue to login</Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-fg">Link invalid or expired</h1>
              <p className="mt-2 text-sm text-muted">Log in and request a new verification link.</p>
              <Link href="/login" className={`${buttonClass("secondary")} mt-6`}>Go to login</Link>
            </>
          )}
        </Card>
      </div>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerifiedAt || user.role === "admin") redirect(dashboardPathFor(user.role));

  // Development convenience: surface the latest verification link when no email provider is configured.
  let devLink: string | null = null;
  if (process.env.NODE_ENV !== "production") {
    const [mail] = await db
      .select({ body: emailLog.body })
      .from(emailLog)
      .where(and(eq(emailLog.toEmail, user.email), eq(emailLog.kind, "verify_email")))
      .orderBy(desc(emailLog.createdAt))
      .limit(1);
    devLink = mail?.body.match(/https?:\/\/\S+\/verify-email\?token=\S+/)?.[0] ?? null;
  }

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 py-12">
      <Card className="w-full space-y-5 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-2xl">✉️</div>
        <h1 className="text-2xl font-bold text-fg">Verify your email</h1>
        <p className="text-sm text-muted">
          We sent a verification link to <strong className="text-fg">{user.email}</strong>. Click it to activate your account. The link expires in 24 hours.
        </p>
        {devLink && (
          <Notice tone="info">
            Development mode — no email provider is configured. <a className="break-all font-semibold underline" href={devLink}>Open verification link</a>
          </Notice>
        )}
        <ActionForm action={resendVerificationAction} submitLabel="Resend verification email" pendingLabel="Sending…">
          <span />
        </ActionForm>
        <Link href="/" className="block text-sm font-semibold text-brand hover:underline">Continue browsing</Link>
      </Card>
    </div>
  );
}
