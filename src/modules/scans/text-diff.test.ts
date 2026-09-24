import { expect, it } from "vitest";
import { textDiff } from "./text-diff";

it("highlights separated replacements without marking unchanged context", () => {
 const diff = textDiff("A luxurious home with 3 rooms.", "A cozy home with 4 rooms.");
 expect(diff.before.filter(p=>p.changed).map(p=>p.text).join("")).toBe("luxurious3");
 expect(diff.after.filter(p=>p.changed).map(p=>p.text).join("")).toBe("cozy4");
});
it("preserves exact content including markup, whitespace, unicode and empty removals", () => {
 for (const [before,after] of [["<p>Olá 👋 empresa</p>","<p>Olá 👋 nova</p>"],["company", ""],["", "hello"],["same", "same"],["a  b", "a b"]]) {
  const diff=textDiff(before!,after!);
  expect(diff.before.map(p=>p.text).join("")).toBe(before);
  expect(diff.after.map(p=>p.text).join("")).toBe(after);
 }
 expect(textDiff("same","same").after.every(p=>!p.changed)).toBe(true);
 expect(textDiff("company","").before.every(p=>p.changed)).toBe(true);
});
it("bounds work on large differences while retaining strings", () => {
 const before="old ".repeat(1000), after="new ".repeat(1000);
 expect(textDiff(before,after).after.map(p=>p.text).join("")).toBe(after);
});
