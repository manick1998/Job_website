import Link from "next/link";
import { Badge, EmptyState } from "@/components/ui";
import { listBlogPosts } from "@/lib/queries/jobs";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Career advice", description: "Resume tips, interview prep and career guidance for Indian professionals." };

export default async function CareerAdvicePage() {
  const posts = await listBlogPosts(true);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-fg">Career advice</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Practical guides on resumes, interviews, salary negotiation and growing your career in India.</p>
      {posts.length ? (
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.id} href={`/career-advice/${p.slug}`} className="flex flex-col rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
              <Badge tone="sky">{p.category}</Badge>
              <h2 className="mt-4 text-lg font-semibold leading-snug text-fg">{p.title}</h2>
              <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{p.excerpt}</p>
              <p className="mt-5 text-xs text-muted">{p.authorName} · {formatDate(p.createdAt)}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-10"><EmptyState title="No articles yet" text="Our editors are writing the first guides." /></div>
      )}
    </div>
  );
}
