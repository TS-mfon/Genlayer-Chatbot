import { requireAdminSession } from "@/lib/auth";
import { SqlConsole } from "@/components/admin/SqlConsole";

export default async function AdminSqlPage() {
  await requireAdminSession();

  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold">Database SQL Console</h2>
      <SqlConsole />
    </section>
  );
}
