import { afterEach, describe, expect, it, vi } from "vitest";
import {
  blankProject,
  loadProject,
  normalizeUrl,
  parseProject,
  readRecoveryData,
  RECOVERY_KEY,
  sampleProject,
  saveProject,
  STORAGE_KEY,
} from "./model";

afterEach(() => vi.unstubAllGlobals());

describe("project safety and portability", () => {
  it("round-trips every editable field through JSON", () => {
    const project = structuredClone(sampleProject);
    project.profile.name = "Amélie Laurent";
    project.style.accent = "#267A74";
    expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  });
  it("creates a genuinely empty new project", () => {
    const p = blankProject();
    expect(p.profile.name).toBe("");
    expect(p.links).toEqual([]);
    expect(parseProject(p)).toEqual(p);
  });
  it("rejects invalid or oversized imported projects and active photo content", () => {
    expect(() => parseProject({ ...sampleProject, version: 2 })).toThrow();
    expect(() =>
      parseProject({
        ...sampleProject,
        profile: {
          ...sampleProject.profile,
          photo: "data:image/svg+xml,<script>alert(1)</script>",
        },
      }),
    ).toThrow();
    expect(() =>
      parseProject({
        ...sampleProject,
        experience: Array(31).fill(sampleProject.experience[0]),
      }),
    ).toThrow();
  });
  it("allows ordinary web URLs and rejects executable or credential-bearing links", () => {
    expect(normalizeUrl("github.com/ProAmineOfficial")).toBe(
      "https://github.com/ProAmineOfficial",
    );
    expect(normalizeUrl("https://example.com/path?x=1#portfolio")).toBe(
      "https://example.com/path?x=1#portfolio",
    );
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,test",
      "file:///etc/passwd",
      "https://name:password@example.com",
      "",
      "https://",
    ])
      expect(normalizeUrl(url)).toBeNull();
  });
  it("preserves invalid saved data for recovery before showing a usable example", () => {
    const saved = new Map<string, string>([
      [STORAGE_KEY, '{"unfinished":"original data"}'],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
    });
    expect(loadProject()).toEqual(sampleProject);
    expect(saved.get(RECOVERY_KEY)).toBe('{"unfinished":"original data"}');
  });
  it("rejects duplicate identifiers that would edit or remove multiple entries", () => {
    const p = structuredClone(sampleProject);
    p.skills[1].id = p.skills[0].id;
    expect(() => parseProject(p)).toThrow();
  });
  it("does not overwrite unrecoverable saved data when browser storage is full", () => {
    const original = '{"unfinished":"keep me"}';
    const saved = new Map<string, string>([[STORAGE_KEY, original]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    });
    expect(loadProject()).toEqual(sampleProject);
    expect(readRecoveryData()).toBe(original);
    expect(() => saveProject(sampleProject)).toThrow("Quota exceeded");
    expect(saved.get(STORAGE_KEY)).toBe(original);
  });
});
