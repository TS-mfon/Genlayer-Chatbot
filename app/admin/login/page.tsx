"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/admin/dashboard",
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Invalid credentials.");
      return;
    }

    if (result?.url) {
      window.location.href = result.url;
    }
  };

  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-xl font-semibold">Admin login</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:bg-indigo-900"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </form>
    </section>
  );
}
