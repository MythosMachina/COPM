"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type ModuleDraft = {
  moduleOrder: number;
  moduleType: "TECHSTACK" | "FEATURE" | "CHECK" | "DOMAIN" | "DEPLOY" | "CHANGE" | "FIX" | "ITERATE" | "TEARDOWN" | "CUSTOM";
  title: string;
  description: string;
  gateRequired: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  config?: Record<string, unknown>;
};

type DocDraft = {
  name: string;
  content: string;
};

const emptyDoc = (): DocDraft => ({
  name: "",
  content: "",
});

type TechstackPreset = {
  id: string;
  label: string;
  runtime: string;
  framework: string;
  packageManager: string;
  language: string;
  summary: string;
};

const TECHSTACK_PRESETS: TechstackPreset[] = [
  {
    id: "node-next",
    label: "Node.js + Next.js",
    runtime: "nodejs",
    framework: "nextjs",
    packageManager: "npm",
    language: "typescript",
    summary: "Full-stack web app with SSR and API routes.",
  },
  {
    id: "python-fastapi",
    label: "Python + FastAPI",
    runtime: "python",
    framework: "fastapi",
    packageManager: "pip",
    language: "python",
    summary: "Lean API service with async-first backend architecture.",
  },
  {
    id: "php-laravel",
    label: "PHP + Laravel",
    runtime: "php",
    framework: "laravel",
    packageManager: "composer",
    language: "php",
    summary: "Structured MVC application with rich ecosystem tooling.",
  },
  {
    id: "go-fiber",
    label: "Go + Fiber",
    runtime: "go",
    framework: "fiber",
    packageManager: "go-mod",
    language: "go",
    summary: "High-performance backend with minimal runtime overhead.",
  },
  {
    id: "java-spring",
    label: "Java + Spring Boot",
    runtime: "java",
    framework: "spring-boot",
    packageManager: "maven",
    language: "java",
    summary: "Enterprise-grade service stack with strict typing and tooling.",
  },
  {
    id: "rust-axum",
    label: "Rust + Axum",
    runtime: "rust",
    framework: "axum",
    packageManager: "cargo",
    language: "rust",
    summary: "Memory-safe backend focused on performance and reliability.",
  },
];

function findTechstackPreset(id: string): TechstackPreset {
  return TECHSTACK_PRESETS.find((preset) => preset.id === id) ?? TECHSTACK_PRESETS[0];
}

function expectedStateFor(type: ModuleDraft["moduleType"], title: string): string {
  if (type === "TECHSTACK") return "Techstack baseline scaffolded and validated.";
  if (type === "FEATURE") return "Feature scope implemented and review-ready.";
  if (type === "CHECK") return "Quality checks passed.";
  if (type === "DOMAIN") return "Domain and DNS routed to healthy upstream.";
  if (type === "DEPLOY") return "Deployment verified with runtime evidence.";
  return title.trim() ? `${title.trim()} completed.` : "Module completed.";
}

const defaultModules = (presetId: string): ModuleDraft[] => {
  const preset = findTechstackPreset(presetId);
  return [
  {
    moduleOrder: 1,
    moduleType: "TECHSTACK",
    title: "Techstack Foundation",
    description: `Use ${preset.label} as base runtime and scaffold the production baseline. ${preset.summary}`,
    gateRequired: false,
    riskLevel: "MEDIUM",
    config: {
      presetId: preset.id,
      runtime: preset.runtime,
      framework: preset.framework,
      packageManager: preset.packageManager,
      language: preset.language,
    },
  },
  {
    moduleOrder: 2,
    moduleType: "FEATURE",
    title: "Feature Module",
    description: "Implement project-specific feature scope (API/UI/Auth/Monitoring as required).",
    gateRequired: false,
    riskLevel: "MEDIUM",
  },
  {
    moduleOrder: 3,
    moduleType: "CHECK",
    title: "Quality Gate",
    description: "Run lint/build/runtime-health validation.",
    gateRequired: true,
    riskLevel: "HIGH",
  },
  {
    moduleOrder: 4,
    moduleType: "DOMAIN",
    title: "Domain Provisioning",
    description: "Provision domain with preflight and DNS validation.",
    gateRequired: true,
    riskLevel: "HIGH",
  },
  {
    moduleOrder: 5,
    moduleType: "DEPLOY",
    title: "Deploy and Verify",
    description: "Deploy, verify runtime, create snapshot and sync docs.",
    gateRequired: true,
    riskLevel: "HIGH",
  },
];
};

