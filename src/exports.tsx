import { renderToStaticMarkup } from "react-dom/server";
import { CvCanvas } from "./CvCanvas";
import type { CvPage } from "./layout";
import { PAGE_H, PAGE_W } from "./layout";
import type { CvProject } from "./model";
import { filename, normalizeUrl } from "./model";
import type { QrMap } from "./qr";

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const base = import.meta.env.BASE_URL;
let fontPromise: Promise<[Uint8Array, Uint8Array]> | undefined;
export function loadFonts(): Promise<[Uint8Array, Uint8Array]> {
  if (!fontPromise)
    fontPromise = Promise.all(
      ["Regular", "Bold"].map(async (weight) => {
        const r = await fetch(`${base}fonts/Montserrat-${weight}.ttf`);
        if (!r.ok)
          throw new Error(
            "Could not load the CV fonts. Check your connection and try again.",
          );
        return new Uint8Array(await r.arrayBuffer());
      }),
    ) as Promise<[Uint8Array, Uint8Array]>;
  return fontPromise;
}

function bytesBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromDataUri(s: string): Uint8Array {
  return Uint8Array.from(atob(s.split(",")[1]), (c) => c.charCodeAt(0));
}

export async function exportPdf(
  p: CvProject,
  pages: CvPage[],
  progress?: (stage: string) => void,
): Promise<Blob> {
  progress?.("Loading PDF engine…");
  const { PDFArray, PDFDocument, PDFName, PDFString, rgb } = await import(
    "pdf-lib"
  );
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${p.profile.name || "My"} — Curriculum Vitae`);
  doc.setAuthor(p.profile.name || "");
  doc.setCreator("ProAmineCVStudio");
  progress?.("Preparing fonts…");
  const bytes = await loadFonts();
  const regular = await doc.embedFont(bytes[0], { subset: true }),
    bold = await doc.embedFont(bytes[1], { subset: true });
  const supported = new Set(regular.getCharacterSet());
  const unsupported = pages.some((page) =>
    page.ops.some(
      (op) =>
        op.kind === "text" &&
        Array.from(op.text).some(
          (c) => !supported.has(c.codePointAt(0)!) && !/\s/.test(c),
        ),
    ),
  );
  if (unsupported)
    throw new Error(
      "Some characters need another font. Choose Print / Save PDF to preserve them, or export editable Word.",
    );
  const color = (hex: string) =>
    rgb(
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
    );
  const images = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();
  progress?.("Drawing your pages…");
  for (const source of pages) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const link = (url: string, x: number, y: number, w: number, h: number) => {
      const annotation = doc.context.register(
        doc.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [x, PAGE_H - y - h, x + w, PAGE_H - y],
          Border: [0, 0, 0],
          A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
        }),
      );
      const existing = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      if (existing) existing.push(annotation);
      else page.node.set(PDFName.of("Annots"), doc.context.obj([annotation]));
    };
    for (const op of source.ops) {
      if (op.kind === "rect") {
        if (op.radius) {
          const r = Math.min(op.radius, op.w / 2, op.h / 2),
            w = op.w,
            h = op.h;
          page.drawSvgPath(
            `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`,
            { x: op.x, y: PAGE_H - op.y, color: color(op.fill) },
          );
        } else
          page.drawRectangle({
            x: op.x,
            y: PAGE_H - op.y - op.h,
            width: op.w,
            height: op.h,
            color: color(op.fill),
          });
      } else if (op.kind === "circle")
        page.drawCircle({
          x: op.x,
          y: PAGE_H - op.y,
          size: op.r,
          color: color(op.fill),
          borderColor: op.stroke ? color(op.stroke) : undefined,
          borderWidth: op.width,
        });
      else if (op.kind === "text") {
        const font = op.bold ? bold : regular,
          w = font.widthOfTextAtSize(op.text, op.size),
          x = op.align === "center" ? op.x - w / 2 : op.x;
        page.drawText(op.text, {
          x,
          y: PAGE_H - op.y,
          size: op.size,
          color: color(op.fill),
          font,
        });
        if (op.url) link(op.url, x, op.y - op.size, w, op.size * 1.3);
      } else {
        let src = op.src;
        if (op.round) src = await roundImage(src);
        if (!images.has(src))
          images.set(
            src,
            src.startsWith("data:image/jpeg")
              ? await doc.embedJpg(fromDataUri(src))
              : await doc.embedPng(fromDataUri(src)),
          );
        page.drawImage(images.get(src)!, {
          x: op.x,
          y: PAGE_H - op.y - op.h,
          width: op.w,
          height: op.h,
        });
        if (op.url) link(op.url, op.x, op.y, op.w, op.h);
      }
    }
  }
  progress?.("Finishing your PDF…");
  const out = await doc.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}

export async function roundImage(src: string): Promise<string> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const c = document.createElement("canvas");
  c.width = c.height = 500;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Image processing is unavailable.");
  ctx.beginPath();
  ctx.arc(250, 250, 250, 0, Math.PI * 2);
  ctx.clip();
  const size = Math.min(image.width, image.height);
  ctx.drawImage(
    image,
    (image.width - size) / 2,
    (image.height - size) / 2,
    size,
    size,
    0,
    0,
    500,
    500,
  );
  return c.toDataURL("image/png");
}

export async function exportImage(
  page: CvPage,
  format: "png" | "jpeg",
): Promise<Blob> {
  const [regular, bold] = await loadFonts();
  const fontCss = `@font-face{font-family:Montserrat;src:url(data:font/ttf;base64,${bytesBase64(regular)})} @font-face{font-family:Montserrat;font-weight:700;src:url(data:font/ttf;base64,${bytesBase64(bold)})}`;
  const svg = renderToStaticMarkup(<CvCanvas page={page} fontCss={fontCss} />);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 2480;
    canvas.height = 3508;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image export is unavailable in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Could not create the image.")),
        "image/" + format,
        0.95,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportWord(p: CvProject, qr: QrMap): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    ExternalHyperlink,
    HeadingLevel,
    ImageRun,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = await import("docx");
  const { ShapeRun } = await import("docx/shapes");
  const fonts = await loadFonts();
  const accent = p.style.accent.slice(1),
    white = "FFFFFF",
    signature = p.style.template === "signature";
  const noBorder = { style: BorderStyle.NONE, size: 0, color: white };
  const borders = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
  };
  const text = (
    s: string,
    o: {
      bold?: boolean;
      color?: string;
      size?: number;
      after?: number;
      center?: boolean;
    } = {},
  ) =>
    new Paragraph({
      alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: o.after ?? 90, line: 260 },
      children: [
        new TextRun({
          text: s,
          font: "Montserrat",
          size: o.size ?? p.style.fontSize * 2,
          color: o.color ?? "33354B",
          bold: o.bold,
        }),
      ],
    });
  const heading = (s: string, side = false) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      keepNext: true,
      spacing: { before: 190, after: 130 },
      shading: side ? undefined : { fill: accent, type: ShadingType.CLEAR },
      children: [
        new TextRun({
          text: s.toUpperCase(),
          font: "Montserrat",
          bold: true,
          size: 21,
          color: white,
        }),
      ],
    });
  const profile: InstanceType<typeof Paragraph>[] = [];
  const main: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] =
    [];
  const sideColor = signature ? white : "33354B";
  if (p.style.showPhoto && p.profile.photo)
    profile.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 170 },
        children: [
          new ImageRun({
            type: "png",
            data: fromDataUri(await roundImage(p.profile.photo)),
            transformation: { width: 110, height: 110 },
          }),
        ],
      }),
    );
  else if (signature && p.style.showPhoto)
    profile.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 170 },
        children: [
          new ShapeRun({
            type: "ellipse",
            transformation: { width: 110, height: 110 },
            fill: white,
            line: "none",
            children: [
              text(
                (p.profile.name || "Your Name")
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((v) => v[0])
                  .join(""),
                { bold: true, size: 44, color: accent, center: true, after: 0 },
              ),
            ],
            textOptions: {
              verticalAlignment: "center",
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
            },
          }),
        ],
      }),
    );
  profile.push(
    text(p.profile.name || "Your name", {
      color: sideColor,
      bold: true,
      size: 34,
      after: 140,
    }),
  );
  if (p.profile.title)
    profile.push(
      text(p.profile.title, { color: sideColor, size: 19, after: 220 }),
    );
  const contacts = [
    p.profile.location,
    p.profile.email,
    p.profile.phone,
    p.profile.website,
  ].filter(Boolean);
  if (contacts.length) {
    profile.push(heading("Contact", signature));
    contacts.forEach((s) =>
      profile.push(text(s, { color: sideColor, size: 17 })),
    );
  }
  if (p.profile.summary) {
    profile.push(heading("Professional summary", signature));
    profile.push(
      text(p.profile.summary, {
        color: sideColor,
        size: Math.max(17, p.style.fontSize * 2 - 0.6),
      }),
    );
  }
  if (p.languages) {
    profile.push(heading("Languages", signature));
    p.languages
      .split("\n")
      .forEach((s) => profile.push(text(s, { color: sideColor, size: 17 })));
  }
  if (p.hobbies) {
    profile.push(heading("Interests", signature));
    p.hobbies
      .split("\n")
      .forEach((s) => profile.push(text(s, { color: sideColor, size: 17 })));
  }
  if (p.education.some((e) => e.degree || e.school)) {
    main.push(heading("Education"));
    for (const e of p.education.filter((v) => v.degree || v.school)) {
      main.push(text(e.degree || e.school, { bold: true }));
      if (e.degree && e.school) main.push(text(e.school, { color: accent }));
      if (e.period) main.push(text(e.period, { size: 16, color: "697086" }));
      if (e.description) main.push(text(e.description));
    }
  }
  if (p.experience.some((e) => e.role || e.company)) {
    main.push(heading("Experience"));
    for (const e of p.experience.filter((v) => v.role || v.company)) {
      main.push(text(e.role || e.company, { bold: true }));
      if (e.company && e.role) main.push(text(e.company, { color: accent }));
      if (e.period) main.push(text(e.period, { size: 16, color: "697086" }));
      e.description
        .split("\n")
        .filter(Boolean)
        .forEach((s) =>
          main.push(
            text("• " + s.replace(/^[•\-]\s*/, ""), {
              size: p.style.fontSize * 2,
            }),
          ),
        );
    }
  }
  if (p.projects.some((e) => e.name || e.description)) {
    main.push(heading("Projects & achievements"));
    for (const e of p.projects.filter((v) => v.name || v.description)) {
      if (e.name) main.push(text(e.name, { bold: true, color: accent }));
      if (e.description) main.push(text(e.description));
    }
  }
  const grid = (cells: InstanceType<typeof Paragraph>[][], cols: number) => {
    const cellWidth = Math.floor((signature ? 7050 : 10700) / cols);
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: Array(cols).fill(cellWidth),
      borders: {
        ...borders,
        insideHorizontal: noBorder,
        insideVertical: noBorder,
      },
      rows: Array.from(
        { length: Math.ceil(cells.length / cols) },
        (_, i) =>
          new TableRow({
            cantSplit: true,
            children: Array.from(
              { length: cols },
              (_, j) =>
                new TableCell({
                  borders,
                  width: { size: cellWidth, type: WidthType.DXA },
                  margins: { top: 90, bottom: 160, left: 65, right: 65 },
                  children: cells[i * cols + j] || [text("")],
                }),
            ),
          }),
      ),
    });
  };
  const links = p.links.filter((e) => normalizeUrl(e.url));
  if (links.length) {
    main.push(heading("Selected links"));
    if (p.style.showQr) {
      main.push(
        grid(
          links.map((l) => {
            const children: InstanceType<typeof Paragraph>[] = [];
            if (qr[l.id])
              children.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 50 },
                  children: [
                    new ExternalHyperlink({
                      link: normalizeUrl(l.url)!,
                      children: [
                        new ImageRun({
                          type: "png",
                          data: fromDataUri(qr[l.id]),
                          transformation: { width: 96, height: 96 },
                        }),
                      ],
                    }),
                  ],
                }),
              );
            children.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [
                  new ExternalHyperlink({
                    link: normalizeUrl(l.url)!,
                    children: [
                      new TextRun({
                        text: l.label || "Link",
                        font: "Montserrat",
                        bold: true,
                        color: accent,
                        size: 16,
                      }),
                    ],
                  }),
                ],
              }),
            );
            return children;
          }),
          Math.min(3, links.length),
        ),
      );
    } else
      for (const l of links)
        main.push(
          new Paragraph({
            spacing: { after: 130 },
            children: [
              new ExternalHyperlink({
                link: normalizeUrl(l.url)!,
                children: [
                  new TextRun({
                    text: `${l.label || "Link"} — ${normalizeUrl(l.url)}`,
                    font: "Montserrat",
                    color: accent,
                    size: 17,
                    underline: {},
                  }),
                ],
              }),
            ],
          }),
        );
  }
  const skills = p.skills.filter((e) => e.name);
  if (skills.length) {
    main.push(heading("Skills"));
    if (signature)
      main.push(
        grid(
          skills.map((s) => {
            const long = s.name.length > 35,
              label = long
                ? s.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((v) => v[0])
                    .join("")
                : s.name;
            const paragraphs = [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
                children: [
                  new ShapeRun({
                    type: "ellipse",
                    transformation: { width: 84, height: 84 },
                    fill: "F6F4FA",
                    line: { color: accent, width: 4 },
                    children: [
                      text(label, {
                        bold: true,
                        size: 16,
                        color: accent,
                        center: true,
                        after: 0,
                      }),
                    ],
                    textOptions: {
                      verticalAlignment: "center",
                      shrinkTextOnOverflow: true,
                      margins: { top: 4, bottom: 4, left: 4, right: 4 },
                    },
                  }),
                ],
              }),
            ];
            if (long)
              paragraphs.push(
                text(s.name, {
                  bold: true,
                  color: accent,
                  size: 16,
                  center: true,
                }),
              );
            if (s.description)
              paragraphs.push(
                text(s.description, {
                  color: "697086",
                  size: 15,
                  center: true,
                }),
              );
            return paragraphs;
          }),
          2,
        ),
      );
    else
      skills.forEach((s) =>
        main.push(text(s.name + (s.description ? " — " + s.description : ""))),
      );
  }
  const children = signature
    ? [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          columnWidths: [3650, 7536],
          borders: {
            ...borders,
            insideHorizontal: noBorder,
            insideVertical: noBorder,
          },
          rows: [
            new TableRow({
              cantSplit: false,
              children: [
                new TableCell({
                  width: { size: 3650, type: WidthType.DXA },
                  shading: { fill: accent },
                  margins: { top: 300, bottom: 260, left: 230, right: 230 },
                  verticalAlign: VerticalAlign.TOP,
                  borders,
                  children: profile,
                }),
                new TableCell({
                  width: { size: 7536, type: WidthType.DXA },
                  margins: { top: 220, bottom: 220, left: 300, right: 180 },
                  borders,
                  children: main.length ? main : [text("")],
                }),
              ],
            }),
          ],
        }),
      ]
    : [...profile, ...main];
  // docx annotates font data as Buffer; its encoder accepts Uint8Array in browsers.
  const doc = new Document({
    creator: p.profile.name || "ProAmineCVStudio",
    title: `${p.profile.name || "My"} CV`,
    description:
      "Created with ProAmineCVStudio. Text, skill shapes and content are editable.",
    fonts: [
      {
        name: "Montserrat",
        data: fonts[0] as Buffer,
        bold: fonts[1] as Buffer,
      },
    ],
    theme: {
      name: "CV Studio",
      fonts: { headings: "Montserrat", body: "Montserrat" },
    },
    styles: {
      default: {
        document: {
          run: { font: "Montserrat", size: p.style.fontSize * 2 },
          paragraph: { spacing: { after: 90 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 360, bottom: 360, left: 360, right: 360 },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

export function exportJson(p: CvProject) {
  download(
    new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }),
    filename(p) + ".cv.json",
  );
}
