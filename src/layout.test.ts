import { describe, expect, it } from "vitest";
import { buildLayout, PAGE_H, PAGE_W, wrapText } from "./layout";
import type { DrawOp, Measure } from "./layout";
import { blankProject, sampleProject } from "./model";

const measure: Measure = (s, size) => Array.from(s).length * size * 0.52;
const content = (ops: DrawOp[]) =>
  ops
    .filter((o) => o.kind === "text")
    .map((o) => o.text)
    .join(" ");
describe("CV pagination", () => {
  it("keeps very long URLs intact across line wrapping", () => {
    const url = "https://example.com/" + "a".repeat(200);
    const lines = wrapText(url, 100, 10, measure);
    expect(lines.join("")).toBe(url);
    expect(lines.every((s) => measure(s, 10) <= 100)).toBe(true);
  });
  it("paginates long experience without losing the final content", () => {
    const p = structuredClone(sampleProject);
    p.experience[0].description =
      Array(150)
        .fill(
          "Designed useful, accessible products with a cross-functional team.",
        )
        .join("\n") + "\nEND_OF_EXPERIENCE";
    const pages = buildLayout(p, {}, measure);
    expect(pages.length).toBeGreaterThan(2);
    expect(content(pages.flatMap((p) => p.ops))).toContain("END_OF_EXPERIENCE");
    for (const page of pages)
      for (const op of page.ops) {
        if (op.kind === "text") {
          expect(op.x).toBeGreaterThanOrEqual(0);
          expect(op.x).toBeLessThan(PAGE_W);
          expect(op.y).toBeLessThan(PAGE_H);
          expect(op.y).toBeGreaterThan(0);
        }
        if (op.kind === "image") expect(op.y + op.h).toBeLessThan(PAGE_H - 20);
      }
  });
  it("preserves a long sidebar summary on continuation pages", () => {
    const p = blankProject();
    p.profile.name = "Long Profile";
    p.profile.summary =
      Array(140).fill("A thoughtful approach to professional work.").join(" ") +
      " END_OF_SUMMARY";
    const pages = buildLayout(p, {}, measure);
    expect(pages.length).toBeGreaterThan(1);
    expect(content(pages.flatMap((p) => p.ops))).toContain("END_OF_SUMMARY");
  });
  it("keeps the minimal template in one reading column", () => {
    const p = structuredClone(sampleProject);
    p.style.template = "minimal";
    const pages = buildLayout(p, {}, measure);
    expect(content(pages.flatMap((p) => p.ops))).toContain("Alex Morgan");
    expect(
      pages[0].ops.filter((o) => o.kind === "rect" && o.w === 193),
    ).toHaveLength(0);
  });
  it("keeps an uploaded photo in Minimal and reserves space for the header", () => {
    const p = blankProject();
    p.style.template = "minimal";
    p.profile.name = "Alex Morgan";
    p.profile.photo = "data:image/png;base64,AAAA";
    const pages = buildLayout(p, {}, measure);
    expect(
      pages[0].ops.some(
        (op) => op.kind === "image" && op.src === p.profile.photo,
      ),
    ).toBe(true);
    p.style.showPhoto = false;
    expect(
      buildLayout(p, {}, measure)[0].ops.some((op) => op.kind === "image"),
    ).toBe(false);
  });
  it("retains long skill names outside their circles without overlapping the next row", () => {
    const p = blankProject();
    const label =
      "Very long engineering discipline and accessible multi-platform development foundations";
    p.skills = Array.from({ length: 4 }, (_, i) => ({
      id: String(i),
      name: label,
      description: "Carefully described practical experience",
    }));
    const pages = buildLayout(p, {}, measure),
      ops = pages.flatMap((page) => page.ops);
    expect(content(ops)).toContain("Very long engineering");
    expect(content(ops)).toContain("foundations");
    for (const page of pages) {
      const circles = page.ops.filter(
        (op) => op.kind === "circle" && op.r === 30,
      );
      for (const op of page.ops)
        if (op.kind === "text" && op.fill === "#697086") {
          for (const circle of circles)
            if (circle.kind === "circle" && Math.abs(circle.x - op.x) < 1)
              expect(Math.abs(circle.y - op.y)).toBeGreaterThan(30);
        }
    }
  });
});