export function ProjectBootstrapForm() {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [autoProvisionDomain, setAutoProvisionDomain] = useState(false);
  const [runTitle, setRunTitle] = useState("Initial Lifecycle Run");
  const [runMode, setRunMode] = useState<"STEP" | "BATCH">("STEP");
  const [runClassification, setRunClassification] = useState<"BIRTH" | "CHANGE" | "FIX" | "ITERATE" | "TEARDOWN">("BIRTH");
  const [autoStart, setAutoStart] = useState(false);
  const [techstackPresetId, setTechstackPresetId] = useState(TECHSTACK_PRESETS[0].id);
  const [modules, setModules] = useState<ModuleDraft[]>(defaultModules(TECHSTACK_PRESETS[0].id));
  const [docs, setDocs] = useState<DocDraft[]>([emptyDoc()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateModule(index: number, key: keyof ModuleDraft, value: string | number | boolean) {
    setModules((current) =>
      current.map((module, i) => (i === index ? { ...module, [key]: value } : module)).map((module, i) => ({
        ...module,
        moduleOrder: i + 1,
      })),
    );
  }

  function addModule() {
    setModules((current) => [
      ...current,
      {
        moduleOrder: current.length + 1,
        moduleType: "CUSTOM",
        title: "",
        description: "",
        gateRequired: false,
        riskLevel: "MEDIUM",
      },
    ]);
  }

  function removeModule(index: number) {
    setModules((current) =>
      current
        .filter((_, i) => i !== index)
        .map((module, i) => ({
          ...module,
          moduleOrder: i + 1,
        })),
    );
  }

  function updateDoc(index: number, key: keyof DocDraft, value: string) {
    setDocs((current) => current.map((doc, i) => (i === index ? { ...doc, [key]: value } : doc)));
  }

  function onTechstackPresetChange(nextPresetId: string) {
    setTechstackPresetId(nextPresetId);
    setModules(defaultModules(nextPresetId));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    const payload = {
      name,
      target,
      autoProvisionDomain,
      lifecycle: {
        title: runTitle,
        mode: runMode,
        classification: runClassification,
        autoStart,
        modules: modules.map((module, index) => ({
          ...module,
          moduleOrder: index + 1,
          expectedState: expectedStateFor(module.moduleType, module.title),
        })),
      },
      documentation: docs.filter((doc) => doc.name.trim() !== "" && doc.content.trim() !== ""),
    };

    const response = await fetch("/api/v1/admin/projects/bootstrap", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as {
      success: boolean;
      error?: { message?: string };
      data?: { project?: { id?: string; name?: string } };
    };

    if (!response.ok || !body.success) {
      setError(body.error?.message ?? "Project creation failed");
      setBusy(false);
      return;
    }

    const projectName = body.data?.project?.name ?? "project";
    setSuccess(`Project "${projectName}" created successfully.`);
    setName("");
    setTarget("");
    setRunTitle("Initial Lifecycle Run");
    setRunMode("STEP");
    setRunClassification("BIRTH");
    setAutoStart(false);
    setAutoProvisionDomain(false);
    setTechstackPresetId(TECHSTACK_PRESETS[0].id);
    setModules(defaultModules(TECHSTACK_PRESETS[0].id));
    setDocs([emptyDoc()]);
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="bootstrap-form card">
      <h2>Create Project (Lifecycle vNext)</h2>
      <p>Create a project with a module-based lifecycle run and optional initial documentation.</p>

      <label htmlFor="project-name">Project Name</label>
      <input id="project-name" value={name} onChange={(event) => setName(event.target.value)} required />

      <label htmlFor="project-target">Project Objective</label>
      <textarea id="project-target" value={target} onChange={(event) => setTarget(event.target.value)} required rows={4} />

      <label className="checkbox-label">
        <input type="checkbox" checked={autoProvisionDomain} onChange={(event) => setAutoProvisionDomain(event.target.checked)} />
        Auto Provision Domain for this project
      </label>

      <div className="bootstrap-section">
        <div className="bootstrap-head">
          <h3>Lifecycle Run</h3>
        </div>

        <div className="bootstrap-box">
          <label>Run Title</label>
          <input value={runTitle} onChange={(event) => setRunTitle(event.target.value)} required />

          <label>Mode</label>
          <select value={runMode} onChange={(event) => setRunMode(event.target.value as "STEP" | "BATCH")}>
            <option value="STEP">STEP (Stop after each module)</option>
            <option value="BATCH">BATCH (Autonomous flow)</option>
          </select>

          <label>Classification</label>
          <select
            value={runClassification}
            onChange={(event) =>
              setRunClassification(event.target.value as "BIRTH" | "CHANGE" | "FIX" | "ITERATE" | "TEARDOWN")
            }
          >
            <option value="BIRTH">BIRTH</option>
            <option value="CHANGE">CHANGE</option>
            <option value="FIX">FIX</option>
            <option value="ITERATE">ITERATE</option>
            <option value="TEARDOWN">TEARDOWN</option>
          </select>

          <label className="checkbox-label">
            <input type="checkbox" checked={autoStart} onChange={(event) => setAutoStart(event.target.checked)} />
            Auto start requested (build still requires explicit Start after prephase)
          </label>
        </div>
      </div>

      <div className="bootstrap-section">
        <div className="bootstrap-head">
          <h3>Techstack + Modules</h3>
          <button type="button" onClick={addModule}>Add Module</button>
        </div>

        <div className="bootstrap-box">
          <label>Techstack Foundation Preset</label>
          <select value={techstackPresetId} onChange={(event) => onTechstackPresetChange(event.target.value)}>
            {TECHSTACK_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
          <p className="ops-muted">{findTechstackPreset(techstackPresetId).summary}</p>
        </div>

        {modules.map((module, index) => (
          <div key={`module-${index}`} className="bootstrap-box">
            <p className="visual-id-pill">Module #{index + 1}</p>

            <label>Type</label>
            <select
              value={module.moduleType}
              onChange={(event) => updateModule(index, "moduleType", event.target.value)}
              disabled={index === 0}
            >
              <option value="TECHSTACK">TECHSTACK</option>
              <option value="FEATURE">FEATURE</option>
              <option value="CHECK">CHECK</option>
              <option value="DOMAIN">DOMAIN</option>
              <option value="DEPLOY">DEPLOY</option>
              <option value="CHANGE">CHANGE</option>
              <option value="FIX">FIX</option>
              <option value="ITERATE">ITERATE</option>
              <option value="TEARDOWN">TEARDOWN</option>
              <option value="CUSTOM">CUSTOM</option>
            </select>
            {index === 0 ? <p className="ops-muted">Module #1 is fixed as Techstack Foundation.</p> : null}

            <label>Title</label>
            <input value={module.title} onChange={(event) => updateModule(index, "title", event.target.value)} required />

            <label>Description</label>
            <textarea value={module.description} onChange={(event) => updateModule(index, "description", event.target.value)} rows={2} required />

            <label>Risk Level</label>
            <select value={module.riskLevel} onChange={(event) => updateModule(index, "riskLevel", event.target.value)}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={module.gateRequired}
                onChange={(event) => updateModule(index, "gateRequired", event.target.checked)}
              />
              Gate Required
            </label>

            {modules.length > 1 ? (
              <button type="button" className="danger" onClick={() => removeModule(index)}>
                Remove Module
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="bootstrap-section">
        <div className="bootstrap-head">
          <h3>Documentation</h3>
          <button type="button" onClick={() => setDocs((current) => [...current, emptyDoc()])}>
            Add Document
          </button>
        </div>

        {docs.map((doc, index) => (
          <div key={`doc-${index}`} className="bootstrap-box">
            <label>Name</label>
            <input value={doc.name} onChange={(event) => updateDoc(index, "name", event.target.value)} />

            <label>Content (Markdown)</label>
            <textarea value={doc.content} onChange={(event) => updateDoc(index, "content", event.target.value)} rows={5} />

            {docs.length > 1 ? (
              <button type="button" className="danger" onClick={() => setDocs((current) => current.filter((_, i) => i !== index))}>
                Remove Document
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <button type="submit" disabled={busy}>
        {busy ? "Creating lifecycle project..." : "Create Lifecycle Project"}
      </button>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p>{success}</p> : null}
    </form>
  );
}
