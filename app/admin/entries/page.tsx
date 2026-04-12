import { requireAdminSession } from "@/lib/auth";
import { EntriesManager } from "@/components/admin/EntriesManager";

export default async function AdminEntriesPage() {
  await requireAdminSession();

  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold">Knowledge entries</h2>
      <EntriesManager />
    </section>
  );
}
