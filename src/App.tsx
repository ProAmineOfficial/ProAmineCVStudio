import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Award,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileImage,
  FileJson,
  FileText,
  Github,
  GraduationCap,
  Layers3,
  LayoutTemplate,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Monitor,
  Palette,
  Plus,
  QrCode,
  RotateCcw,
  Printer,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
  ZoomIn,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CvCanvas } from "./CvCanvas";
import { buildLayout } from "./layout";
import type { Measure } from "./layout";
import {
  blankProject,
  filename,
  loadProject,
  normalizeUrl,
  parseProject,
  sampleProject,
  readRecoveryData,
  saveProject,
  uid,
} from "./model";
import type { CvProject, Step } from "./model";
import { generateQrs } from "./qr";
import type { QrMap } from "./qr";
import {
  download,
  exportImage,
  exportJson,
  exportPdf,
  exportWord,
  loadFonts,
} from "./exports";

const repo = "https://github.com/ProAmineOfficial/ProAmineCVStudio";
const steps: { id: Step; label: string; subtitle: string; icon: LucideIcon }[] =
  [
    {
      id: "profile",
      label: "Personal details",
      subtitle: "A great first impression",
      icon: UserRound,
    },
    {
      id: "experience",
      label: "Experience",
      subtitle: "The work that shaped you",
      icon: BriefcaseBusiness,
    },
    {
      id: "education",
      label: "Education",
      subtitle: "Where your journey began",
      icon: GraduationCap,
    },
    {
      id: "skills",
      label: "Skills & interests",
      subtitle: "What makes you, you",
      icon: Sparkles,
    },
    {
      id: "projects",
      label: "Projects & achievements",
      subtitle: "Let your work speak",
      icon: Award,
    },
    {
      id: "links",
      label: "Links & QR codes",
      subtitle: "Connect your story",
      icon: QrCode,
    },
  ];
const swatches = [
  "#7352C7",
  "#345FC8",
  "#267A74",
  "#30394B",
  "#B26047",
  "#A14775",
];

