import { useText } from "@/i18n/use-text";
import type { ReactNode, ComponentProps } from "react";
import { ArrowRight, CheckCircle2, Circle, CircleAlert, Info, Layers3, PauseCircle } from "lucide-react";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return <button className={`ui-btn ${variant === "secondary" ? "" : "ui-btn-" + variant} ${className}`} {...props} />;
}
export function Input(props: ComponentProps<"input">) { return <input {...props} />; }
export function Select(props: ComponentProps<"select">) { return <select {...props} />; }
export function Checkbox(props: Omit<ComponentProps<"input">, "type">) { return <input type="checkbox" {...props} />; }
export function Card({ children, className = "", ...props }: ComponentProps<"section">) { return <section className={`ui-card p-6 ${className}`} {...props}>{children}</section>; }
export function PageHeader({ title, description, eyebrow, actions, status }: { title: string; description?: ReactNode; eyebrow?: string; actions?: ReactNode; status?: ReactNode }) {
  return <header className="mb-8 flex flex-wrap items-start justify-between gap-4"><div className="min-w-0">{eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-muted">{eyebrow}</p>}<div className="flex flex-wrap items-center gap-3"><h1 className="text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>{status}</div>{description && <div className="mt-3 max-w-2xl text-sm leading-6 text-muted">{description}</div>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</header>;
}
export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">{title}</h2>{description && <p className="mt-1 text-sm text-muted">{description}</p>}</div>{action}</div>;
}
const statuses: Record<string, { label: string; tone: "success" | "warning" | "danger" | "accent" | "muted" }> = {
  reverted: { label: "Revertido", tone: "success" },
  expired: { label: "Prévia expirada", tone: "muted" }, dispatching: { label: "Verificação pendente", tone: "warning" },
  preview: { label: "Aguardando confirmação", tone: "accent" }, running: { label: "Em andamento", tone: "accent" }, paused: { label: "Pausado", tone: "warning" }, completed: { label: "Concluído", tone: "success" }, limited: { label: "Cobertura parcial", tone: "warning" }, cancelled: { label: "Cancelado", tone: "muted" }, confirmed: { label: "Em aplicação", tone: "accent" }, disconnected: { label: "Reconectar", tone: "warning" }, connected: { label: "Vinculado", tone: "success" }, reviewed: { label: "Revisado", tone: "success" }, conflict: { label: "Alterado no Webflow", tone: "warning" }, failed: { label: "Falhou", tone: "danger" }, uncertain: { label: "Conferência necessária", tone: "warning" }, applied: { label: "Aplicado", tone: "success" }, already_applied: { label: "Já aplicado", tone: "success" }, draft: { label: "Rascunho", tone: "muted" }, ready: { label: "Pronto", tone: "success" },
};
const tones = { success: "bg-[var(--success-soft)] text-[var(--success)]", warning: "bg-[var(--warning-soft)] text-[var(--warning)]", danger: "bg-[var(--danger-soft)] text-[var(--danger)]", accent: "bg-accent-soft text-accent", muted: "bg-subtle text-muted" };
export function StatusBadge({ status, label }: { status: string; label?: string }) {
 const t = useText();

  const state = statuses[status] ?? { label: status, tone: "muted" as const };
  const Icon = status === "paused" ? PauseCircle : state.tone === "success" ? CheckCircle2 : ["warning", "danger"].includes(state.tone) ? CircleAlert : Circle;
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tones[state.tone]}`}><Icon size={13} aria-hidden="true" />{t(label ?? state.label)}</span>;
}
export function Notice({ children, tone = "info", title }: { children: ReactNode; tone?: "info" | "success" | "warning" | "danger"; title?: string }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : CircleAlert;
  return <div role={tone === "danger" ? "alert" : "status"} className={`my-4 flex items-start gap-3 rounded-xl border border-current/10 p-4 text-sm ${tones[tone === "info" ? "accent" : tone]}`}><Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><div className="min-w-0">{title && <p className="mb-1 font-semibold">{title}</p>}<div className="leading-6">{children}</div></div></div>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="rounded-xl border border-dashed p-8 text-center"><span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Layers3 size={20} aria-hidden="true" /></span><h3 className="font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
export function DataTable({ children, label }: { children: ReactNode; label: string }) { return <div role="region" aria-label={label} tabIndex={0} className="ui-card max-h-[640px] overflow-auto"><table className="ui-table">{children}</table></div>; }
export function Skeleton({ className = "" }: { className?: string }) { return <div aria-hidden="true" className={`ui-skeleton ${className}`} />; }
export function Progress({ value, max, label }: { value: number; max: number; label: string }) { return <progress className="w-full" value={value} max={Math.max(1, max)} aria-label={label} />; }
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  const t = useText();

  return <ol aria-label={t("Etapas")} className="my-6 flex flex-wrap gap-4 border-b pb-5">{steps.map((step, index) => <li key={step} aria-current={index === current ? "step" : undefined} className={`flex items-center gap-2 text-xs ${index === current ? "font-semibold text-accent" : "text-muted"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full ${index === current ? "bg-accent text-white" : "bg-subtle"}`}>{index < current ? <CheckCircle2 size={13} aria-hidden="true" /> : index + 1}</span>{t(step)}</li>)}</ol>;
}
export function Diff({ before, after }: { before: ReactNode; after: ReactNode }) {
  const t = useText();

  return <div className="mt-4 grid items-start gap-3 rounded-lg border bg-subtle/50 p-4 sm:grid-cols-[1fr_auto_1fr]"><div className="min-w-0"><p className="mb-2 text-xs font-medium text-muted">{t("Valor atual")}</p><div className="whitespace-pre-wrap break-words text-sm">{before}</div></div><ArrowRight size={16} className="mt-1 text-faint sm:mt-8" aria-hidden="true" /><div className="min-w-0"><p className="mb-2 text-xs font-medium text-accent">{t("Novo valor")}</p><div className="whitespace-pre-wrap break-words text-sm font-medium">{after}</div></div></div>;
}

export function ContextHelp({title,children,className=""}:{title:string;children:ReactNode;className?:string}) {
 return <details className={`ui-help ${className}`}><summary>{title}</summary><div className="space-y-2 leading-6">{children}</div></details>;
}
