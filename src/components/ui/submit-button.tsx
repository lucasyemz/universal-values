"use client";
import { useText } from "@/i18n/use-text";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "./index";

export function SubmitButton({ children, pendingLabel = "Preparando…", disabled, ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const t = useText();

  const { pending } = useFormStatus();
  return <Button type="submit" disabled={disabled || pending} aria-busy={pending} {...props}>{pending ? <><LoaderCircle size={16} className="animate-spin" aria-hidden="true"/>{t(pendingLabel)}</> : children}</Button>;
}
