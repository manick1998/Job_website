"use client";

import type { ReactNode } from "react";

/** Submit button that asks for confirmation before a destructive server action runs. */
export function ConfirmButton({
  message,
  children,
  className,
  name,
  value,
}: {
  message: string;
  children: ReactNode;
  className?: string;
  name?: string;
  value?: string;
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
