import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sampleProject } from "./model";
import { buildLayout } from "./layout";
import { generateQrs } from "./qr";
import { exportPdf, exportWord } from "./exports";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

const artifactDir = process.env.CVSTUDIO_QA_DIR;
beforeAll(() => {
  vi.stubGlobal("fetch", async (url: string) => {
    const bytes = await readFile(
      path.resolve("public", String(url).replace(/^\.?\//, "")),
    );
    return new Response(bytes, { status: 200 });
  });
});
afterAll(() => vi.unstubAllGlobals());

describe("real document exports", () => {
  it("reports unsupported writing systems instead of silently losing PDF text", async () => {
    const p = structuredClone(sampleProject);
    p.profile.name = "أمين";
    const pages = buildLayout(p, {}, (s, size) => s.length * size * 0.52);
    await expect(exportPdf(p, pages)).rejects.toThrow("Print / Save PDF");
  });
  it("creates a vector PDF with text operators, multiple pages and clickable links", async () => {
    const p = structuredClone(sampleProject);
    p.profile.name = "Amélie Laurent";
    const qr = await generateQrs(p.links),
      pages = buildLayout(p, qr, (s, size) => s.length * size * 0.52);
    const blob = await exportPdf(p, pages),
      bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPages().length).toBe(pages.length);
    expect(doc.getTitle()).toContain("Amélie Laurent");
    expect(doc.getPages().some((pg) => pg.node.Annots()?.size())).toBe(true);
    if (artifactDir) {
      await mkdir(artifactDir, { recursive: true });
      await writeFile(path.join(artifactDir, "cv-export.pdf"), bytes);
    }
  }, 20000);
  it("creates DOCX with editable paragraphs, hyperlinks, QR images and all source text", async () => {
    const p = structuredClone(sampleProject),
      qr = await generateQrs(p.links);
    const blob = await exportWord(p, qr);
    const bytes = await blob.arrayBuffer(),
      zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Alex Morgan");
    expect(xml).toContain("Product Designer");
    expect(xml).toContain("Open Design Library");
    expect(xml).toContain("w:hyperlink");
    expect(xml).toContain("w:tbl");
    expect(xml).toContain("w:t");
    expect(
      Object.keys(zip.files).filter((k) => k.startsWith("word/media/")).length,
    ).toBeGreaterThanOrEqual(2);
    if (artifactDir) {
      await mkdir(artifactDir, { recursive: true });
      await writeFile(
        path.join(artifactDir, "cv-export.docx"),
        new Uint8Array(bytes),
      );
    }
  }, 20000);
});
