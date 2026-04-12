import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSqlClient } from "@/lib/postgres";
import { BOOTSTRAP_SQL } from "@/lib/bootstrap-sql";

export async function POST(request: Request) {
  if (!env.BOOTSTRAP_TOKEN) {
    return NextResponse.json({ error: "Bootstrap token is not configured." }, { status: 403 });
  }

  const token = request.headers.get("x-bootstrap-token");
  if (!token || token !== env.BOOTSTRAP_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getSqlClient();
    await sql.unsafe(BOOTSTRAP_SQL);
    const tableRows = await sql`select to_regclass('public.knowledge_entries') as table_name`;
    const fnRows =
      await sql`select to_regprocedure('public.match_knowledge_entries(vector,double precision,integer,text)') as function_name`;

    return NextResponse.json({
      success: true,
      table: tableRows[0]?.table_name ?? null,
      function: fnRows[0]?.function_name ?? null,
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Failed to run bootstrap migration.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
