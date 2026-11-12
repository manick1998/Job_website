import Link from "next/link";
import { forgotPasswordAction, resetPasswordAction } from "@/app/actions/auth";
import { ActionForm, Field } from "@/components/form";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const token = sp.token ?? "";

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 py-12">
      <Card className="w-full p-8">
        {token ? (
          <>
            <h1 className="text-2xl font-bold text-fg">Choose a new password</h1>
            <p className="mt-1 text-sm text-muted">This link expires 1 hour after it was sent.</p>
            <div className="mt-6">
              <ActionForm action={resetPasswordAction} submitLabel="Update password" pendingLabel="Updating…">
                <input type="hidden" name="token" value={token} />
                <Field name="password" label="New password" type="password" required autoComplete="new-password" hint="8+ characters with a letter and a number." />
                <Field name="confirmPassword" label="Confirm new password" type="password" required autoComplete="new-password" />
              </ActionForm>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-fg">Forgot your password?</h1>
            <p className="mt-1 text-sm text-muted">Enter your account email and we&apos;ll send a secure reset link.</p>
            <div className="mt-6">
              <ActionForm action={forgotPasswordAction} submitLabel="Send reset link" pendingLabel="Sending…">
                <Field name="email" label="Email" type="email" required autoComplete="email" />
              </ActionForm>
            </div>
          </>
        )}
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-semibold text-brand hover:underline">Back to login</Link>
        </p>
      </Card>
    </div>
  );
}
