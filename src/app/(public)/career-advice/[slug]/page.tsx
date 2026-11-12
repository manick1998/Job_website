import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";
import { getBlogPost } from "@/lib/queries/jobs";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post || !post.published) notFound();
  const paragraphs = post.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/career-advice" className="text-sm font-semibold text-brand hover:underline">← Career advice</Link>
      <div className="mt-6 flex items-center gap-2">
        <Badge tone="sky">{post.category}</Badge>
        <span className="text-xs text-muted">{formatDate(post.createdAt)}</span>
      </div>
      <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-fg">{post.title}</h1>
      <p className="mt-3 text-sm text-muted">By {post.authorName}</p>
      {post.excerpt && <p className="mt-6 border-l-4 border-brand pl-4 text-lg text-muted">{post.excerpt}</p>}
      <div className="mt-8 space-y-5 text-base leading-relaxed text-fg/90">
        {paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
      </div>
      <div className="mt-12 rounded-2xl border border-line bg-surface p-6">
        <p className="font-semibold text-fg">Ready to put this into practice?</p>
        <Link href="/jobs" className="mt-3 inline-flex text-sm font-semibold text-brand hover:underline">Browse live jobs →</Link>
      </div>
    </article>
  );
}
