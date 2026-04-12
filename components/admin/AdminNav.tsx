"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function AdminNav() {
  const { data } = useSession();
  const isAuthenticated = Boolean(data?.user);

  return (
    <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin/dashboard" className="text-slate-200 hover:text-white">
          Dashboard
        </Link>
        <Link href="/admin/entries" className="text-slate-200 hover:text-white">
          Entries
        </Link>
        <Link href="/admin/chats" className="text-slate-200 hover:text-white">
          Chats
        </Link>
        <Link href="/admin/sql" className="text-slate-200 hover:text-white">
          SQL Console
        </Link>
        {isAuthenticated ? (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="ml-auto rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:border-slate-500"
          >
            Sign out
          </button>
        ) : null}
      </div>
    </div>
  );
}
