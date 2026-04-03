export const MIGRATION_FILENAME_PATTERN = /^\d{12}_[a-z0-9_]+\.sql$/;

export function analyzeMigrationFilenames(fileNames) {
  const normalizedFileNames = [...fileNames].sort((left, right) => left.localeCompare(right));
  const invalidNames = normalizedFileNames.filter((fileName) => !MIGRATION_FILENAME_PATTERN.test(fileName));
  const versionCounts = new Map();

  for (const fileName of normalizedFileNames) {
    const version = fileName.slice(0, 12);
    versionCounts.set(version, (versionCounts.get(version) ?? 0) + 1);
  }

  const duplicateVersions = [...versionCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([version]) => version);

  const latestMigration = normalizedFileNames.at(-1) ?? null;

  return {
    totalCount: normalizedFileNames.length,
    invalidNames,
    duplicateVersions,
    latestMigration,
  };
}

export function getMigrationIssues(summary) {
  const issues = [];

  if (summary.totalCount === 0) {
    issues.push("no migration files found");
  }

  if (summary.invalidNames.length > 0) {
    issues.push(`invalid filenames: ${summary.invalidNames.join(", ")}`);
  }

  if (summary.duplicateVersions.length > 0) {
    issues.push(`duplicate versions: ${summary.duplicateVersions.join(", ")}`);
  }

  return issues;
}
