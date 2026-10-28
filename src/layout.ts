import type { CvProject } from "./model";
import { normalizeUrl } from "./model";
import type { QrMap } from "./qr";

export const PAGE_W = 595.28,
  PAGE_H = 841.89;
export type DrawOp =
  | {
      kind: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      fill: string;
      radius?: number;
    }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      fill: string;
      bold?: boolean;
      align?: "left" | "center";
      url?: string;
    }
  | {
      kind: "image";
      x: number;
      y: number;
      w: number;
      h: number;
      src: string;
      round?: boolean;
      url?: string;
    }
  | {
      kind: "circle";
      x: number;
      y: number;
      r: number;
      fill: string;
      stroke?: string;
      width?: number;
    };
export type CvPage = { ops: DrawOp[] };
export type Measure = (s: string, size: number, bold?: boolean) => number;
const ink = "#222338",
  muted = "#697086";

export function wrapText(
  text: string,
  width: number,
  size: number,
  measure: Measure,
  bold = false,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      if (measure(word, size, bold) > width) {
        if (line) {
          lines.push(line);
          line = "";
        }
        let chunk = "";
        for (const char of word) {
          if (chunk && measure(chunk + char, size, bold) > width) {
            lines.push(chunk);
            chunk = "";
          }
          chunk += char;
        }
        line = chunk;
      } else if (line && measure(line + " " + word, size, bold) > width) {
        lines.push(line);
        line = word;
      } else line += (line ? " " : "") + word;
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function buildLayout(
  p: CvProject,
  qr: QrMap,
  measure: Measure,
): CvPage[] {
  const pages: CvPage[] = [];
  const signature = p.style.template === "signature";
  const accent = p.style.accent;
  const sideWidth = 193;
  const bodySize = p.style.fontSize;
  const mainX = signature ? 216 : 38;
  const mainWidth = PAGE_W - mainX - 30;
  const bottom = PAGE_H - 35;
  let pi = 0,
    y = signature ? 40 : 36;
  function page(i: number) {
    while (pages.length <= i) {
      const idx = pages.length;
      const ops: DrawOp[] = [
        { kind: "rect", x: 0, y: 0, w: PAGE_W, h: PAGE_H, fill: "#ffffff" },
      ];
      if (signature)
        ops.push({
          kind: "rect",
          x: 0,
          y: 0,
          w: sideWidth,
          h: PAGE_H,
          fill: accent,
        });
      if (idx > 0)
        ops.push({
          kind: "text",
          x: mainX,
          y: 22,
          text: p.profile.name || "Your name",
          size: 8,
          fill: muted,
          bold: true,
        });
      pages.push({ ops });
    }
    return pages[i];
  }
  function ensure(height: number) {
    if (y + height > bottom) {
      pi++;
      y = 45;
    }
    page(pi);
  }
  const add = (op: DrawOp) => page(pi).ops.push(op);
  function text(
    value: string,
    options: {
      size?: number;
      bold?: boolean;
      fill?: string;
      indent?: number;
      url?: string;
      width?: number;
    } = {},
  ) {
    const size = options.size ?? bodySize,
      lineHeight = size * 1.48;
    const indent = options.indent ?? 0;
    for (const line of wrapText(
      value,
      (options.width ?? mainWidth) - indent,
      size,
      measure,
      options.bold,
    )) {
      ensure(lineHeight);
      if (line)
        add({
          kind: "text",
          x: mainX + indent,
          y,
          text: line,
          size,
          fill: options.fill ?? ink,
          bold: options.bold,
          url: options.url,
        });
      y += lineHeight;
    }
  }
  function heading(value: string, minSpace = 45) {
    ensure(29 + minSpace);
    if (signature) {
      const pillWidth = Math.min(
        mainWidth,
        Math.max(
          mainWidth * 0.55,
          measure(value.toUpperCase(), 9.5, true) + 27,
        ),
      );
      add({
        kind: "rect",
        x: mainX + pillWidth - 4,
        y: y - 3,
        w: mainWidth - pillWidth + 4,
        h: 2.5,
        fill: accent,
      });
      add({
        kind: "rect",
        x: mainX + pillWidth - 4,
        y: y + 1.5,
        w: mainWidth - pillWidth + 4,
        h: 1,
        fill: accent,
      });
      add({
        kind: "rect",
        x: mainX,
        y: y - 11,
        w: pillWidth,
        h: 21,
        fill: accent,
        radius: 10,
      });
      add({
        kind: "text",
        x: mainX + 12,
        y: y + 3,
        text: value.toUpperCase(),
        size: 9.5,
        fill: "#ffffff",
        bold: true,
      });
    } else {
      add({
        kind: "text",
        x: mainX,
        y,
        text: value.toUpperCase(),
        size: 10,
        fill: accent,
        bold: true,
      });
      add({
        kind: "rect",
        x: mainX,
        y: y + 8,
        w: mainWidth,
        h: 1,
        fill: "#e5e7ed",
      });
    }
    y += 26;
  }
  function bullets(value: string) {
    for (const paragraph of value.split("\n").filter((t) => t.trim())) {
      ensure(bodySize * 2);
      add({
        kind: "circle",
        x: mainX + 2,
        y: y - bodySize * 0.32,
        r: 1.3,
        fill: accent,
      });
      text(paragraph.replace(/^[•\-]\s*/, ""), { indent: 11, fill: muted });
      y += 2;
    }
  }
  page(0);
  if (signature) {
    let sp = 0,
      sy = 35;
    const sx = 24,
      sw = sideWidth - 48;
    const sideEnsure = (h: number) => {
      if (sy + h > bottom) {
        sp++;
        sy = 48;
      }
      page(sp);
    };
    const sideText = (
      value: string,
      size: number,
      bold = false,
      gap = 0,
      url?: string,
    ) => {
      for (const line of wrapText(value, sw, size, measure, bold)) {
        sideEnsure(size * 1.5);
        if (line)
          page(sp).ops.push({
            kind: "text",
            x: sx,
            y: sy,
            text: line,
            size,
            bold,
            fill: "#ffffff",
            url,
          });
        sy += size * 1.5;
      }
      sy += gap;
    };
    if (p.style.showPhoto) {
      page(0).ops.push({
        kind: "circle",
        x: sideWidth / 2,
        y: 84,
        r: 43,
        fill: "#ffffff",
      });
      if (p.profile.photo)
        page(0).ops.push({
          kind: "image",
          x: sideWidth / 2 - 39,
          y: 45,
          w: 78,
          h: 78,
          src: p.profile.photo,
          round: true,
        });
      else
        page(0).ops.push({
          kind: "text",
          x: sideWidth / 2,
          y: 95,
          size: 26,
          bold: true,
          fill: accent,
          align: "center",
          text: (p.profile.name || "Your Name")
            .split(/\s+/)
            .slice(0, 2)
            .map((v) => v[0])
            .join(""),
        });
      sy = 155;
    }
    sideText(p.profile.name || "Your name", 19, true, 4);
    if (p.profile.title) sideText(p.profile.title, 9, false, 15);
    const contacts = [
      p.profile.location,
      p.profile.email,
      p.profile.phone,
      p.profile.website,
    ].filter(Boolean);
    if (contacts.length) {
      sideText("CONTACT", 8, true, 5);
      for (const s of contacts)
        sideText(
          s.replace(/^https?:\/\//, ""),
          8.2,
          false,
          6,
          s === p.profile.website
            ? (normalizeUrl(s) ?? undefined)
            : s === p.profile.email
              ? "mailto:" + s
              : undefined,
        );
      sy += 12;
    }
    if (p.profile.summary) {
      sideText("PROFESSIONAL SUMMARY", 8, true, 7);
      sideText(p.profile.summary, Math.max(8.5, bodySize - 0.3), false, 18);
    }
    if (p.languages.trim()) {
      sideText("LANGUAGES", 8, true, 7);
      sideText(p.languages, 8.2, false, 18);
    }
    if (p.hobbies.trim()) {
      sideText("INTERESTS", 8, true, 7);
      sideText(p.hobbies, 8.2);
    }
  } else {
    const withPhoto = p.style.showPhoto && !!p.profile.photo;
    const headerWidth = mainWidth - (withPhoto ? 100 : 0);
    if (withPhoto)
      add({
        kind: "image",
        x: PAGE_W - 112,
        y: 30,
        w: 75,
        h: 75,
        src: p.profile.photo,
        round: true,
      });
    text(p.profile.name || "Your name", {
      size: 27,
      bold: true,
      width: headerWidth,
    });
    if (p.profile.title)
      text(p.profile.title, { size: 12, fill: accent, width: headerWidth });
    y += 6;
    text(
      [p.profile.location, p.profile.email, p.profile.phone]
        .filter(Boolean)
        .join(" · "),
      { size: 8.5, fill: muted, width: headerWidth },
    );
    if (p.profile.website)
      text(p.profile.website, {
        size: 8.5,
        fill: muted,
        width: headerWidth,
        url: normalizeUrl(p.profile.website) ?? undefined,
      });
    y += 16;
    if (withPhoto) y = Math.max(y, 125);
    if (p.profile.summary) {
      heading("Professional summary");
      text(p.profile.summary);
      y += 15;
    }
  }
  // The original reference places education before experience.
  if (p.education.some((e) => e.degree || e.school)) {
    heading("Education");
    for (const e of p.education) {
      if (!e.degree && !e.school) continue;
      ensure(55);
      text(e.degree || e.school, { bold: true, size: bodySize + 0.3 });
      if (e.school && e.degree)
        text(e.school, { fill: accent, size: bodySize - 0.4 });
      if (e.period) text(e.period, { size: bodySize - 1, fill: muted });
      if (e.description)
        text(e.description, { fill: muted, size: bodySize - 0.3 });
      y += 12;
    }
  }
  if (p.experience.some((e) => e.role || e.company)) {
    heading("Experience");
    for (const e of p.experience) {
      if (!e.role && !e.company) continue;
      ensure(54);
      text(e.role || e.company, { bold: true, size: bodySize + 0.6 });
      if (e.company && e.role)
        text(e.company, { fill: accent, size: bodySize - 0.3 });
      if (e.period) text(e.period, { fill: muted, size: bodySize - 1 });
      y += 4;
      if (e.description) bullets(e.description);
      y += 12;
    }
  }
  if (p.projects.some((e) => e.name || e.description)) {
    heading("Projects & achievements");
    for (const e of p.projects) {
      if (!e.name && !e.description) continue;
      ensure(36);
      if (e.name) text(e.name, { bold: true, fill: accent });
      if (e.description) text(e.description, { fill: muted });
      y += 10;
    }
  }
  const links = p.links.filter((l) => normalizeUrl(l.url));
  if (links.length) {
    heading("Selected links", p.style.showQr ? 105 : 30);
    if (p.style.showQr) {
      const cols = Math.min(3, links.length),
        cellW = mainWidth / cols;
      for (let i = 0; i < links.length; i += cols) {
        const row = links.slice(i, i + cols),
          labelLines = Math.max(
            ...row.map(
              (l) =>
                wrapText(l.label || "Link", cellW - 10, 7.5, measure, true)
                  .length,
            ),
          );
        const rowHeight = 83 + labelLines * 10;
        ensure(rowHeight);
        row.forEach((l, j) => {
          const cx = mainX + cellW * (j + 0.5),
            url = normalizeUrl(l.url)!;
          if (qr[l.id])
            add({
              kind: "image",
              x: cx - 36,
              y: y - 7,
              w: 72,
              h: 72,
              src: qr[l.id],
              url,
            });
          wrapText(l.label || "Link", cellW - 10, 7.5, measure, true).forEach(
            (line, li) =>
              add({
                kind: "text",
                x: cx,
                y: y + 74 + li * 10,
                text: line,
                size: 7.5,
                fill: muted,
                bold: true,
                align: "center",
                url,
              }),
          );
        });
        y += rowHeight;
      }
    } else
      for (const l of links) {
        text(l.label || "Link", { bold: true, url: normalizeUrl(l.url)! });
        text(normalizeUrl(l.url)!, {
          size: 8,
          fill: muted,
          url: normalizeUrl(l.url)!,
        });
        y += 8;
      }
  }
  if (p.skills.some((e) => e.name)) {
    heading("Skills", signature ? 100 : 30);
    if (signature) {
      const cols = 2,
        cellW = mainWidth / cols;
      for (let i = 0; i < p.skills.length; i += cols) {
        const row = p.skills.slice(i, i + cols).filter((s) => s.name);
        if (!row.length) continue;
        const details = row.map((s) => {
          let nameSize = 8.2,
            lines = wrapText(s.name, 49, nameSize, measure, true);
          while (lines.length > 3 && nameSize > 7) {
            nameSize -= 0.4;
            lines = wrapText(s.name, 49, nameSize, measure, true);
          }
          const outside = lines.length > 3;
          const extraLines = outside
            ? wrapText(s.name, cellW - 14, 7.5, measure, true)
            : [];
          return {
            nameSize,
            lines,
            outside,
            extraLines,
            extraHeight: extraLines.length * 10 + (outside ? 4 : 0),
            description: wrapText(s.description, cellW - 14, 7.2, measure),
          };
        });
        const captionHeight = Math.max(
          ...details.map((s) => s.extraHeight + s.description.length * 10),
        );
        const rowHeight = 82 + captionHeight;
        ensure(rowHeight);
        row.forEach((s, j) => {
          const cx = mainX + cellW * (j + 0.5),
            cy = y + 26;
          add({
            kind: "circle",
            x: cx,
            y: cy,
            r: 30,
            fill: "#f6f4fa",
            stroke: accent,
            width: 4,
          });
          const detail = details[j];
          if (detail.outside)
            add({
              kind: "text",
              x: cx,
              y: cy + 5,
              text: s.name
                .split(/\s+/)
                .slice(0, 2)
                .map((v) => v[0])
                .join(""),
              size: 14,
              fill: accent,
              bold: true,
              align: "center",
            });
          else
            detail.lines.forEach((line, li) =>
              add({
                kind: "text",
                x: cx,
                y: cy - (detail.lines.length - 1) * 5.3 + li * 10.6 + 3,
                text: line,
                size: detail.nameSize,
                fill: accent,
                bold: true,
                align: "center",
              }),
            );
          detail.extraLines.forEach((line, li) =>
            add({
              kind: "text",
              x: cx,
              y: y + 68 + li * 10,
              text: line,
              size: 7.5,
              fill: accent,
              bold: true,
              align: "center",
            }),
          );
          detail.description.forEach((line, li) =>
            add({
              kind: "text",
              x: cx,
              y: y + 68 + detail.extraHeight + li * 10,
              text: line,
              size: 7.2,
              fill: muted,
              align: "center",
            }),
          );
        });
        y += rowHeight;
      }
    } else {
      for (const s of p.skills.filter((v) => v.name)) {
        text(s.name + (s.description ? " — " + s.description : ""), {
          size: bodySize,
        });
        y += 3;
      }
      y += 10;
    }
  }
  if (!signature && p.languages.trim()) {
    heading("Languages");
    text(p.languages);
    y += 12;
  }
  if (!signature && p.hobbies.trim()) {
    heading("Interests");
    text(p.hobbies);
  }
  pages.forEach((pg, i) =>
    pg.ops.push({
      kind: "text",
      x: PAGE_W - 30,
      y: PAGE_H - 15,
      text: `${i + 1} / ${pages.length}`,
      size: 7,
      fill: muted,
      align: "center",
    }),
  );
  return pages;
}
