"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

type PresetSection = {
  id: string;
  title: string;
  context: string;
};

type ParsedPreset = {
  prefix: string;
  sections: PresetSection[];
};

type AutodevPresetEditorProps = {
  initialContent: string;
};

function createId(): string {
  return `sec_${Math.random().toString(36).slice(2, 10)}`;
}

function parsePreset(content: string): ParsedPreset {
  const normalized = content.replace(/\r/g, "").trim();
  const lines = normalized.split("\n");

  const sectionStartIndexes: number[] = [];
  lines.forEach((line, index) => {
    if (line.startsWith("## ")) {
      sectionStartIndexes.push(index);
    }
  });

  if (sectionStartIndexes.length === 0) {
    return {
      prefix: normalized,
      sections: [],
    };
  }

  const prefix = lines.slice(0, sectionStartIndexes[0]).join("\n").trimEnd();

  const sections = sectionStartIndexes.map((start, index) => {
    const end = index + 1 < sectionStartIndexes.length ? sectionStartIndexes[index + 1] : lines.length;
    const title = lines[start].replace(/^##\s+/, "").trim();
    const context = lines.slice(start + 1, end).join("\n").trim();

    return {
      id: createId(),
      title,
      context,
    };
  });

  return { prefix, sections };
}

function buildPresetContent(prefix: string, sections: PresetSection[]): string {
  const normalizedPrefix = prefix.trim();
  const renderedSections = sections
    .map((section) => `## ${section.title.trim()}\n\n${section.context.trim()}`.trim())
    .join("\n\n");

  return [normalizedPrefix, renderedSections].filter((value) => value !== "").join("\n\n").trim() + "\n";
}

export function AutodevPresetEditor({ initialContent }: AutodevPresetEditorProps) {
  const parsed = useMemo(() => parsePreset(initialContent), [initialContent]);
  const [prefix] = useState(parsed.prefix);
  const [sections, setSections] = useState<PresetSection[]>(
    parsed.sections.length > 0
      ? parsed.sections
      : [
          {
            id: createId(),
            title: "New Section",
            context: "",
          },
        ],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const preview = useMemo(() => buildPresetContent(prefix, sections), [prefix, sections]);

  function updateSection(id: string, key: "title" | "context", value: string) {
    setSections((current) => current.map((section) => (section.id === id ? { ...section, [key]: value } : section)));
  }

  function addSection() {
    setSections((current) => [
      ...current,
      {
        id: createId(),
        title: `New Section ${current.length + 1}`,
        context: "",
      },
    ]);
  }

  function removeSection(id: string) {
    setSections((current) => current.filter((section) => section.id !== id));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    const preparedSections = sections.filter(
      (section) => section.title.trim() !== "" || section.context.trim() !== "",
    );

    const invalidSection = preparedSections.find((section) => section.title.trim() === "" || section.context.trim() === "");
    if (invalidSection) {
      setError("Each section needs both heading and context.");
      setBusy(false);
      return;
    }

    const content = buildPresetContent(prefix, preparedSections);

    const response = await fetch("/api/v1/admin/system/presets/autodev", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    const body = (await response.json()) as { success: boolean; error?: { message?: string } };
    if (!response.ok || !body.success) {
      setError(body.error?.message ?? "Unable to save autodev preset");
      setBusy(false);
      return;
    }

    setSuccess("Global autodev preset updated.");
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="card preset-editor">
      <h2>Preset Sections</h2>
      <p>
        The current autodev version is loaded from COPM. Edit by sections (heading + context). Saving updates the
        global preset for all projects.
      </p>

      <div className="preset-fixed-block">
        <h3>Header (kept from current version)</h3>
        <pre>{prefix || "No static header found."}</pre>
      </div>

      <div className="preset-section-head">
        <h3>Sections ({sections.length})</h3>
        <button type="button" onClick={addSection}>
          Add Section
        </button>
      </div>

      <div className="preset-sections">
        {sections.map((section, index) => (
          <div key={section.id} className="preset-section-box">
            <label htmlFor={`section-title-${section.id}`}>Section {index + 1} Heading</label>
            <input
              id={`section-title-${section.id}`}
              value={section.title}
              onChange={(event) => updateSection(section.id, "title", event.target.value)}
            />

            <label htmlFor={`section-context-${section.id}`}>Context</label>
            <textarea
              id={`section-context-${section.id}`}
              value={section.context}
              onChange={(event) => updateSection(section.id, "context", event.target.value)}
              rows={8}
            />

            <button type="button" className="danger" onClick={() => removeSection(section.id)} disabled={sections.length <= 1}>
              Delete Section
            </button>
          </div>
        ))}
      </div>

      <button type="submit" disabled={busy}>
        {busy ? "Saving..." : "Save Global Autodev Preset"}
      </button>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p>{success}</p> : null}

      <div className="preset-preview">
        <h3>Rendered Preview</h3>
        <pre>{preview}</pre>
      </div>
    </form>
  );
}
