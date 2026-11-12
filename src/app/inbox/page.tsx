import { requireUser } from "@/lib/auth";
import { getInbox, getNotifications } from "@/lib/queries/dashboards";
import { deleteNotificationAction, markAllNotificationsReadAction, markMessageReadAction, sendMessageAction } from "@/app/actions/shared";
import { ActionForm, Field } from "@/components/form";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { timeAgo, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await requireUser();
  const [{ rows: notes, unread }, messages] = await Promise.all([getNotifications(user.id), getInbox(user.id)]);
  const received = messages.filter((m) => m.recipientId === user.id);

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Notifications, application updates and recruiter messages."
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className={buttonClass("secondary", "sm")}>Mark all as read ({unread})</button>
            </form>
          ) : null
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-lg font-bold text-fg">Notifications</h2>
          <div className="space-y-3">
            {notes.map((n) => (
              <Card key={n.id} className={`flex items-start gap-4 p-4 ${n.readAt ? "" : "border-brand/40 ring-1 ring-brand/20"}`}>
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.readAt ? "bg-line" : "bg-brand"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-fg">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted">{timeAgo(n.createdAt)}{n.link && <> · <a href={n.link} className="font-semibold text-brand hover:underline">Open</a></>}</p>
                </div>
                <form action={deleteNotificationAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <ConfirmButton message="Delete this notification?" className="text-xs font-semibold text-muted hover:text-red-600">Delete</ConfirmButton>
                </form>
              </Card>
            ))}
            {notes.length === 0 && <EmptyState title="You're all caught up" text="Application updates and job alerts will appear here." />}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-bold text-fg">Messages</h2>
          <div className="space-y-3">
            {messages.map((m) => {
              const incoming = m.recipientId === user.id;
              return (
                <Card key={m.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-fg">
                      {incoming ? `From ${m.senderName}` : `To you · sent by ${user.name}`}
                      {m.jobTitle && <span className="font-normal text-muted"> · {m.jobTitle}</span>}
                    </p>
                    {incoming && !m.readAt ? <Badge tone="brand">New</Badge> : null}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-fg/90">{m.body}</p>
                  <p className="mt-2 text-xs text-muted">{formatDateTime(m.createdAt)}</p>
                  {incoming && !m.readAt && (
                    <form action={markMessageReadAction} className="mt-2">
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="text-xs font-semibold text-brand hover:underline">Mark as read</button>
                    </form>
                  )}
                  {m.applicationId && incoming && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-brand">Reply</summary>
                      <div className="mt-3">
                        <ActionForm action={sendMessageAction} submitLabel="Send reply" pendingLabel="Sending…">
                          <input type="hidden" name="applicationId" value={m.applicationId} />
                          <Field as="textarea" rows={2} name="body" label="Message" required />
                        </ActionForm>
                      </div>
                    </details>
                  )}
                </Card>
              );
            })}
            {messages.length === 0 && <EmptyState title="No messages" text="Recruiters can message you about your applications here." />}
          </div>
        </section>
      </div>
      <p className="mt-8 text-xs text-muted">{received.length} received · {messages.length} total</p>
    </>
  );
}
