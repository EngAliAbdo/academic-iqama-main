export const REQUIRED_SCHEMA_TABLES = [
  "profiles",
  "assignments",
  "submissions",
  "subjects",
  "student_subjects",
  "reviews",
  "originality_checks",
  "submission_matches",
  "activity_logs",
  "system_settings",
];

export const REQUIRED_STORAGE_BUCKETS = [
  "assignment-attachments",
  "student-submissions",
];

export const REQUIRED_RPC_FUNCTIONS = [
  "get_accessible_originality_checks",
  "get_accessible_reviews",
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasCreateTable(sql, tableName) {
  const pattern = new RegExp(
    `create\\s+table\\s+(if\\s+not\\s+exists\\s+)?public\\.${escapeRegex(tableName)}\\b`,
    "i",
  );
  return pattern.test(sql);
}

function hasRpcFunction(sql, functionName) {
  const pattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${escapeRegex(functionName)}\\s*\\(`,
    "i",
  );
  return pattern.test(sql);
}

function hasBucketDefinition(sql, bucketName) {
  const pattern = new RegExp(
    `insert\\s+into\\s+storage\\.buckets[\\s\\S]*?'${escapeRegex(bucketName)}'`,
    "i",
  );
  return pattern.test(sql);
}

export function analyzeSchemaArtifacts(migrationContents) {
  const combinedSql = migrationContents.join("\n\n");

  const missingTables = REQUIRED_SCHEMA_TABLES.filter((tableName) => !hasCreateTable(combinedSql, tableName));
  const missingBuckets = REQUIRED_STORAGE_BUCKETS.filter((bucketName) => !hasBucketDefinition(combinedSql, bucketName));
  const missingRpcFunctions = REQUIRED_RPC_FUNCTIONS.filter((functionName) => !hasRpcFunction(combinedSql, functionName));

  return {
    missingTables,
    missingBuckets,
    missingRpcFunctions,
  };
}

export function getSchemaArtifactIssues(summary) {
  const issues = [];

  if (summary.missingTables.length > 0) {
    issues.push(`missing tables: ${summary.missingTables.join(", ")}`);
  }

  if (summary.missingBuckets.length > 0) {
    issues.push(`missing storage buckets: ${summary.missingBuckets.join(", ")}`);
  }

  if (summary.missingRpcFunctions.length > 0) {
    issues.push(`missing rpc functions: ${summary.missingRpcFunctions.join(", ")}`);
  }

  return issues;
}
