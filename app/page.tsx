"use client";

import { FormEvent, useMemo, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
  sources?: Array<{ id: string; title: string; category: string | null }>;
};

const STARTER_QUESTIONS = [
  "What is GenVM?",
  "How do validator nodes work in GenLayer?",
  "What is Optimistic Democracy in GenLayer?",
];

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => question.trim().length > 0 && !isLoading,
    [question, isLoading],
  );

  const handleQuestion = async (value: string) => {
    if (!value.trim() || isLoading) return;

    const nextUserMessage: ChatMessage = { role: "user", content: value.trim() };
    setMessages((prev) => [...prev, nextUserMessage]);
    setQuestion("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: value.trim(), session_id: sessionId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to fetch response.");
      }

      setSessionId(data.session_id ?? sessionId);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources ?? [],
        },
      ]);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "An unknown error occurred.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await handleQuestion(question);
  };

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-2xl font-semibold text-white">Ask about GenLayer</h2>
        <p className="mt-2 text-sm text-slate-300">
          This assistant only answers from its curated GenLayer knowledge base.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {STARTER_QUESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleQuestion(item)}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
              disabled={isLoading}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="max-h-[28rem] space-y-4 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-400">
              No messages yet. Ask your first GenLayer question.
            </p>
          ) : null}
          {messages.map((message, idx) => (
            <article
              key={`${message.role}-${idx}`}
              className={`rounded-lg p-3 text-sm ${
                message.role === "user"
                  ? "ml-10 bg-indigo-600 text-white"
                  : "mr-10 bg-slate-800 text-slate-100"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.sources?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.sources.map((source) => (
                    <span
                      key={source.id}
                      className="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-300"
                      title={source.category ?? "Uncategorized"}
                    >
                      {source.title}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a GenLayer question..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-indigo-900"
          >
            {isLoading ? "Thinking..." : "Send"}
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      </div>
    </section>
  );
}
