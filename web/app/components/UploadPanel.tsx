"use client";

import { useRef, useState, type DragEvent } from "react";
import { UploadIcon, ArrowUpIcon, PdfIcon } from "./icons";

type Status = "idle" | "uploading" | "success" | "error";

type UploadResult = { document_name?: string; chunks?: number; detail?: string };

export default function UploadPanel({
  onUploaded,
  onAsk,
}: {
  onUploaded?: (documentName: string, chunks: number) => void;
  onAsk: (question: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [chunks, setChunks] = useState(0);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");

  function submitQuestion() {
    const q = question.trim();
    if (!q) return;
    onAsk(q);
  }

  async function handleFile(file: File) {
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setStatus("error");
      setError("That's not a PDF — pick a .pdf file.");
      return;
    }

    setFileName(file.name);
    setStatus("uploading");
    setError("");

    const form = new FormData();
    form.append("file", file, file.name);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data: UploadResult = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setError(data.detail ?? "Upload failed. Please try again.");
        return;
      }
      setChunks(data.chunks ?? 0);
      setStatus("success");
      onUploaded?.(data.document_name ?? file.name, data.chunks ?? 0);
    } catch {
      setStatus("error");
      setError("Could not reach the server. Is the service running?");
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const busy = status === "uploading";

  return (
    <section className="sketch lift bg-[var(--paper)] p-7 sm:p-8 flex flex-col">
      <header className="mb-5">
        <h1 className="pane-title text-[34px] leading-none">Ask your PDF</h1>
        <p className="mt-2 text-[18px] text-[var(--ink-soft)]">
          Upload a document to get grounded answers
        </p>
      </header>

      {/* drop zone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={[
          "sketch-b group flex flex-col items-center justify-center gap-3 text-center px-6 py-11 border-[2.4px] border-dashed transition-colors",
          busy ? "cursor-wait" : "cursor-pointer",
          dragging
            ? "border-[var(--ink)] bg-[var(--paper-edge)]"
            : "border-[var(--hair)] hover:border-[var(--ink)]",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />

        {status === "idle" && (
          <>
            <UploadIcon className="text-[var(--ink-soft)] group-hover:text-[var(--ink)] transition-colors" />
            <span className="text-[19px] text-[var(--ink-soft)] group-hover:text-[var(--ink)] transition-colors">
              Drop a PDF or click to upload
            </span>
            <span className="text-[15px] text-[#b4b1a6]">
              — pdf, up to ~15&nbsp;MB —
            </span>
          </>
        )}

        {status === "uploading" && (
          <div aria-live="polite" className="flex flex-col items-center gap-3">
            <PdfIcon size={30} className="text-[var(--accent)] sparkle-pulse" />
            <span className="text-[19px] text-[var(--ink)]">
              indexing&nbsp;
              <span className="handwrite">{fileName}</span>
              <span className="dots ml-0.5">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </span>
            <span className="text-[15px] text-[var(--ink-soft)]">
              chunking &amp; embedding — this can take a few seconds
            </span>
          </div>
        )}

        {status === "success" && (
          <div aria-live="polite" className="flex flex-col items-center gap-2.5">
            <PdfIcon size={30} className="text-[var(--done)]" />
            <span className="text-[19px] text-[var(--ink)]">
              <span className="handwrite">{fileName}</span>
            </span>
            <span className="text-[16px] text-[var(--done)] handwrite">
              ✓ {chunks} chunks indexed — ask away
            </span>
            <span className="text-[14px] text-[var(--ink-soft)]">
              click to replace
            </span>
          </div>
        )}

        {status === "error" && (
          <div aria-live="polite" className="flex flex-col items-center gap-2.5">
            <UploadIcon className="text-[var(--due)]" />
            <span className="text-[18px] text-[var(--due)]">{error}</span>
            <span className="text-[15px] text-[var(--ink-soft)]">
              click to try again
            </span>
          </div>
        )}
      </label>

      {/* question input row — submitting asks the first question */}
      <div className="mt-6 flex items-end gap-3">
        <input
          className="ink-input text-[19px] flex-1"
          placeholder="Ask a question…"
          autoComplete="off"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitQuestion();
            }
          }}
        />
        <button
          type="button"
          aria-label="Send question"
          onClick={submitQuestion}
          disabled={!question.trim()}
          className="send-btn sketch-sm grid place-items-center w-[48px] h-[46px] shrink-0"
        >
          <ArrowUpIcon />
        </button>
      </div>

      <p className="mt-auto pt-6 text-[15px] text-[var(--ink-soft)] leading-snug">
        tip — answers are drawn only from the pages you upload, so the model
        won&apos;t make things up.
      </p>
    </section>
  );
}
