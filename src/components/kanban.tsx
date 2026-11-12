"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PIPELINE_COLUMNS, APPLICATION_STATUS_LABEL } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

export type KanbanCard = {
  id: string;
  candidateName: string;
  headline: string | null;
  status: string;
  rating: number | null;
  matchScore: number | null;
  appliedAt: string;
};

type MoveAction = (applicationId: string, toStatus: string) => Promise<ActionState>;

export function KanbanBoard({ cards, moveAction }: { cards: KanbanCard[]; moveAction: MoveAction }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const move = (cardId: string, toKey: string) => {
    const col = PIPELINE_COLUMNS.find((c) => c.key === toKey);
    const card = cards.find((c) => c.id === cardId);
    if (!col || !card || col.statuses.includes(card.status as never)) return;
    startTransition(async () => {
      const res = await moveAction(cardId, col.moveTo);
      setMessage(res?.message ?? null);
      router.refresh();
    });
  };

  return (
    <div>
      {message && (
        <p role="status" className="mb-3 text-sm text-muted">
          {message}
        </p>
      )}
      <div className="grid gap-4 overflow-x-auto pb-4 md:grid-flow-col md:auto-cols-[minmax(230px,1fr)]">
        {PIPELINE_COLUMNS.map((col) => {
          const items = cards.filter((c) => (col.statuses as readonly string[]).includes(c.status));
          return (
            <section
              key={col.key}
              aria-label={`${col.label} column, ${items.length} candidates`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverKey(col.key);
              }}
              onDragLeave={() => setOverKey((k) => (k === col.key ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                setOverKey(null);
                const id = e.dataTransfer.getData("text/plain") || dragId;
                if (id) move(id, col.key);
                setDragId(null);
              }}
              className={`flex min-h-[320px] flex-col rounded-2xl border p-3 transition ${
                overKey === col.key ? "border-brand bg-surface-2" : "border-line bg-surface"
              }`}
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-fg">{col.label}</h3>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-brand">{items.length}</span>
              </header>
              <div className="flex flex-1 flex-col gap-2.5">
                {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">Drop candidates here</p>}
                {items.map((c) => (
                  <article
                    key={c.id}
                    draggable={!pending}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(c.id);
                    }}
                    onDragEnd={() => setDragId(null)}
                    className={`cursor-grab rounded-xl border border-line bg-bg p-3.5 shadow-sm active:cursor-grabbing ${
                      dragId === c.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/recruiter/applications/${c.id}`} className="text-sm font-semibold text-fg hover:text-brand">
                        {c.candidateName}
                      </Link>
                      {c.matchScore != null && (
                        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          {c.matchScore}%
                        </span>
                      )}
                    </div>
                    {c.headline && <p className="mt-1 line-clamp-2 text-xs text-muted">{c.headline}</p>}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                      <span>{APPLICATION_STATUS_LABEL[c.status]}</span>
                      <span>{c.rating ? "★".repeat(c.rating) : "Unrated"}</span>
                    </div>
                    <label className="mt-2.5 block">
                      <span className="sr-only">Move {c.candidateName}</span>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) move(c.id, e.target.value);
                          e.target.value = "";
                        }}
                        className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-fg"
                      >
                        <option value="">Move to…</option>
                        {PIPELINE_COLUMNS.filter((o) => o.key !== col.key).map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
