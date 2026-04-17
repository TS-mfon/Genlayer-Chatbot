export default function AboutPage() {
  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-2xl font-semibold text-white">About this app</h2>
      <p className="text-sm text-slate-300">
        GenLayer Knowledge Assistant is a closed-domain chatbot: it answers only
        from admin-managed knowledge entries stored in the database.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
        <li>Answer mode: deterministic extractive (no LLM required)</li>
        <li>Retrieval: PostgreSQL full-text + fuzzy search ranking</li>
        <li>Admin tools: CRUD management + secured SQL console</li>
      </ul>
    </section>
  );
}
