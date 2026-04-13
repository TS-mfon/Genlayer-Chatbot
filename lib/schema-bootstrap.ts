import { BOOTSTRAP_SQL } from "@/lib/bootstrap-sql";
import { getSqlClient } from "@/lib/postgres";

const MISSING_SCHEMA_MARKERS = [
  "schema cache",
  "Could not find the table",
  "does not exist",
];

let bootstrapAttempted = false;

export function isMissingSchemaError(message: string) {
  return MISSING_SCHEMA_MARKERS.some((marker) => message.includes(marker));
}

export async function ensureSchemaInitialized() {
  if (bootstrapAttempted) return;
  bootstrapAttempted = true;

  const sql = getSqlClient();
  await sql.unsafe(BOOTSTRAP_SQL);
}
