function trimTrailingWhitespace(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n")
    .trim();
}

export function buildSupabaseSqlBundle(migrations, options = {}) {
  const sourceDir = options.sourceDir ?? "supabase/migrations";

  const header = [
    "-- Supabase manual deployment bundle",
    "-- Generated from checked-in migrations.",
    "-- Run this file in Supabase SQL Editor only when CLI-based db push is unavailable.",
    "-- Source directory: " + sourceDir,
    "",
  ];

  const sections = migrations.flatMap(({ fileName, sql }) => {
    const normalizedSql = trimTrailingWhitespace(sql);

    return [
      "-- ============================================================================",
      `-- Migration: ${fileName}`,
      `-- Source: ${sourceDir}/${fileName}`,
      "-- ============================================================================",
      normalizedSql,
      "",
      "",
    ];
  });

  return [...header, ...sections].join("\n");
}