const fieldLimits: Record<string, number> = {
  "Full name": 120,
  "Professional title": 160,
  "Email address": 160,
  "Phone number": 80,
  Location: 160,
  Website: 500,
  "Professional summary": 10000,
  "Job title": 160,
  "Company or client": 160,
  Dates: 100,
  "Achievements & responsibilities": 12000,
  "Degree or qualification": 200,
  "School or institution": 200,
  "Additional details": 4000,
  "Skill name": 100,
  "Short description": 300,
  Languages: 1000,
  Interests: 1000,
  "Project or achievement": 200,
  "What did you create or achieve?": 8000,
  "Label on your CV": 100,
  "Website address": 2000,
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  wide,
  textarea,
  hint,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  wide?: boolean;
  textarea?: boolean;
  hint?: string;
  type?: string;
}) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {textarea ? (
        <textarea
          maxLength={fieldLimits[label] ?? 1000}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
        />
      ) : (
        <input
          maxLength={fieldLimits[label] ?? 1000}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="toggle">
      <span>{children}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}
function IconButton({
  children,
  label,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [project, setProject] = useState<CvProject>(loadProject);
  const [step, setStep] = useState<Step>("profile");
  const [qrs, setQrs] = useState<QrMap>({});
  const [fontsReady, setFontsReady] = useState(false);
  const [qrReady, setQrReady] = useState(false);
  const [qrErrors, setQrErrors] = useState<string[]>([]);
  const [recovery, setRecovery] = useState(readRecoveryData);
  const [currentPage, setCurrentPage] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [readyExport, setReadyExport] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [toast, setToast] = useState("");
  const [saved, setSaved] = useState(true);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    photoInput = useRef<HTMLInputElement>(null),
    exportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const isDemo = project.profile.email === "alex@example.com";

  useEffect(() => {
    let alive = true;
    Promise.all([
      document.fonts.load("400 12px Montserrat"),
      document.fonts.load("700 12px Montserrat"),
      loadFonts(),
    ])
      .then(() => {
        if (alive) setFontsReady(true);
      })
      .catch(() => {
        if (alive)
          setToast(
            "The preview font could not load. Please refresh and try again.",
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    setSaved(false);
    const timeout = setTimeout(() => {
      try {
        saveProject(project);
        setSaved(true);
      } catch {
        setToast(
          "Browser storage is full or unavailable. Save a JSON backup to keep your work.",
        );
      }
    }, 450);
    return () => clearTimeout(timeout);
  }, [project]);
  useEffect(() => {
    let active = true;
    setQrReady(false);
    const t = setTimeout(
      () =>
        generateQrs(project.links, (ids) => {
          if (active) setQrErrors(ids);
        })
          .then((result) => {
            if (active) {
              setQrs(result);
              setQrReady(true);
            }
          })
          .catch((error) => {
            if (active) setToast(error.message);
          }),
      350,
    );
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [project.links]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(
    () => () => {
      if (readyExport) URL.revokeObjectURL(readyExport.url);
    },
    [readyExport],
  );
  useEffect(() => {
    const listener = (e: PointerEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportOpen(false);
    };
    document.addEventListener("pointerdown", listener);
    return () => document.removeEventListener("pointerdown", listener);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExportOpen(false);
        setHelpOpen(false);
        setResetOpen(false);
        setNavOpen(false);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!helpOpen && !resetOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex="0"]',
        ) ?? [],
      );
    controls()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = controls(),
        first = items[0],
        last = items[items.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !dialog?.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !dialog?.contains(document.activeElement))
      ) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [helpOpen, resetOpen]);
  useEffect(() => {
    if (!exportOpen) return;
    const root = exportRef.current,
      items = Array.from(
        root?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
      );
    items[0]?.focus();
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape") root?.querySelector("button")?.focus();
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const current = items.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      const next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? items.length - 1
            : (current + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length;
      items[next]?.focus();
    };
    root?.addEventListener("keydown", keyboard);
    return () => root?.removeEventListener("keydown", keyboard);
  }, [exportOpen]);

  const measure: Measure = useMemo(() => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    return (value, size, bold = false) => {
      ctx.font = `${bold ? 700 : 400} ${size}px Montserrat`;
      return ctx.measureText(value).width;
    };
  }, [fontsReady]);
  const pages = useMemo(
    () => buildLayout(project, qrs, measure),
    [project, qrs, measure],
  );
  useEffect(() => {
    setCurrentPage((p) => Math.min(p, pages.length - 1));
  }, [pages.length]);
  const chosen = steps.find((s) => s.id === step)!;
  const validLinks = project.links.filter((l) => normalizeUrl(l.url)).length;
  const progress = [
    !!project.profile.name,
    !!project.profile.summary,
    project.experience.some((e) => e.role),
    project.education.some((e) => e.degree),
    project.skills.some((s) => s.name),
    validLinks > 0,
  ].filter(Boolean).length;
  const setProfile = (key: keyof CvProject["profile"], value: string) =>
    setProject((p) => ({ ...p, profile: { ...p.profile, [key]: value } }));
  const setStyle = (patch: Partial<CvProject["style"]>) =>
    setProject((p) => ({ ...p, style: { ...p.style, ...patch } }));
  const update = <
    K extends "experience" | "education" | "projects" | "skills" | "links",
  >(
    key: K,
    id: string,
    patch: Partial<CvProject[K][number]>,
  ) =>
    setProject((p) => ({
      ...p,
      [key]: p[key].map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  const remove = (
    key: "experience" | "education" | "projects" | "skills" | "links",
    id: string,
  ) => setProject((p) => ({ ...p, [key]: p[key].filter((e) => e.id !== id) }));
  const add = () => {
    const limits = {
      experience: 30,
      education: 20,
      projects: 30,
      skills: 24,
      links: 20,
    };
    if (step !== "profile" && project[step].length >= limits[step]) {
      setToast(
        `This CV already has the maximum of ${limits[step]} ${step} entries.`,
      );
      return;
    }
    if (step === "experience")
      setProject((p) => ({
        ...p,
        experience: [
          ...p.experience,
          { id: uid(), role: "", company: "", period: "", description: "" },
        ],
      }));
    if (step === "education")
      setProject((p) => ({
        ...p,
        education: [
          ...p.education,
          { id: uid(), degree: "", school: "", period: "", description: "" },
        ],
      }));
    if (step === "projects")
      setProject((p) => ({
        ...p,
        projects: [...p.projects, { id: uid(), name: "", description: "" }],
      }));
    if (step === "skills")
      setProject((p) => ({
        ...p,
        skills: [...p.skills, { id: uid(), name: "", description: "" }],
      }));
    if (step === "links")
      setProject((p) => ({
        ...p,
        links: [...p.links, { id: uid(), label: "", url: "", icon: "none" }],
      }));
  };

  async function readPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 12 * 1024 * 1024
    ) {
      setToast("Choose a PNG, JPG, or WebP photo smaller than 12 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 600;
      canvas
        .getContext("2d")!
        .drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          600,
          600,
        );
      setProfile("photo", canvas.toDataURL("image/jpeg", 0.9));
      setStyle({ showPhoto: true });
    } catch {
      setToast("This photo could not be opened. Please try another image.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function importProject(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error();
      const next = parseProject(JSON.parse(await file.text()));
      setProject(next);
      setCurrentPage(0);
      setToast("Your project is ready. Welcome back.");
    } catch {
      setToast(
        "This is not a valid CV Studio JSON project. Please choose a JSON backup exported from this app.",
      );
    }
  }
  async function performExport(
    format: "pdf" | "docx" | "png" | "jpeg" | "json",
  ) {
    if (
      format !== "json" &&
      (!fontsReady || (project.style.showQr && !qrReady))
    ) {
      setToast(
        "Preparing your fonts and QR codes. Please try again in a moment.",
      );
      return;
    }
    if (format !== "json" && project.style.showQr && qrErrors.length) {
      setToast(
        "A link is too long to encode as QR. Shorten it or turn off QR codes in Links & QR codes. Your JSON backup is still available.",
      );
      return;
    }
    setBusy(format);
    setExportOpen(false);
    const offerDownload = (blob: Blob, name: string) => {
      setReadyExport({ url: URL.createObjectURL(blob), name });
      download(blob, name);
    };
    try {
      if (format === "json") exportJson(project);
      else if (format === "pdf")
        offerDownload(
          await exportPdf(project, pages, setBusy),
          filename(project) + ".pdf",
        );
      else if (format === "docx")
        offerDownload(
          await exportWord(project, qrs),
          filename(project) + ".docx",
        );
      else if (pages.length === 1)
        offerDownload(
          await exportImage(pages[0], format),
          filename(project) + (format === "jpeg" ? ".jpg" : ".png"),
        );
      else {
        const JSZip = (await import("jszip")).default,
          zip = new JSZip();
        for (let i = 0; i < pages.length; i++)
          zip.file(
            `${filename(project)}-page-${i + 1}.${format === "jpeg" ? "jpg" : "png"}`,
            await exportImage(pages[i], format),
          );
        offerDownload(
          await zip.generateAsync({ type: "blob" }),
          `${filename(project)}-${format}-pages.zip`,
        );
      }
      setToast(
        format === "json"
          ? "Project backup downloaded. Keep it to edit your CV later."
          : "Your export is ready. Make your next move.",
      );
    } catch (error) {
      console.error("Export failed", format);
      setToast(
        error instanceof Error
          ? error.message
          : "The export could not finish. Please try again.",
      );
    } finally {
      setBusy("");
    }
  }

  const stepIndex = steps.findIndex((s) => s.id === step);
  return (
    <>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="ambient ambient-three" aria-hidden="true" />
      <a className="skip-link" href="#editor">
        Skip to CV editor
      </a>
      <header className="topbar glass">
        <a href="#" className="brand" aria-label="ProAmine CV Studio home">
          <span className="brand-mark">
            <Layers3 size={23} strokeWidth={1.8} />
          </span>
          <span>
            ProAmine<span className="brand-light">CV Studio</span>
          </span>
          <span className="beta-tag">BETA</span>
        </a>
        <nav className="top-actions" aria-label="Project actions">
          <span className="save-state">
            {saved ? (
              <CheckCheck size={14} />
            ) : (
              <LoaderCircle size={14} className="spin" />
            )}
            <span>{saved ? "Saved on this device" : "Saving…"}</span>
          </span>
          <button
            className="quiet-button import-top"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} />
            Open project
          </button>
          <a
            className="github-button"
            href={repo}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
          >
            <Github size={19} />
            <ArrowUpRight size={12} />
          </a>
          <div className="export-wrap" ref={exportRef}>
            <button
              className="export-main"
              onClick={() => setExportOpen((v) => !v)}
              disabled={!!busy}
              aria-expanded={exportOpen}
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <ArrowDownToLine size={16} />
              )}
              <span>
                {busy
                  ? busy.includes("…")
                    ? busy
                    : "Preparing…"
                  : "Export CV"}
              </span>
              <ChevronDown size={15} />
            </button>
            {exportOpen && (
              <div className="export-menu glass" role="menu">
                <div className="menu-eyebrow">YOUR CV, EVERYWHERE</div>
                {(
                  [
                    {
                      format: "pdf",
                      label: "PDF document",
                      desc: "All pages · selectable text",
                      icon: FileText,
                    },
                    {
                      format: "docx",
                      label: "Editable Word",
                      desc: "Edit your text in Microsoft Word",
                      icon: FileText,
                    },
                    {
                      format: "png",
                      label: pages.length > 1 ? "PNG pages (ZIP)" : "PNG image",
                      desc: "High resolution · 300 DPI size",
                      icon: FileImage,
                    },
                    {
                      format: "jpeg",
                      label: pages.length > 1 ? "JPG pages (ZIP)" : "JPG image",
                      desc: "A lightweight image of every page",
                      icon: FileImage,
                    },
                    {
                      format: "json",
                      label: "Project backup",
                      desc: "Reopen and continue editing later",
                      icon: FileJson,
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.format}
                    role="menuitem"
                    onClick={() => performExport(item.format)}
                  >
                    <span className="export-icon">
                      <item.icon size={18} />
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.desc}</small>
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
                <button
                  role="menuitem"
                  onClick={() => {
                    setExportOpen(false);
                    window.print();
                  }}
                >
                  <span className="export-icon">
                    <Printer size={18} />
                  </span>
                  <span>
                    <strong>Print / Save PDF</strong>
                    <small>Browser fonts · additional writing systems</small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
                <p>
                  <LockKeyhole size={12} />
                  Created in your browser. Always free.
                </p>
              </div>
            )}
          </div>
        </nav>
      </header>

      <main className="app-shell">
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span />A LITTLE STUDIO. A BIG NEXT STEP.
            </div>
            <h1>
              Your story,
              <br className="mobile-br" /> beautifully presented<span>.</span>
            </h1>
            <p>A CV that opens doors. A workspace that gets out of your way.</p>
          </div>
          <div className="intro-note glass">
            <span className="note-icon">
              <ShieldCheck size={20} />
            </span>
            <div>
              <strong>Entirely yours.</strong>
              <span>Free to create. Free to download.</span>
            </div>
          </div>
        </section>

        {readyExport && (
          <div className="download-ready glass" role="status">
            <span className="heading-icon">
              <Check size={19} />
            </span>
            <div>
              <strong>Your file is ready.</strong>
              <span>{readyExport.name}</span>
            </div>
            <a href={readyExport.url} download={readyExport.name}>
              Download file
              <ArrowDownToLine size={15} />
            </a>
            <IconButton
              label="Dismiss download"
              onClick={() => setReadyExport(null)}
            >
              <X size={15} />
            </IconButton>
          </div>
        )}

        {recovery && (
          <div className="recovery-banner glass" role="alert">
            <span>
              A saved project could not be opened. Its original data has been
              kept for recovery.
            </span>
            <button
              onClick={() =>
                download(
                  new Blob([recovery], { type: "application/json" }),
                  "cv-recovery.json",
                )
              }
            >
              Download recovery data
              <FileJson size={14} />
            </button>
            <IconButton
              label="Dismiss recovery notice"
              onClick={() => setRecovery("")}
            >
              <X size={15} />
            </IconButton>
          </div>
        )}
        <div className="mobile-switch glass">
          <button
            className={!mobilePreview ? "active" : ""}
            onClick={() => setMobilePreview(false)}
          >
            <Palette size={16} />
            Edit your CV
          </button>
          <button
            className={mobilePreview ? "active" : ""}
            onClick={() => setMobilePreview(true)}
          >
            <Monitor size={16} />
            Live preview
          </button>
        </div>

        <div className={`workspace ${mobilePreview ? "show-preview" : ""}`}>
          <aside
            className={`sidebar glass ${navOpen ? "nav-open" : ""}`}
            aria-label="CV sections"
          >
            <div className="sidebar-heading">
              <span>YOUR WORKSPACE</span>
              <IconButton
                label="Close navigation"
                onClick={() => setNavOpen(false)}
              >
                <X size={16} />
              </IconButton>
            </div>
            <div className="section-nav">
              {steps.map((s, i) => (
                <button
                  key={s.id}
                  className={step === s.id ? "active" : ""}
                  onClick={() => {
                    setStep(s.id);
                    setNavOpen(false);
                  }}
                  aria-current={step === s.id ? "step" : undefined}
                >
                  <s.icon size={18} strokeWidth={1.7} />
                  <span>{s.label}</span>
                  <small>{String(i + 1).padStart(2, "0")}</small>
                </button>
              ))}
            </div>
            <div className="sidebar-divider" />
            <div className="sidebar-progress">
              <div>
                <span>Your story is taking shape</span>
                <strong>{progress}/6</strong>
              </div>
              <div className="progress-track">
                <i style={{ width: `${(progress / 6) * 100}%` }} />
              </div>
              <small>Add what matters. Leave out what doesn’t.</small>
            </div>
            <div className="sidebar-bottom">
              <button onClick={() => setHelpOpen(true)}>
                <CircleHelp size={17} />A little guidance
                <ArrowUpRight size={13} />
              </button>
              <button onClick={() => setResetOpen(true)}>
                <RotateCcw size={16} />
                Start a new CV
              </button>
            </div>
            <div className="open-source-note">
              <Github size={18} />
              <span>
                Made with care.
                <br />
                <a href={repo} target="_blank" rel="noopener noreferrer">
                  Open to everyone.
                </a>
              </span>
            </div>
          </aside>

          <section className="editor-stack" id="editor" aria-label="CV editor">
            <div className="editor-card glass">
              <div className="editor-heading">
                <div>
                  <div className="editor-step">
                    STEP {String(stepIndex + 1).padStart(2, "0")}{" "}
                    <span>/ 06</span>
                  </div>
                  <h2>{chosen.label}</h2>
                  <p>{chosen.subtitle}.</p>
                </div>
                <span className="heading-icon">
                  <chosen.icon size={23} strokeWidth={1.5} />
                </span>
                <button
                  className="mobile-nav-button icon-button"
                  aria-label="Open section navigation"
                  onClick={() => setNavOpen(true)}
                >
                  <Menu size={19} />
                </button>
              </div>

              {step === "profile" && (
                <>
                  <div className="photo-row">
                    <div className="photo-avatar">
                      {project.profile.photo ? (
                        <img
                          src={project.profile.photo}
                          alt="Your profile photo"
                        />
                      ) : (
                        <UserRound size={28} strokeWidth={1.2} />
                      )}
                    </div>
                    <div>
                      <button
                        className="small-button"
                        onClick={() => photoInput.current?.click()}
                      >
                        <Upload size={14} />
                        {project.profile.photo
                          ? "Change photo"
                          : "Upload a photo"}
                      </button>
                      <small>Optional. JPG, PNG or WebP.</small>
                    </div>
                    {project.profile.photo && (
                      <IconButton
                        label="Remove photo"
                        onClick={() => setProfile("photo", "")}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    )}
                  </div>
                  <div className="fields-grid">
                    <Field
                      label="Full name"
                      value={project.profile.name}
                      onChange={(v) => setProfile("name", v)}
                      placeholder="Your first and last name"
                      wide
                    />
                    <Field
                      label="Professional title"
                      value={project.profile.title}
                      onChange={(v) => setProfile("title", v)}
                      placeholder="What do you do best?"
                      wide
                    />
                    <Field
                      label="Email address"
                      type="email"
                      value={project.profile.email}
                      onChange={(v) => setProfile("email", v)}
                      placeholder="you@example.com"
                    />
                    <Field
                      label="Phone number"
                      type="tel"
                      value={project.profile.phone}
                      onChange={(v) => setProfile("phone", v)}
                      placeholder="+44…"
                    />
                    <Field
                      label="Location"
                      value={project.profile.location}
                      onChange={(v) => setProfile("location", v)}
                      placeholder="City, country"
                    />
                    <Field
                      label="Website"
                      value={project.profile.website}
                      onChange={(v) => setProfile("website", v)}
                      placeholder="https://your-website.com"
                    />
                    <Field
                      label="Professional summary"
                      value={project.profile.summary}
                      onChange={(v) => setProfile("summary", v)}
                      placeholder="A few lines about your experience and the value you bring."
                      wide
                      textarea
                      hint="Keep it personal and specific. A short paragraph is a great start."
                    />
                  </div>
                </>
              )}

              {step === "experience" && (
                <>
                  <div className="editor-tip">
                    <BriefcaseBusiness size={17} />
                    <span>
                      Lead with your most recent role. Use one achievement per
                      line.
                    </span>
                  </div>
                  {project.experience.map((e, i) => (
                    <div className="entry-card" key={e.id}>
                      <div className="entry-top">
                        <span>EXPERIENCE {String(i + 1).padStart(2, "0")}</span>
                        <IconButton
                          label={`Remove experience ${i + 1}`}
                          onClick={() => remove("experience", e.id)}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                      <div className="fields-grid">
                        <Field
                          label="Job title"
                          value={e.role}
                          onChange={(v) =>
                            update("experience", e.id, { role: v })
                          }
                          wide
                        />
                        <Field
                          label="Company or client"
                          value={e.company}
                          onChange={(v) =>
                            update("experience", e.id, { company: v })
                          }
                        />
                        <Field
                          label="Dates"
                          value={e.period}
                          onChange={(v) =>
                            update("experience", e.id, { period: v })
                          }
                          placeholder="2022 — Present"
                        />
                        <Field
                          label="Achievements & responsibilities"
                          value={e.description}
                          onChange={(v) =>
                            update("experience", e.id, { description: v })
                          }
                          wide
                          textarea
                        />
                      </div>
                    </div>
                  ))}
                  <button className="add-entry" onClick={add}>
                    <Plus size={17} />
                    Add experience
                  </button>
                </>
              )}

              {step === "education" && (
                <>
                  {project.education.map((e, i) => (
                    <div className="entry-card" key={e.id}>
                      <div className="entry-top">
                        <span>EDUCATION {String(i + 1).padStart(2, "0")}</span>
                        <IconButton
                          label={`Remove education ${i + 1}`}
                          onClick={() => remove("education", e.id)}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                      <div className="fields-grid">
                        <Field
                          label="Degree or qualification"
                          value={e.degree}
                          onChange={(v) =>
                            update("education", e.id, { degree: v })
                          }
                          wide
                        />
                        <Field
                          label="School or institution"
                          value={e.school}
                          onChange={(v) =>
                            update("education", e.id, { school: v })
                          }
                        />
                        <Field
                          label="Dates"
                          value={e.period}
                          onChange={(v) =>
                            update("education", e.id, { period: v })
                          }
                        />
                        <Field
                          label="Additional details"
                          value={e.description}
                          onChange={(v) =>
                            update("education", e.id, { description: v })
                          }
                          wide
                          textarea
                          hint="Optional. Focus, coursework, or an achievement."
                        />
                      </div>
                    </div>
                  ))}
                  <button className="add-entry" onClick={add}>
                    <Plus size={17} />
                    Add education
                  </button>
                </>
              )}

              {step === "skills" && (
                <>
                  <div className="editor-tip">
                    <Sparkles size={17} />
                    <span>
                      Your Signature template gives each skill its own circle.
                      These are labels, not proficiency scores.
                    </span>
                  </div>
                  {project.skills.map((e, i) => (
                    <div className="entry-card skill-entry" key={e.id}>
                      <div className="entry-top">
                        <span>SKILL {String(i + 1).padStart(2, "0")}</span>
                        <IconButton
                          label={`Remove skill ${i + 1}`}
                          onClick={() => remove("skills", e.id)}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                      <div className="fields-grid">
                        <Field
                          label="Skill name"
                          value={e.name}
                          onChange={(v) => update("skills", e.id, { name: v })}
                          wide
                        />
                        <Field
                          label="Short description"
                          value={e.description}
                          onChange={(v) =>
                            update("skills", e.id, { description: v })
                          }
                          wide
                          placeholder="Tools, strengths, or how you use this skill"
                        />
                      </div>
                    </div>
                  ))}
                  <button className="add-entry" onClick={add}>
                    <Plus size={17} />
                    Add a skill
                  </button>
                  <div className="fields-grid secondary-fields">
                    <Field
                      label="Languages"
                      value={project.languages}
                      onChange={(v) =>
                        setProject((p) => ({ ...p, languages: v }))
                      }
                      textarea
                      wide
                      hint="One per line. Add your level in your own words."
                    />
                    <Field
                      label="Interests"
                      value={project.hobbies}
                      onChange={(v) =>
                        setProject((p) => ({ ...p, hobbies: v }))
                      }
                      textarea
                      wide
                      hint="Optional. A little personality goes a long way."
                    />
                  </div>
                </>
              )}

              {step === "projects" && (
                <>
                  <div className="editor-tip">
                    <Award size={17} />
                    <span>
                      Projects, innovations, awards — show the work you’re proud
                      of. Add their URLs in Links & QR codes.
                    </span>
                  </div>
                  {project.projects.map((e, i) => (
                    <div className="entry-card" key={e.id}>
                      <div className="entry-top">
                        <span>PROJECT {String(i + 1).padStart(2, "0")}</span>
                        <IconButton
                          label={`Remove project ${i + 1}`}
                          onClick={() => remove("projects", e.id)}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                      <div className="fields-grid">
                        <Field
                          label="Project or achievement"
                          value={e.name}
                          onChange={(v) =>
                            update("projects", e.id, { name: v })
                          }
                          wide
                        />
                        <Field
                          label="What did you create or achieve?"
                          value={e.description}
                          onChange={(v) =>
                            update("projects", e.id, { description: v })
                          }
                          wide
                          textarea
                        />
                      </div>
                    </div>
                  ))}
                  <button className="add-entry" onClick={add}>
                    <Plus size={17} />
                    Add a project or achievement
                  </button>
                </>
              )}

              {step === "links" && (
                <>
                  <div className="editor-tip">
                    <QrCode size={18} />
                    <span>
                      Let someone scan straight to your work. Add a portfolio,
                      GitHub repository, social profile, or document.
                    </span>
                  </div>
                  {project.links.map((l, i) => (
                    <div className="entry-card link-entry" key={l.id}>
                      <div className="entry-top">
                        <span>LINK {String(i + 1).padStart(2, "0")}</span>
                        <IconButton
                          label={`Remove link ${i + 1}`}
                          onClick={() => remove("links", l.id)}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                      <div className="link-fields">
                        <div className="fields-grid">
                          <Field
                            label="Label on your CV"
                            value={l.label}
                            onChange={(v) =>
                              update("links", l.id, { label: v })
                            }
                            wide
                            placeholder="e.g. Portfolio, LinkedIn, Project demo"
                          />
                          <Field
                            label="Website address"
                            value={l.url}
                            onChange={(v) => update("links", l.id, { url: v })}
                            wide
                            placeholder="https://…"
                          />
                          <label className="field wide">
                            <span>Center icon</span>
                            <select
                              value={l.icon}
                              onChange={(e) =>
                                update("links", l.id, {
                                  icon: e.target
                                    .value as CvProject["links"][number]["icon"],
                                })
                              }
                            >
                              <option value="none">No icon</option>
                              <option value="globe">Website</option>
                              <option value="github">GitHub</option>
                              <option value="linkedin">LinkedIn</option>
                              <option value="document">Document</option>
                              <option value="chip">Microchip</option>
                            </select>
                          </label>
                        </div>
                        <div className="qr-thumbnail">
                          {qrs[l.id] && normalizeUrl(l.url) ? (
                            <img
                              src={qrs[l.id]}
                              alt={`QR code for ${l.label || "your link"}`}
                            />
                          ) : (
                            <QrCode size={40} strokeWidth={1} />
                          )}
                        </div>
                      </div>
                      {l.url.trim() && !normalizeUrl(l.url) && (
                        <p className="field-error">
                          Enter a valid http:// or https:// website address.
                        </p>
                      )}
                      {qrErrors.includes(l.id) && (
                        <p className="field-error">
                          This link is too long for a QR code. Use a shorter
                          address or turn off QR codes.
                        </p>
                      )}
                    </div>
                  ))}
                  <button className="add-entry" onClick={add}>
                    <Plus size={17} />
                    Add a link & QR code
                  </button>
                  <Toggle
                    checked={project.style.showQr}
                    onChange={(v) => setStyle({ showQr: v })}
                  >
                    Show QR codes on my CV
                  </Toggle>
                </>
              )}

              <div className="editor-footer">
                <span>
                  <LockKeyhole size={13} />
                  Your information stays in your browser
                </span>
                <button
                  className="next-button"
                  onClick={() =>
                    setStep(steps[(stepIndex + 1) % steps.length].id)
                  }
                >
                  {stepIndex === steps.length - 1
                    ? "Back to details"
                    : "Next section"}
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>

            <section className="style-card glass" aria-label="CV appearance">
              <div className="style-title">
                <span>
                  <Palette size={18} />
                  Make it yours
                </span>
                <span>THE DETAILS MATTER</span>
              </div>
              <div className="template-options">
                <button
                  className={
                    project.style.template === "signature" ? "selected" : ""
                  }
                  onClick={() => setStyle({ template: "signature" })}
                >
                  <span className="template-mini signature-mini">
                    <i style={{ background: project.style.accent }} />
                    <b />
                    <b />
                    <b />
                  </span>
                  <span>
                    <strong>Signature</strong>
                    <small>Expressive. Distinctly you.</small>
                  </span>
                  {project.style.template === "signature" && (
                    <Check size={15} />
                  )}
                </button>
                <button
                  className={
                    project.style.template === "minimal" ? "selected" : ""
                  }
                  onClick={() => setStyle({ template: "minimal" })}
                >
                  <span className="template-mini minimal-mini">
                    <b />
                    <b />
                    <b />
                  </span>
                  <span>
                    <strong>Minimal</strong>
                    <small>Clean. Content comes first.</small>
                  </span>
                  {project.style.template === "minimal" && <Check size={15} />}
                </button>
              </div>
              <div className="color-row">
                <span>Accent color</span>
                <div className="swatches">
                  {swatches.map((c) => (
                    <button
                      key={c}
                      style={{ backgroundColor: c }}
                      aria-label={`Use accent color ${c}`}
                      aria-pressed={
                        project.style.accent.toLowerCase() === c.toLowerCase()
                      }
                      onClick={() => setStyle({ accent: c })}
                    >
                      {project.style.accent.toLowerCase() ===
                        c.toLowerCase() && <Check size={14} />}
                    </button>
                  ))}
                  <label
                    className="custom-color"
                    title="Choose a custom accent color"
                  >
                    <Plus size={14} />
                    <input
                      type="color"
                      value={project.style.accent}
                      onChange={(e) => setStyle({ accent: e.target.value })}
                      aria-label="Custom accent color"
                    />
                  </label>
                </div>
              </div>
              <div className="type-row">
                <label htmlFor="type-size">Document text size</label>
                <input
                  id="type-size"
                  type="range"
                  min="8"
                  max="12"
                  step=".5"
                  value={project.style.fontSize}
                  onChange={(e) =>
                    setStyle({ fontSize: Number(e.target.value) })
                  }
                />
                <span>{project.style.fontSize} pt</span>
              </div>
              <Toggle
                checked={project.style.showPhoto}
                onChange={(v) => setStyle({ showPhoto: v })}
              >
                Include profile photo
              </Toggle>
            </section>
          </section>

          <section className="preview-stack" aria-label="Live CV preview">
            <div className="preview-top">
              <div>
                <span className="live-dot" />
                LIVE PREVIEW
                <span className="preview-divider" />
                A4 DOCUMENT
              </div>
              <div className="preview-tools">
                <IconButton
                  label="Zoom out"
                  disabled={zoom <= 70}
                  onClick={() => setZoom((z) => z - 10)}
                >
                  <span className="minus">−</span>
                </IconButton>
                <span>{zoom}%</span>
                <IconButton
                  label="Zoom in"
                  disabled={zoom >= 130}
                  onClick={() => setZoom((z) => z + 10)}
                >
                  <ZoomIn size={14} />
                </IconButton>
              </div>
            </div>
            <div className="preview-surface glass">
              <div className="preview-status">
                {isDemo ? (
                  <span>
                    <Sparkles size={12} />
                    Sample content · make it your own
                  </span>
                ) : (
                  <span>
                    <Check size={12} />
                    Updated as you type
                  </span>
                )}
                <span>
                  <LayoutTemplate size={12} />
                  {project.style.template === "signature"
                    ? "Signature"
                    : "Minimal"}
                </span>
              </div>
              <div className="paper-scroller">
                <div
                  className="paper"
                  style={{
                    width: `${zoom}%`,
                    maxWidth: zoom <= 100 ? "100%" : "none",
                  }}
                >
                  {fontsReady ? (
                    <CvCanvas page={pages[currentPage] || pages[0]} />
                  ) : (
                    <div className="loading-paper">
                      <LoaderCircle className="spin" size={24} />
                      <span>Preparing your canvas…</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="preview-pagination">
                <span>
                  {pages.length === 1
                    ? "One page. Your whole story."
                    : `${pages.length} pages · more room for your story`}
                </span>
                <div>
                  <IconButton
                    label="Previous CV page"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft size={15} />
                  </IconButton>
                  <span>
                    {currentPage + 1}
                    <small> / {pages.length}</small>
                  </span>
                  <IconButton
                    label="Next CV page"
                    disabled={currentPage >= pages.length - 1}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight size={15} />
                  </IconButton>
                </div>
              </div>
            </div>
            <div className="preview-bottom">
              <span>
                <ShieldCheck size={15} />
                No account. No watermark. No payment.
              </span>
              <button onClick={() => setHelpOpen(true)}>
                Export guide
                <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="format-strip">
              <span>Ready for wherever you’re going.</span>
              <div>
                <span>PDF</span>
                <span>WORD</span>
                <span>PNG</span>
                <span>JPG</span>
                <span>JSON</span>
              </div>
            </div>
          </section>
        </div>
        <footer className="app-footer">
          <a
            href="https://proamine.tech/"
            target="_blank"
            rel="noopener noreferrer"
          >
            A project by <strong>Pro_Amine</strong>
            <ArrowUpRight size={12} />
          </a>
          <span>Built to help your work find its next home.</span>
          <div>
            <a
              href={repo + "/blob/main/LICENSE"}
              target="_blank"
              rel="noopener noreferrer"
            >
              AGPL-3.0
            </a>
            <a href={repo} target="_blank" rel="noopener noreferrer">
              View source
              <ArrowUpRight size={12} />
            </a>
          </div>
        </footer>
      </main>

      <input
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        ref={fileInput}
        onChange={importProject}
        aria-label="Import CV project JSON"
      />
      <input
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        ref={photoInput}
        onChange={readPhoto}
        aria-label="Upload profile photo"
      />
      {toast && (
        <div className="toast glass" role="status">
          <span className="toast-mark">
            <Check size={15} />
          </span>
          <p>{toast}</p>
          <IconButton label="Dismiss notification" onClick={() => setToast("")}>
            <X size={15} />
          </IconButton>
        </div>
      )}
      {helpOpen && (
        <div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
          <section
            className="modal glass"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <span className="heading-icon">
                <CircleHelp size={23} />
              </span>
              <IconButton
                label="Close guide"
                onClick={() => setHelpOpen(false)}
              >
                <X size={19} />
              </IconButton>
            </div>
            <h2 id="guide-title">A little guidance.</h2>
            <p>
              Your CV is yours to shape. Start with your details, add the work
              that matters, then choose a look that feels right.
            </p>
            <div className="guide-item">
              <FileText size={21} />
              <div>
                <strong>PDF for sharing. Word for editing.</strong>
                <p>
                  PDF keeps your layout and includes selectable text. For
                  writing systems outside the bundled font, choose Print / Save
                  PDF and select Save as PDF in your browser. Word exports
                  editable text and a matching two-column structure; pagination
                  can vary between Word versions and fonts.
                </p>
              </div>
            </div>
            <div className="guide-item">
              <QrCode size={21} />
              <div>
                <strong>Make your work easy to find.</strong>
                <p>
                  Use a clear label for every QR code. Check that linked
                  documents are accessible to the people you share your CV with.
                </p>
              </div>
            </div>
            <div className="guide-item">
              <FileJson size={21} />
              <div>
                <strong>Keep a project backup.</strong>
                <p>
                  Your CV saves in this browser. Download JSON to keep a
                  portable backup, then use Open project to continue on another
                  device. Browser storage can be cleared.
                </p>
              </div>
            </div>
            <div className="guide-item">
              <LayoutTemplate size={21} />
              <div>
                <strong>Choose a template for the occasion.</strong>
                <p>
                  Signature follows a visual portfolio style. Minimal puts the
                  same content in a straightforward single column. Check the
                  receiving employer’s upload instructions.
                </p>
              </div>
            </div>
            <button
              className="export-main modal-close"
              onClick={() => setHelpOpen(false)}
            >
              Back to my CV
              <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
      {resetOpen && (
        <div className="modal-backdrop" onClick={() => setResetOpen(false)}>
          <section
            className="modal small-modal glass"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <span className="heading-icon">
                <FileText size={22} />
              </span>
              <IconButton
                label="Close new CV dialog"
                onClick={() => setResetOpen(false)}
              >
                <X size={19} />
              </IconButton>
            </div>
            <h2 id="new-title">A fresh page.</h2>
            <p>
              Save a JSON backup first if you’d like to keep your current CV.
              Starting again replaces the project saved in this browser.
            </p>
            <button
              className="export-main full-button"
              onClick={() => {
                exportJson(project);
                setToast("Your backup is downloaded.");
              }}
            >
              Save my current project
              <FileJson size={16} />
            </button>
            <div className="new-options">
              <button
                onClick={() => {
                  setProject(blankProject());
                  setStep("profile");
                  setCurrentPage(0);
                  setResetOpen(false);
                }}
              >
                Start with a blank CV
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => {
                  setProject(structuredClone(sampleProject));
                  setStep("profile");
                  setCurrentPage(0);
                  setResetOpen(false);
                }}
              >
                Explore the example
                <Sparkles size={16} />
              </button>
            </div>
          </section>
        </div>
      )}
      <div className="print-pages" aria-hidden="true">
        {pages.map((page, i) => (
          <CvCanvas key={i} page={page} />
        ))}
      </div>
    </>
  );
}
