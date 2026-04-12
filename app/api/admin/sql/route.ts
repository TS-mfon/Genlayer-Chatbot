import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthorized } from "@/lib/admin";
import { env } from "@/lib/env";
import { getSqlClient } from "@/lib/postgres";
import { assertSafeSql } from "@/lib/sql-safety";

const querySchema = z.object({
  query: z.string().min(1),
  confirmDestructive: z.boolean().default(false),
});

export async function POST(request: Request) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (env.SQL_CONSOLE_ENABLED !== "true") {
    return NextResponse.json(
      { error: "SQL console is disabled. Set SQL_CONSOLE_ENABLED=true." },
      { status: 403 },
    );
  }

  try {
    const { query, confirmDestructive } = querySchema.parse(await request.json());
    assertSafeSql(query, confirmDestructive);

    const sql = getSqlClient();
    const result = await sql.unsafe(query);

    return NextResponse.json({
      rowCount: result.count,
      rows: result.slice(0, 200),
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "SQL execution failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
