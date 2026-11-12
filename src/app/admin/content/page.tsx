import Link from "next/link";
import { createBlogPostAction, createCategoryAction, deleteBlogPostAction } from "@/app/actions/admin";
import { ActionForm, Field } from "@/components/form";
import { Badge, Card, PageHeader, buttonClass } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { listAllBlogPosts, listCategoriesWithCounts } from "@/lib/queries/admin";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const [posts, categories] = await Promise.all([listAllBlogPosts(), listCategoriesWithCounts()]);
  return (
    <>
      <PageHeader title="Content" description="Career advice articles and job taxonomy (categories used across search and homepage)." />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-bold text-fg">Career advice articles</h2>
            <div className="mt-4 divide-y divide-line">
              {posts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/career-advice/${p.slug}`} className="truncate font-semibold text-fg hover:text-brand">{p.title}</Link>
                    <p className="text-xs text-muted">{p.category} · {formatDate(p.createdAt)}</p>
                  </div>
                  <form action={deleteBlogPostAction}>
                    <input type="hidden" name="postId" value={p.id} />
                    <ConfirmButton message="Delete this article?" className={buttonClass("danger", "sm")}>Delete</ConfirmButton>
                  </form>
                </div>
              ))}
              {posts.length === 0 && <p className="py-4 text-sm text-muted">No articles yet.</p>}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-bold text-fg">Job categories</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((c) => (
                <Badge key={c.id} tone="brand">{c.name} · {c.jobs}</Badge>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-bold text-fg">Publish an article</h2>
            <div className="mt-4">
              <ActionForm action={createBlogPostAction} submitLabel="Publish article" pendingLabel="Publishing…">
                <Field name="title" label="Title" required />
                <Field name="category" label="Category" required placeholder="Resume tips" />
                <Field name="excerpt" label="Excerpt" placeholder="One-line summary" />
                <Field as="textarea" rows={8} name="body" label="Body (paragraphs separated by blank lines)" required />
              </ActionForm>
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-bold text-fg">Add a job category</h2>
            <div className="mt-4">
              <ActionForm action={createCategoryAction} submitLabel="Add category" pendingLabel="Adding…">
                <Field name="name" label="Category name" required placeholder="Supply Chain" />
                <Field name="description" label="Description (optional)" />
              </ActionForm>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
