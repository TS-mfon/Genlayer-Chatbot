const DESTRUCTIVE_PATTERNS = [
  /\bDROP\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\b/i,
  /\bDELETE\b/i,
  /\bUPDATE\b/i,
];

const FORBIDDEN_PATTERNS = [/\bCOPY\b/i, /\bGRANT\b/i, /\bREVOKE\b/i];

export function assertSafeSql(query: string, confirmDestructive: boolean) {
  const trimmed = query.trim();

  if (!trimmed) throw new Error("SQL query cannot be empty.");
  if (trimmed.split(";").filter(Boolean).length > 1) {
    throw new Error("Only one SQL statement is allowed per execution.");
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new Error("This statement type is not allowed in SQL console.");
    }
  }

  const isDestructive = DESTRUCTIVE_PATTERNS.some((pattern) =>
    pattern.test(trimmed),
  );

  if (isDestructive && !confirmDestructive) {
    throw new Error(
      "Destructive SQL requires confirmDestructive=true in the request body.",
    );
  }
}
