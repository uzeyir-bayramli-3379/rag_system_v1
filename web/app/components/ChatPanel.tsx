"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { SparkleIcon, ArrowUpIcon, PdfIcon } from "./icons";
import type { Turn } from "../lib/types";

const FOLLOW_UP_CHIPS = [
  "Summarize the doc",
  "List key terms",
  "What are the main findings?",
];

function Avatar({ pulse = false }: { pulse?: boolean }) {
  return (
    <span className="sketch-sm grid place-items-center w-[34px] h-[34px] shrink-0 bg-[var(--paper)] text-[var(--accent)]">
      <SparkleIcon size={18} className={pulse ? "sparkle-pulse" : ""} />
    </span>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="sketch-sm-b lift-sm max-w-[78%] bg-[var(--accent)] text-[var(--paper)] px-4 py-2.5 text-[18px] leading-snug whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <Avatar />
      <div
        className={[
          "sketch-sm lift-sm max-w-[82%] px-4 py-2.5 text-[18px] leading-snug whitespace-pre-wrap bg-[var(--paper)]",
          error ? "text-[var(--due)] border-[var(--due)]" : "text-[var(--ink)]",
        ].join(" ")}
      >
        <div className="[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function ThinkingRow() {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar pulse />
      <span className="text-[18px] text-[var(--ink-soft)] italic">
        thinking
        <span className="dots ml-0.5">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </span>
    </div>
  );
}

export default function ChatPanel({
  messages,
  thinking,
  docName,
  onAsk,
}: {
  messages: Turn[];
  thinking: boolean;
  docName: string | null;
  onAsk: (question: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the latest message / thinking row in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  function submit() {
    const q = draft.trim();
    if (!q || thinking) return;
    onAsk(q);
    setDraft("");
  }

  return (
    <section className="sketch sketch-b lift bg-[var(--paper)] p-7 sm:p-8 flex flex-col h-[78dvh] max-h-[680px]">
      {/* doc context header */}
      {docName && (
        <header className="flex items-center gap-2 pb-3 mb-3 border-b-2 border-dotted border-[var(--hair)]">
          <PdfIcon size={20} className="text-[var(--done)] shrink-0" />
          <span className="text-[16px] text-[var(--ink-soft)] truncate">
            grounded in <span className="handwrite text-[var(--ink)]">{docName}</span>
          </span>
        </header>
      )}

      {/* message stream */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
        {messages.map((t, i) =>
          t.role === "user" ? (
            <UserBubble key={i} text={t.text} />
          ) : (
            <AssistantBubble key={i} text={t.text} error={t.error} />
          )
        )}
        {thinking && <ThinkingRow />}
        <div ref={endRef} />
      </div>

      {/* follow-up chips */}
      <div className="mt-4 flex flex-wrap gap-2.5">
        {FOLLOW_UP_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={thinking}
            onClick={() => onAsk(c)}
            className="chip sketch-sm px-3.5 py-1.5 text-[16px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {c}
          </button>
        ))}
      </div>

      {/* composer */}
      <div className="mt-3 pt-4 border-t-2 border-dotted border-[var(--hair)] flex items-end gap-3">
        <input
          className="ink-input text-[19px] flex-1"
          placeholder="Ask a follow-up…"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          aria-label="Send follow-up"
          onClick={submit}
          disabled={!draft.trim() || thinking}
          className="send-btn sketch-sm grid place-items-center w-[48px] h-[46px] shrink-0"
        >
          <ArrowUpIcon />
        </button>
      </div>
    </section>
  );
}
