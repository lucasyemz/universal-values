"use client";

// Text always uses the same control while typing, keeping focus and selection.
export function ReplacementInput({ text, value, onChange, longText = false, descriptionId, placeholder, disabled }: {
  text: boolean; value: string; onChange: (value: string) => void; longText?: boolean;
  descriptionId?: string; placeholder?: string; disabled?: boolean;
}) {
  const className = "mt-2 block w-full rounded border bg-white p-3 text-sm leading-7";
  return text ? <textarea value={value} onChange={event => onChange(event.target.value)} rows={longText ? 6 : 3}
    disabled={disabled} aria-describedby={descriptionId} placeholder={placeholder}
    className={className + " min-h-28 max-h-[32rem] resize-y"} /> :
    <input value={value} onChange={event => onChange(event.target.value)} disabled={disabled}
      aria-describedby={descriptionId} placeholder={placeholder} className={className} />;
}
