export function parseSupabaseConfigSummary(content) {
  const projectIdMatch = content.match(/project_id\s*=\s*"(.+?)"/);
  const projectId = projectIdMatch?.[1] ?? null;

  let currentSection = null;
  let hasAnalyzeSubmissionFunction = false;
  let analyzeSubmissionVerifyJwt = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const sectionMatch = line.match(/^\[(.+?)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (currentSection === "functions.analyze-submission") {
        hasAnalyzeSubmissionFunction = true;
      }
      continue;
    }

    if (currentSection === "functions.analyze-submission") {
      const verifyJwtMatch = line.match(/^verify_jwt\s*=\s*(true|false)\b/);
      if (verifyJwtMatch) {
        analyzeSubmissionVerifyJwt = verifyJwtMatch[1] === "true";
      }
    }
  }

  return {
    projectId,
    hasAnalyzeSubmissionFunction,
    analyzeSubmissionVerifyJwt,
  };
}

export function getSupabaseConfigIssues(summary) {
  const issues = [];

  if (!summary.projectId) {
    issues.push("missing project_id");
  }

  if (!summary.hasAnalyzeSubmissionFunction) {
    issues.push("missing [functions.analyze-submission]");
  }

  if (summary.analyzeSubmissionVerifyJwt === null) {
    issues.push("missing verify_jwt setting");
  }

  return issues;
}
