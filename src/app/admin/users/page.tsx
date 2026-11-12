import Link from "next/link";
import { changeUserRoleAction, deleteUserAction, setUserStatusAction, verifyUserEmailAction } from "@/app/actions/admin";
import { requireUser } from "@/lib/auth";
import { listUsers } from "@/lib/queries/admin";
import { Badge, Card, EmptyState, PageHeader, Pagination, buttonClass } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { formatDate, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const field = "rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireUser("admin");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const result = await listUsers({ q: sp.q, role: sp.role, status: sp.status, page });
  const params = { q: sp.q, role: sp.role, status: sp.status };

  return (
    <>
      <PageHeader title="Users" description={`${result.total.toLocaleString("en-IN")} accounts match your filters.`} />

      <form method="get" className="mb-6 flex flex-wrap gap-3">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name or email" className={`${field} min-w-64 flex-1`} />
        <select name="role" defaultValue={sp.role ?? ""} className={field}>
          <option value="">All roles</option>
          <option value="candidate">Candidates</option>
          <option value="recruiter">Recruiters</option>
          <option value="admin">Admins</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={field}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button type="submit" className={buttonClass("primary", "sm")}>Filter</button>
        <Link href="/admin/users" className={buttonClass("secondary", "sm")}>Reset</Link>
      </form>

      {result.items.length === 0 ? (
        <EmptyState title="No users found" text="Try a different search or role filter." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.items.map((u) => {
                const self = u.id === admin.id;
                return (
                  <tr key={u.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-fg">{u.name}</p>
                      <p className="text-xs text-muted">{u.email}</p>
                      {!u.emailVerifiedAt && <Badge tone="amber">Email unverified</Badge>}
                    </td>
                    <td className="px-4 py-3"><Badge tone="brand">{u.role}</Badge></td>
                    <td className="px-4 py-3">{u.status === "active" ? <Badge tone="green">Active</Badge> : <Badge tone="red">Suspended</Badge>}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</td>
                    <td className="px-4 py-3">
                      {self ? (
                        <span className="block text-right text-xs text-muted">You</span>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          {!u.emailVerifiedAt && (
                            <form action={verifyUserEmailAction}>
                              <input type="hidden" name="userId" value={u.id} />
                              <button type="submit" className={buttonClass("secondary", "sm")}>Verify</button>
                            </form>
                          )}
                          <form action={setUserStatusAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="status" value={u.status === "active" ? "suspended" : "active"} />
                            <ConfirmButton
                              message={u.status === "active" ? `Suspend ${u.name}? They will be signed out.` : `Reactivate ${u.name}?`}
                              className={buttonClass(u.status === "active" ? "secondary" : "primary", "sm")}
                            >
                              {u.status === "active" ? "Suspend" : "Activate"}
                            </ConfirmButton>
                          </form>
                          <form action={changeUserRoleAction} className="flex gap-1">
                            <input type="hidden" name="userId" value={u.id} />
                            <select name="role" defaultValue={u.role} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-fg">
                              <option value="candidate">Candidate</option>
                              <option value="recruiter">Recruiter</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button type="submit" className={buttonClass("secondary", "sm")}>Set</button>
                          </form>
                          <form action={deleteUserAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <ConfirmButton message={`Permanently delete ${u.email}? This cannot be undone.`} className={buttonClass("danger", "sm")}>Delete</ConfirmButton>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <Pagination basePath="/admin/users" params={params} page={page} pages={result.pages} />
    </>
  );
}
