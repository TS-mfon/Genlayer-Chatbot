"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatRole = "user" | "assistant";

type Source = { id: string; title: string; category: string | null };
type Suggestion = { title: string; category: string | null };
type RelatedTitle = { title: string; category: string | null };
type ChatMessage = {
  role: ChatRole;
  content: string;
  sources?: Source[];
  lowConfidence?: boolean;
  relatedTitles?: RelatedTitle[];
};

const STARTER_QUESTIONS = [
  "What is GenVM?",
  "How do validator nodes work in GenLayer?",
  "What is Optimistic Democracy in GenLayer?",
];

function normalizeTitleKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const run = async () => {
      const response = await fetch("/api/suggestions", { cache: "no-store" });
      const data = await response.json();
      setSuggestions(data.suggestions ?? []);
    };
    void run();
  }, []);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  const canSubmit = useMemo(
    () => question.trim().length > 0 && !isLoading,
    [question, isLoading],
  );
  const suggestionsByTitle = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const item of suggestions) {
      map.set(normalizeTitleKey(item.title), item.category ?? null);
    }
    return map;
  }, [suggestions]);

  const ask = async (value: string) => {
    if (!value.trim() || isLoading) return;

    const text = value.trim();
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setQuestion("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, session_id: sessionId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to fetch response.");
      }

      const lowConfidence = Boolean(data.low_confidence);
      const relatedTitleValues: unknown[] = Array.isArray(data.related_titles)
        ? data.related_titles
        : [];
      const relatedTitles: RelatedTitle[] = lowConfidence
        ? relatedTitleValues
            .filter((item): item is string => typeof item === "string")
            .map((title) => title.trim())
            .filter((title) => title.length > 0)
            .slice(0, 3)
            .map((title) => ({
              title,
              category: suggestionsByTitle.get(normalizeTitleKey(title)) ?? null,
            }))
        : [];

      setSessionId(data.session_id ?? sessionId);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources ?? [],
          lowConfidence,
          relatedTitles,
        },
      ]);
    } catch {
      setError("Chat request failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await ask(question);
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
      <aside className="rounded-2xl border border-indigo-400/20 bg-gradient-to-b from-indigo-500/10 via-slate-900 to-slate-900 p-6 shadow-2xl shadow-indigo-950/30">
        <p className="mb-2 inline-flex rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
          Closed-domain assistant
        </p>
        <h2 className="text-3xl font-semibold leading-tight text-white">
          Ask smart questions about GenLayer
        </h2>
        <p className="mt-3 text-sm text-slate-300">
          Answers are grounded only in your curated knowledge base. No web
          browsing, no hallucinations.
        </p>

        <div className="mt-6 space-y-2">
          <p className="text-sm font-medium text-slate-100">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {STARTER_QUESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                disabled={isLoading}
                onClick={() => ask(item)}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 transition hover:border-indigo-400 hover:text-white disabled:opacity-50"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-slate-100">
            You can ask questions about:
          </p>
          <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto pr-1">
            {suggestions.length ? (
              suggestions.map((item, idx) => (
                <button
                  key={`${item.title}-${idx}`}
                  type="button"
                  onClick={() => ask(item.title)}
                  className="group inline-flex items-center gap-2 rounded-lg border border-indigo-300/20 bg-indigo-500/10 px-2.5 py-1.5 text-left text-xs text-indigo-100 transition hover:border-indigo-300/50 hover:bg-indigo-500/20"
                  title={item.category ?? "General"}
                >
                  <span className="block max-w-[11rem] truncate">{item.title}</span>
                  {item.category ? (
                    <span className="rounded-full border border-indigo-200/20 bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-indigo-200">
                      {item.category}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <span className="text-xs text-slate-400">
                Add entries in admin to populate suggestions.
              </span>
            )}
          </div>
        </div>
      </aside>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl shadow-black/30 backdrop-blur">
        <div
          ref={messagesRef}
          className="h-[32rem] space-y-4 overflow-y-auto border-b border-slate-800 p-5"
        >
          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
              Start the conversation with a GenLayer question.
            </div>
          ) : null}

          {messages.map((message, idx) => (
            <article
              key={`${message.role}-${idx}`}
              className={`max-w-[90%] rounded-2xl p-4 text-sm leading-relaxed ${
                message.role === "user"
                  ? "ml-auto bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                  : "bg-slate-800 text-slate-100"
              }`}
            >
              {message.role === "assistant" ? (
                <div>
                  {message.lowConfidence ? (
                    <p className="mb-2 inline-flex rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-200">
                      Best match only - verify with sources
                    </p>
                  ) : null}
                  <div className="markdown-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ ...props }) => (
                          <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-300 underline underline-offset-2 hover:text-indigo-200"
                          />
                        ),
                        code: ({ children, className, ...props }) => (
                          <code
                            {...props}
                            className={
                              className
                                ? className
                                : "rounded bg-slate-900 px-1.5 py-0.5 text-xs text-indigo-200"
                            }
                          >
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
              {message.sources?.length &&
              message.role === "assistant" &&
              !message.content.includes("## Sources") ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-700/60 pt-3">
                  {message.sources.map((source) => (
                    <span
                      key={source.id}
                      className="rounded-full border border-slate-600 bg-slate-900 px-2.5 py-1 text-xs text-slate-200"
                      title={source.category ?? "General"}
                    >
                      {source.title}
                    </span>
                  ))}
                </div>
              ) : null}
              {message.relatedTitles?.length ? (
                <div className="mt-3 border-t border-slate-700/60 pt-3">
                  <p className="mb-2 text-xs text-indigo-200/90">
                    Try a related question:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {message.relatedTitles.map((item, relatedIdx) => (
                      <button
                        key={`${item.title}-${relatedIdx}`}
                        type="button"
                        disabled={isLoading}
                        onClick={() => ask(item.title)}
                        className="inline-flex items-center gap-2 rounded-full border border-indigo-300/25 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100 transition hover:border-indigo-300/45 hover:bg-indigo-500/20 disabled:opacity-50"
                      >
                        <span>{item.title}</span>
                        {item.category ? (
                          <span className="rounded-full border border-indigo-200/20 bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-indigo-200">
                            {item.category}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}

          {isLoading ? (
            <div className="max-w-[90%] rounded-2xl bg-slate-800 p-4">
              <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-600" />
            </div>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="space-y-3 p-4">
          <div className="relative">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a GenLayer question..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 pr-28 text-sm text-slate-100 outline-none transition focus:border-indigo-400"
            />
            <button
              type="submit"
              disabled={!canSubmit}
              className="absolute right-1.5 top-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-900"
            >
              {isLoading ? "Thinking..." : "Send"}
            </button>
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </form>
      </div>
    </section>
  );
}
