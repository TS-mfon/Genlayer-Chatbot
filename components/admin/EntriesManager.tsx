"use client";

import { FormEvent, useEffect, useState } from "react";

type Entry = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[] | null;
  source_url: string | null;
  is_active: boolean;
};

const blankForm = {
  title: "",
  content: "",
  category: "",
  tags: "",
  source_url: "",
};

export function EntriesManager() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);

  const loadEntries = async (query = "") => {
    setLoading(true);
    const url = query ? `/api/admin/entries?search=${encodeURIComponent(query)}` : "/api/admin/entries";
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Failed to load entries.");
      return;
    }
    setEntries(data.entries ?? []);
  };

  useEffect(() => {
    void loadEntries();
  }, []);

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);

    const payload = {
      ...form,
      category: form.category || null,
      source_url: form.source_url || null,
      tags: form.tags
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    };

    const res = await fetch("/api/admin/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed to create entry.");
      return;
    }

    setForm(blankForm);
    setMessage("Entry created.");
    await loadEntries(search);
  };

  const softDelete = async (id: string) => {
    const res = await fetch(`/api/admin/entries/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Delete failed.");
      return;
    }
    setMessage("Entry disabled.");
    await loadEntries(search);
  };

  const toggleActive = async (entry: Entry) => {
    const res = await fetch(`/api/admin/entries/${entry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !entry.is_active }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Update failed.");
      return;
    }
    setMessage("Entry updated.");
    await loadEntries(search);
  };

  const editEntry = async (entry: Entry) => {
    const nextTitle = window.prompt("Update title", entry.title);
    if (!nextTitle) return;
    const nextContent = window.prompt("Update content", entry.content);
    if (!nextContent) return;

    const res = await fetch(`/api/admin/entries/${entry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: nextTitle,
        content: nextContent,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Edit failed.");
      return;
    }
    setMessage("Entry updated.");
    await loadEntries(search);
  };

  return (
    <section className="space-y-4">
      <form onSubmit={submitCreate} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-lg font-semibold">Add knowledge entry</h3>
        <input
          value={form.title}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          placeholder="Title"
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          required
        />
        <textarea
          value={form.content}
          onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
          placeholder="Content"
          className="h-32 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          required
        />
        <div className="grid gap-2 md:grid-cols-3">
          <input
            value={form.category}
            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            placeholder="Category"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            value={form.tags}
            onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
            placeholder="Tags (comma separated)"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            value={form.source_url}
            onChange={(event) => setForm((prev) => ({ ...prev, source_url: event.target.value }))}
            placeholder="Source URL"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
        </div>
        <button className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium">
          Save entry
        </button>
      </form>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title/content"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void loadEntries(search)}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm"
          >
            Search
          </button>
        </div>

        {loading ? <p className="text-sm text-slate-400">Loading...</p> : null}
        {message ? <p className="mb-2 text-sm text-indigo-300">{message}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-2">Title</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-800">
                  <td className="py-2">{entry.title}</td>
                  <td className="py-2">{entry.category ?? "-"}</td>
                  <td className="py-2">{entry.is_active ? "Active" : "Inactive"}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void editEntry(entry)}
                        className="rounded border border-blue-700 px-2 py-1 text-xs text-blue-300"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(entry)}
                        className="rounded border border-slate-700 px-2 py-1 text-xs"
                      >
                        Toggle active
                      </button>
                      <button
                        type="button"
                        onClick={() => void softDelete(entry.id)}
                        className="rounded border border-red-700 px-2 py-1 text-xs text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && !loading ? (
                <tr>
                  <td colSpan={4} className="py-3 text-slate-400">
                    No entries found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
