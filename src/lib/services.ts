import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { auditLogs, emailLog, notifications } from "@/db/schema";

/* ---------- Email (Resend). Falls back to outbox-only when RESBEND_API_KEY is unset. ---------- */
let _resend: import("resend").Resend | null = null;
function resend() {
  if (_resend) return _resend;
  if (!process.env.RESEND_API_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Resend } = require("resend");
  _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export async function sendEmail(input: { to: string; subject: string; text: string; kind: string }) {
  // Always log to the outbox for audit trail
  await db.insert(emailLog).values({
    toEmail: input.to,
    subject: input.subject,
    body: input.text,
    kind: input.kind,
  });
  console.info(`[email:${input.kind}] to=${input.to} subject="${input.subject}"`);

  // Actually send via Resend if configured
  const client = resend();
  if (!client) return;
  try {
    await client.emails.send({
      from: process.env.EMAIL_FROM || "Manick Job Portal <onboarding@resend.dev>",
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email:${input.kind}] Resend send failed: ${msg}`);
  }
}

/* ---------- In-app notifications ---------- */
export async function notify(input: { userId: string; type: string; title: string; body?: string; link?: string }) {
  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
  });
}

/* ---------- Audit log ---------- */
export async function audit(input: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
}

/* ---------- Rate limiting (in-memory; swap for Redis in multi-instance deployments) ---------- */
const buckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

/* ---------- File storage (local disk adapter; S3-compatible adapter slot) ---------- */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export function validateResume(buf: Buffer, mime: string, size: number): { ext: "pdf" | "docx" } | { error: string } {
  if (size <= 0) return { error: "The file is empty." };
  if (size > MAX_RESUME_BYTES) return { error: "Resume must be 5 MB or smaller." };
  if (mime === "application/pdf" && buf.subarray(0, 4).toString("ascii") === "%PDF") return { ext: "pdf" };
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    buf[2] === 0x03 &&
    buf[3] === 0x04
  ) {
    return { ext: "docx" };
  }
  return { error: "Only PDF or DOCX resumes are accepted (file content is verified)." };
}

export async function saveUpload(buf: Buffer, ext: string, folder: string) {
  const key = `${folder}/${randomUUID()}.${ext}`;
  const full = path.join(UPLOAD_DIR, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf);
  return key;
}

function resolveKey(key: string) {
  // Path traversal guard: the resolved file must stay inside UPLOAD_DIR.
  const full = path.resolve(/*turbopackIgnore: true*/ UPLOAD_DIR, key);
  if (!full.startsWith(path.resolve(/*turbopackIgnore: true*/ UPLOAD_DIR) + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function readUpload(key: string) {
  return readFile(/*turbopackIgnore: true*/ resolveKey(key));
}

export async function deleteUpload(key: string) {
  await unlink(/*turbopackIgnore: true*/ resolveKey(key)).catch(() => undefined);
}
