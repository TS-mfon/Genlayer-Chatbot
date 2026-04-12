"use client";

import { FormEvent, useState } from "react";

type SqlResult = {
  rowCount: number;
  rows: unknown[];
};

export function SqlConsole() {
  const [query, setQuery] = useState("SELECT id, title, category FROM knowledge_entries LIMIT 20");
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setRunning(true);
    setError(null);
    setResult(null);

    const response = await fetch("/api/admin/sql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, confirmDestructive }),
    });
    const data = await response.json();
    setRunning(false);

    if (!response.ok) {
      setError(data.error ?? "SQL execution failed.");
      return;
    }

    setResult(data);
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="text-lg font-semibold">SQL Console (Admin only)</h3>
      <p className="mt-1 text-xs text-slate-400">
        Only one statement is allowed per execution. Destructive commands require confirmation.
      </p>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-40 w-full rounded-md border border-slate-700 bg-slate-950 p-3 font-mono text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={confirmDestructive}
            onChange={(event) => setConfirmDestructive(event.target.checked)}
          />
          Confirm destructive statement
        </label>
        <button
          type="submit"
          disabled={running}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium disabled:bg-indigo-900"
        >
          {running ? "Running..." : "Run SQL"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {result ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-slate-300">Rows affected: {result.rowCount}</p>
          <pre className="max-h-80 overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200">
            {JSON.stringify(result.rows, null, 2)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
