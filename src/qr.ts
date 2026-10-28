import QRCode from "qrcode";
import type { CvProject } from "./model";
import { normalizeUrl } from "./model";

export type QrMap = Record<string, string>;
const cache = new Map<string, Promise<string>>();

const icons: Record<string, string> = {
  globe:
    '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c5 5 5 11 0 16-5-5-5-11 0-16z"/>',
  github:
    '<path d="M9 19c-4 1-4-2-6-2m12 4v-4c0-1-.3-2-1-2 4-.4 6-2 6-6 0-1-.4-2-1-3 .3-1 .2-2 0-3-2 0-3 1-4 1a13 13 0 0 0-6 0C8 3 6 3 5 3c-.4 1-.4 2 0 3-1 1-1 2-1 3 0 4 2 6 6 6-.6.5-1 1-1 2v4"/>',
  linkedin: '<path d="M5 9v11M5 4v.1M10 20V9h4v2c1-3 6-3 6 2v7M14 13v7"/>',
  document: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/>',
  chip: '<path d="M9 2v4m3-4v4m3-4v4M9 18v4m3-4v4m3-4v4M2 9h4m-4 3h4m-4 3h4m12-6h4m-4 3h4m-4 3h4"/><rect x="6" y="6" width="12" height="12" rx="1.5" fill="black"/><circle cx="9.1" cy="9.1" r="1.2" fill="white" stroke="none"/><path d="M12 12h3.3M12 14h3.3M12 16h3.3" stroke="white" stroke-width="1.1"/>',
};

async function generate(url: string, icon: string): Promise<string> {
  const data = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    width: 720,
    margin: 4,
    color: { dark: "#000000", light: "#ffffff" },
  });
  if (icon === "none" || !icons[icon] || typeof document === "undefined")
    return data;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) return data;
  const image = new Image();
  image.src = data;
  await image.decode();
  ctx.drawImage(image, 0, 0);
  const size = 96,
    x = (720 - size) / 2;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x - 12, x - 12, size + 24, size + 24);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"><g fill="none" stroke="black" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${icons[icon]}</g></svg>`;
  const logo = new Image();
  logo.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await logo.decode();
  ctx.drawImage(logo, x, x, size, size);
  return canvas.toDataURL("image/png");
}

export async function generateQrs(
  links: CvProject["links"],
  onErrors?: (ids: string[]) => void,
): Promise<QrMap> {
  const errors: string[] = [];
  const pairs = await Promise.all(
    links.map(async (link) => {
      const url = normalizeUrl(link.url);
      if (!url) return [link.id, ""];
      const key = url + "|" + link.icon;
      if (!cache.has(key)) {
        if (cache.size > 120) cache.clear();
        cache.set(key, generate(url, link.icon));
      }
      try {
        return [link.id, await cache.get(key)!];
      } catch {
        cache.delete(key);
        errors.push(link.id);
        return [link.id, ""];
      }
    }),
  );
  onErrors?.(errors);
  return Object.fromEntries(pairs);
}
