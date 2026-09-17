import { z } from "zod";
import { auditSchema, type AuditEvent, type AuditStore } from "../../../modules/static-text/apply";

const storageKey = "universal-values:designer-poc:audit:v1";
export class LocalAuditStore implements AuditStore {
  load(): AuditEvent[] {
    const raw = localStorage.getItem(storageKey);
    return raw ? z.array(auditSchema).parse(JSON.parse(raw)) : [];
  }
  append(event: AuditEvent) {
    const events = this.load();
    events.push(auditSchema.parse(event));
    localStorage.setItem(storageKey, JSON.stringify(events));
  }
  export() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(this.load(), null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "universal-values-designer-audit.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
