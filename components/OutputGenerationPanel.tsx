"use client";

import { useMemo, useState } from "react";
import { audienceProfiles, type OutputAudience } from "@/lib/audience";
import {
  exportOutput,
  generateOutput,
  outputToMarkdown,
  type GeneratedOutput,
  type OutputEngineData,
  type OutputFormat,
} from "@/lib/output";
import { outputTemplates, type OutputType } from "@/lib/templates";

type OutputGenerationPanelProps = {
  data: OutputEngineData;
};

function downloadText(filename: string, text: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportFilename(output: GeneratedOutput, format: OutputFormat) {
  const extension = format === "markdown" ? "md" : "json";
  const date = output.metadata.generatedAt.slice(0, 10);
  return `${output.type}-${output.audience}-${date}.${extension}`;
}

export function OutputGenerationPanel({ data }: OutputGenerationPanelProps) {
  const [type, setType] = useState<OutputType>("weekly-brief");
  const [audience, setAudience] = useState<OutputAudience>("executive");
  const [previewMode, setPreviewMode] = useState<"preview" | "structure">("preview");
  const [outputNonce, setOutputNonce] = useState(0);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const output = useMemo(
    () => {
      void outputNonce;
      return generateOutput({ type, audience, data });
    },
    [audience, data, outputNonce, type],
  );
  const markdownPreview = useMemo(() => outputToMarkdown(output), [output]);

  const handleExport = (format: OutputFormat) => {
    const serialized = exportOutput(output, format);
    downloadText(
      exportFilename(output, format),
      serialized,
      format === "markdown" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8",
    );
    setExportStatus(format === "markdown" ? "Markdown exported" : "JSON exported");
  };

  return (
    <section className="surface-card p-4 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">Externalization</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Output Generator</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Template</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as OutputType)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {Object.values(outputTemplates).map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Audience</span>
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value as OutputAudience)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {Object.values(audienceProfiles).map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setOutputNonce((current) => current + 1);
              setExportStatus("Generated");
            }}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Generate
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase text-slate-500">Tone</div>
          <div className="mt-1 font-semibold text-slate-900">{output.metadata.tone}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase text-slate-500">Depth</div>
          <div className="mt-1 font-semibold text-slate-900">{output.metadata.depth}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase text-slate-500">Language</div>
          <div className="mt-1 font-semibold text-slate-900">{output.metadata.language}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase text-slate-500">Sources</div>
          <div className="mt-1 font-semibold text-slate-900">
            {output.metadata.sourceCounts.clusters} clusters
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          {(["preview", "structure"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPreviewMode(mode)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                previewMode === mode
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              {mode === "preview" ? "Preview" : "Structure"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport("markdown")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-slate-50"
          >
            Export Markdown
          </button>
          <button
            type="button"
            onClick={() => handleExport("json")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-slate-50"
          >
            Export JSON
          </button>
          {exportStatus ? <span className="text-xs text-slate-500">{exportStatus}</span> : null}
        </div>
      </div>

      {previewMode === "preview" ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-xl font-semibold text-slate-950">{output.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{output.summary}</p>
          <div className="mt-5 space-y-5">
            {output.sections.map((section) => (
              <section key={section.id} className="border-t border-slate-200 pt-4">
                <h4 className="font-semibold text-slate-900">{section.title}</h4>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>- {bullet}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <pre className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}

      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          Markdown
        </summary>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
          {markdownPreview}
        </pre>
      </details>
    </section>
  );
}
