"use client";

import { useEffect, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatSession = {
  id: string;
  created_at: string;
  unanswered: boolean;
  chat_messages: ChatMessage[];
};

export default function AdminChatsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const res = await fetch("/api/admin/chats", { cache: "no-store" });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error ?? "Failed to load chats");
        return;
      }
      setSessions(data.sessions ?? []);
    };
    void run();
  }, []);

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Chat sessions</h2>
      {loading ? <p className="text-sm text-slate-400">Loading...</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="space-y-3">
        {sessions.map((session) => (
          <article key={session.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>{new Date(session.created_at).toLocaleString()}</span>
              {session.unanswered ? (
                <span className="rounded-full bg-amber-900/40 px-2 py-1 text-amber-300">
                  Unanswered detected
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              {session.chat_messages?.map((message) => (
                <p key={message.id} className="text-sm">
                  <span className="font-semibold text-slate-300">{message.role}: </span>
                  <span className="text-slate-200">{message.content}</span>
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
