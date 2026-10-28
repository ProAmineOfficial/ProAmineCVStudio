import { z } from "zod";

const text = (max = 1000) => z.string().max(max);
const item = { id: text(80) };
export const projectSchema = z
  .object({
    version: z.literal(1),
    profile: z.object({
      name: text(120),
      title: text(160),
      email: text(160),
      phone: text(80),
      location: text(160),
      website: text(500),
      summary: text(10000),
      photo: text(3_000_000),
    }),
    experience: z
      .array(
        z.object({
          ...item,
          role: text(160),
          company: text(160),
          period: text(100),
          description: text(12000),
        }),
      )
      .max(30),
    education: z
      .array(
        z.object({
          ...item,
          degree: text(200),
          school: text(200),
          period: text(100),
          description: text(4000),
        }),
      )
      .max(20),
    projects: z
      .array(z.object({ ...item, name: text(200), description: text(8000) }))
      .max(30),
    skills: z
      .array(z.object({ ...item, name: text(100), description: text(300) }))
      .max(24),
    links: z
      .array(
        z.object({
          ...item,
          label: text(100),
          url: text(2000),
          icon: z.enum([
            "none",
            "globe",
            "github",
            "linkedin",
            "document",
            "chip",
          ]),
        }),
      )
      .max(20),
    languages: text(1000),
    hobbies: text(1000),
    style: z.object({
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      template: z.enum(["signature", "minimal"]),
      fontSize: z.number().min(8).max(12),
      showPhoto: z.boolean(),
      showQr: z.boolean(),
    }),
  })
  .superRefine((project, context) => {
    for (const key of [
      "experience",
      "education",
      "projects",
      "skills",
      "links",
    ] as const) {
      const ids = project[key].map((v) => v.id);
      if (ids.some((v) => !v) || new Set(ids).size !== ids.length)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Entries must have unique, non-empty identifiers.",
        });
    }
  });
export type CvProject = z.infer<typeof projectSchema>;
export type Step =
  | "profile"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "links";
export const uid = () => crypto.randomUUID();

export const sampleProject: CvProject = {
  version: 1,
  profile: {
    name: "Alex Morgan",
    title: "Product Designer & Creative Technologist",
    email: "alex@example.com",
    phone: "+44 20 0000 0000",
    location: "London, United Kingdom",
    website: "https://example.com",
    photo: "",
    summary:
      "I turn complex ideas into clear, thoughtful digital experiences. My work brings together product strategy, visual design, and a love of building things that make everyday life a little easier.",
  },
  experience: [
    {
      id: "experience-1",
      role: "Senior Product Designer",
      company: "Studio North · Example company",
      period: "2022 — Present",
      description:
        "Led the design of a collaborative workspace, from early research to launch.\nBuilt a shared design system that connected product, engineering, and brand.\nPartnered with a small team to turn customer insights into useful, accessible features.",
    },
    {
      id: "experience-2",
      role: "Product Designer",
      company: "Form & Function · Example company",
      period: "2019 — 2022",
      description:
        "Designed web and mobile experiences for early-stage teams.\nCreated prototypes, tested ideas with users, and supported implementation.",
    },
  ],
  education: [
    {
      id: "education-1",
      degree: "BA, Interaction Design",
      school: "Example School of Design",
      period: "2015 — 2019",
      description: "Focus on human-centered design and creative technology.",
    },
  ],
  projects: [
    {
      id: "project-1",
      name: "Open Design Library",
      description:
        "A collection of accessible components and practical design resources, shared with the community.",
    },
    {
      id: "project-2",
      name: "A More Thoughtful Workspace",
      description:
        "An independent exploration of how small teams can collaborate with less friction.",
    },
  ],
  skills: [
    {
      id: "skill-1",
      name: "Product Design",
      description: "Research, strategy & interaction",
    },
    {
      id: "skill-2",
      name: "Design Systems",
      description: "Accessible, reusable foundations",
    },
  ],
  links: [
    {
      id: "link-1",
      label: "Portfolio",
      url: "https://example.com",
      icon: "globe",
    },
    {
      id: "link-2",
      label: "GitHub",
      url: "https://github.com",
      icon: "github",
    },
  ],
  languages: "English · Native\nFrench · Working proficiency",
  hobbies: "Photography\nHiking\nMusic",
  style: {
    accent: "#7352C7",
    template: "signature",
    fontSize: 9,
    showPhoto: true,
    showQr: true,
  },
};

export function blankProject(): CvProject {
  return {
    version: 1,
    profile: {
      name: "",
      title: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      summary: "",
      photo: "",
    },
    experience: [],
    education: [],
    projects: [],
    skills: [],
    links: [],
    languages: "",
    hobbies: "",
    style: { ...sampleProject.style },
  };
}

export function parseProject(input: unknown): CvProject {
  const p = projectSchema.parse(input);
  if (
    p.profile.photo &&
    !/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(
      p.profile.photo,
    )
  )
    throw new Error("The photo must be a supported image.");
  return p;
}

export function normalizeUrl(value: string): string | null {
  const s = value.trim();
  if (!s) return null;
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
    const u = new URL(candidate);
    if (
      !["http:", "https:"].includes(u.protocol) ||
      !u.hostname ||
      u.username ||
      u.password
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}

export const STORAGE_KEY = "proamine-cv-studio:v1";
export const RECOVERY_KEY = "proamine-cv-studio:recovery";
export function readRecoveryData(): string {
  try {
    const recovery = localStorage.getItem(RECOVERY_KEY);
    if (recovery) return recovery;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        parseProject(JSON.parse(saved));
      } catch {
        return saved;
      }
    }
  } catch {
    /* Storage is optional. */
  }
  return "";
}

export function saveProject(project: CvProject) {
  parseProject(project);
  const previous = localStorage.getItem(STORAGE_KEY);
  if (previous) {
    let valid = false;
    try {
      parseProject(JSON.parse(previous));
      valid = true;
    } catch {
      /* Preserve the original before replacing it. */
    }
    if (!valid && localStorage.getItem(RECOVERY_KEY) !== previous)
      localStorage.setItem(RECOVERY_KEY, previous);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}
export function loadProject(): CvProject {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return parseProject(JSON.parse(saved));
      } catch {
        localStorage.setItem(RECOVERY_KEY, saved);
      }
    }
  } catch {
    /* The editor remains usable if browser storage is unavailable. */
  }
  return structuredClone(sampleProject);
}
export function filename(p: CvProject): string {
  return (
    (p.profile.name.trim() || "my-cv")
      .replace(/[^\p{L}\p{N}-]+/gu, "-")
      .replace(/^-|-$/g, "") || "my-cv"
  );
}
