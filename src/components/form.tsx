"use client";

import { createContext, useActionState, useContext, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";

type FormCtxValue = { errors: Record<string, string>; values: Record<string, string> };
const FormCtx = createContext<FormCtxValue>({ errors: {}, values: {} });

const inputBase =
  "mt-1.5 w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15";

export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  pendingLabel = "Please wait…",
  className = "",
  encType,
  hideSubmit = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  className?: string;
  encType?: "multipart/form-data";
  hideSubmit?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    // method="post" guarantees that any pre-hydration fallback never places form data (e.g. passwords) in the URL.
    <form action={formAction} method="post" encType={encType} className={`space-y-5 ${className}`}>
      <FormCtx.Provider value={{ errors: state?.fieldErrors ?? {}, values: state?.values ?? {} }}>
        {state?.message && (
          <div
            role={state.ok ? "status" : "alert"}
            className={`rounded-xl border px-4 py-3 text-sm ${
              state.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
            }`}
          >
            {state.message}
          </div>
        )}
        {children}
        {!hideSubmit && <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />}
      </FormCtx.Provider>
    </form>
  );
}

export function SubmitButton({ label, pendingLabel = "Please wait…" }: { label: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-xl brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

type FieldProps = {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  as?: "input" | "textarea" | "select";
  options?: { value: string; label: string }[];
  rows?: number;
  autoComplete?: string;
  step?: string;
  min?: string | number;
  max?: string | number;
  accept?: string;
  className?: string;
  disabled?: boolean;
};

export function Field({
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
  required,
  hint,
  as = "input",
  options = [],
  rows = 4,
  autoComplete,
  step,
  min,
  max,
  accept,
  className = "",
  disabled,
}: FieldProps) {
  const { errors, values } = useContext(FormCtx);
  const error = errors[name];
  const value = values[name] ?? (defaultValue == null ? undefined : String(defaultValue));
  const cls = `${inputBase} ${error ? "border-red-500" : "border-line"}`;
  const common = { id: name, name, required, disabled, "aria-invalid": !!error, "aria-describedby": error ? `${name}-error` : undefined };

  return (
    <div className={className}>
      {type !== "checkbox" && (
        <label htmlFor={name} className="block text-sm font-medium text-fg">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {as === "textarea" ? (
        <textarea {...common} rows={rows} placeholder={placeholder} defaultValue={value} className={cls} />
      ) : as === "select" ? (
        <select {...common} defaultValue={value ?? ""} className={cls}>
          <option value="">{placeholder ?? "Select"}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={type}
          placeholder={placeholder}
          defaultValue={type === "file" ? undefined : value}
          autoComplete={autoComplete}
          step={step}
          min={min}
          max={max}
          accept={accept}
          className={type === "file" ? `${cls} file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-brand` : cls}
        />
      )}
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckField({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  const { values } = useContext(FormCtx);
  const checked = name in values ? values[name] === "on" : !!defaultChecked;
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3.5">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="mt-0.5 h-4 w-4 rounded border-line accent-indigo-600"
      />
      <span>
        <span className="block text-sm font-medium text-fg">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}
