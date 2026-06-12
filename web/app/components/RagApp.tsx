"use client";

import { useState } from "react";
import UploadPanel from "./UploadPanel";
import ChatPanel from "./ChatPanel";
import type { Turn } from "../lib/types";

type Phase = "upload" | "leaving" | "chat";

const LEAVE_MS = 240; // keep in sync with .card-leave duration in globals.css

export default function RagApp() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [messages, setMessages] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const [docName, setDocName] = useState<string | null>(null);

  // Send a question to the backend and append the grounded answer.
  async function runQuery(question: string) {
    setThinking(true);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data: { answer?: string; detail?: string } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: data.detail ?? "Something went wrong answering that.",
            error: true,
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: data.answer ?? "(no answer returned)" },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "Couldn't reach the server. Is the service running?",
          error: true,
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  // Follow-up questions from the chat composer / chips.
  function ask(question: string) {
    const q = question.trim();
    if (!q || thinking) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    runQuery(q);
  }

  // The first question, asked from the upload card — triggers the transition.
  function askFirst(question: string) {
    const q = question.trim();
    if (!q) return;
    setMessages([{ role: "user", text: q }]);
    setPhase("leaving");
    window.setTimeout(() => {
      setPhase("chat");
      runQuery(q);
    }, LEAVE_MS);
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[640px]">
        {phase === "chat" ? (
          <div className="card-enter">
            <ChatPanel
              messages={messages}
              thinking={thinking}
              docName={docName}
              onAsk={ask}
            />
          </div>
        ) : (
          <div className={phase === "leaving" ? "card-leave" : ""}>
            <UploadPanel onUploaded={setDocName} onAsk={askFirst} />
          </div>
        )}
      </div>
    </main>
  );
}
