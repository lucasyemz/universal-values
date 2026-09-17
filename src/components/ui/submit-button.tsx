"use client";
import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "./index";

export function SubmitButton({ children, pendingLabel = "Preparando…", disabled, ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={disabled || pending} aria-busy={pending} {...props}>{pending ? pendingLabel : children}</Button>;
}
