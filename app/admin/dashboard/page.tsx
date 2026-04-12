import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db";

async function getStats() {
  const supabaseAdmin = getSupabaseAdmin();
  const [{ count: entries }, { count: activeEntries }, { count: sessions }] =
    await Promise.all([
      supabaseAdmin
        .from("knowledge_entries")
        .select("*", { head: true, count: "exact" }),
      supabaseAdmin
        .from("knowledge_entries")
        .select("*", { head: true, count: "exact" })
        .eq("is_active", true),
      supabaseAdmin
        .from("chat_sessions")
        .select("*", { head: true, count: "exact" }),
    ]);

  return {
    entries: entries ?? 0,
    activeEntries: activeEntries ?? 0,
    sessions: sessions ?? 0,
  };
}

export default async function AdminDashboardPage() {
  await requireAdminSession();
  const stats = await getStats();

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Admin dashboard</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Total entries</p>
          <p className="text-2xl font-semibold">{stats.entries}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Active entries</p>
          <p className="text-2xl font-semibold">{stats.activeEntries}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Chat sessions</p>
          <p className="text-2xl font-semibold">{stats.sessions}</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
        <p>Use the admin routes to manage the live database:</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href="/admin/entries" className="text-indigo-300 hover:text-indigo-200">
            Manage knowledge entries
          </Link>
          <Link href="/admin/chats" className="text-indigo-300 hover:text-indigo-200">
            Review chat sessions
          </Link>
          <Link href="/admin/sql" className="text-indigo-300 hover:text-indigo-200">
            Open SQL console
          </Link>
        </div>
      </div>
    </section>
  );
}
