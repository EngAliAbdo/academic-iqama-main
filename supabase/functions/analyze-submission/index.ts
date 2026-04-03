import { createClient } from "jsr:@supabase/supabase-js@2";
import { Buffer } from "node:buffer";
import mammoth from "npm:mammoth@1.9.1";
import * as pdfjsLib from "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs";
import { corsHeaders } from "../_shared/cors.ts";

type AnalysisStatus = "pending" | "processing" | "completed" | "failed" | "manual_review_required";
type RiskLevel = "low" | "medium" | "high";
type RecommendedStatus = "clean" | "review" | "flagged";
type MatchType = "literal" | "paraphrased" | "common_overlap" | "citation_overlap";
type SourceScope = "same_assignment" | "same_subject" | "same_level_semester";

interface SubmissionContext {
  id: string;
  assignment_id: string;
  student_id: string;
  file_name: string;
  file_path: string | null;
  file_mime_type: string;
  submitted_at: string;
  assignment: {
    id: string;
    teacher_id: string;
    title: string;
    subject_id: string | null;
    subject: string;
    level: string;
  } | null;
}

type ActorRole = "student" | "teacher" | "admin";

interface AuthenticatedActor {
  id: string;
  role: ActorRole;
}

interface CandidateSubmission {
  id: string;
  student_id: string;
  student_name: string;
  assignment_id: string;
  file_name: string;
  file_path: string | null;
  file_mime_type: string;
  submitted_at: string;
  assignment: {
    subject_id: string | null;
    level: string;
  } | null;
  source_scope: SourceScope;
}

interface RankedMatch {
  matched_submission_id: string;
  matched_student_id: string;
  matched_student_name: string;
  matched_assignment_id: string;
  matched_subject_id: string | null;
  similarity_score: number;
  match_type: MatchType;
  matched_excerpt: string;
  section_text: string;
  source_scope: SourceScope;
  rank_order: number;
}

interface GeminiAnalysisResponse {
  originality_score: number;
  matching_percentage: number;
  risk_level: RiskLevel;
  recommended_status: RecommendedStatus;
  confidence_score: number;
  summary_for_teacher: string;
  summary_for_student: string;
  summary_for_admin: string;
  suspicious_sections: Array<{
    section_text: string;
    match_type: MatchType;
    matched_reference_id: string;
    reason: string;
    similarity_score: number;
  }>;
  top_matches: Array<{
    matched_submission_id: string;
    matched_student_id: string;
    matched_student_name: string;
    similarity_score: number;
    match_type: MatchType;
    matched_excerpt: string;
    source_scope: SourceScope;
  }>;
  reasoning_notes: string[];
}

interface SystemSettingsSnapshot {
  high_risk_below: number;
  medium_risk_below: number;
  suspicious_alert_below: number;
  manual_review_on_extraction_failure: boolean;
  auto_start_analysis: boolean;
}

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const GEMINI_PROMPT_VERSION = "originality-v1";
const MATCH_TYPE_VALUES: MatchType[] = ["literal", "paraphrased", "common_overlap", "citation_overlap"];
const SOURCE_SCOPE_VALUES: SourceScope[] = ["same_assignment", "same_subject", "same_level_semester"];
const DEFAULT_SYSTEM_SETTINGS: SystemSettingsSnapshot = {
  high_risk_below: 50,
  medium_risk_below: 80,
  suspicious_alert_below: 60,
  manual_review_on_extraction_failure: true,
  auto_start_analysis: true,
};

const GEMINI_ANALYSIS_PROMPT = `
You are an academic originality analysis assistant for a university platform.
Your role is evidence-oriented analysis only. You are not the final disciplinary authority.

Rules:
- Compare the student's submission against the provided internal candidate matches only.
- Distinguish between literal similarity, paraphrased similarity, citation overlap, and common non-problematic overlap.
- Ignore clearly cited references, assignment instructions, headers, boilerplate, and generic academic phrasing when they are not suspicious.
- If evidence is weak or ambiguous, lower confidence and prefer "review" instead of "flagged".
- Do not invent sources, students, or excerpts that were not provided.
- The teacher/admin summary may mention matched students when justified by evidence.
- The student summary must stay safe:
  - do not reveal other student names
  - do not reveal matched excerpts in full
  - do not accuse misconduct directly
- Return valid JSON only, matching the required schema exactly.
`.trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const authSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokenize(text: string) {
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function splitIntoPassages(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 120);

  if (paragraphs.length > 0) {
    return paragraphs.slice(0, 20);
  }

  const singleLine = text.replace(/\s+/g, " ").trim();
  const passages: string[] = [];

  for (let index = 0; index < singleLine.length; index += 700) {
    const slice = singleLine.slice(index, index + 900).trim();
    if (slice.length >= 120) {
      passages.push(slice);
    }
  }

  return passages.slice(0, 20);
}

function jaccardSimilarity(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = leftTokens.size + rightTokens.size - intersection;
  return Math.round((intersection / union) * 100);
}

function classifyMatchType(score: number): MatchType {
  if (score >= 85) return "literal";
  if (score >= 65) return "paraphrased";
  if (score >= 45) return "common_overlap";
  return "citation_overlap";
}

function clampPercent(value: unknown, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeRiskLevel(value: unknown): RiskLevel {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizeRecommendedStatus(value: unknown): RecommendedStatus {
  return value === "clean" || value === "review" || value === "flagged" ? value : "review";
}

function normalizeMatchType(value: unknown): MatchType {
  return MATCH_TYPE_VALUES.includes(value as MatchType) ? (value as MatchType) : "common_overlap";
}

function normalizeSourceScope(value: unknown): SourceScope {
  return SOURCE_SCOPE_VALUES.includes(value as SourceScope)
    ? (value as SourceScope)
    : "same_level_semester";
}

function riskLevelSeverity(value: RiskLevel) {
  return { low: 1, medium: 2, high: 3 }[value];
}

function policyRiskLevel(originalityScore: number, settings: SystemSettingsSnapshot): RiskLevel {
  if (originalityScore < settings.high_risk_below) {
    return "high";
  }

  if (originalityScore < settings.medium_risk_below) {
    return "medium";
  }

  return "low";
}

function policyRecommendedStatus(riskLevel: RiskLevel): RecommendedStatus {
  if (riskLevel === "high") {
    return "flagged";
  }

  if (riskLevel === "medium") {
    return "review";
  }

  return "clean";
}

function sanitizeTextValue(value: unknown, fallback: string, maxLength = 4000) {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim().slice(0, maxLength);
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

async function authenticateActor(request: Request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return null;
  }

  const { data: authData, error: authError } = await authSupabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single<{ role: ActorRole }>();

  if (profileError || !profile) {
    return null;
  }

  return {
    id: authData.user.id,
    role: profile.role,
  } satisfies AuthenticatedActor;
}

function canActorAnalyzeSubmission(actor: AuthenticatedActor, context: SubmissionContext) {
  if (actor.role === "admin") {
    return true;
  }

  if (context.student_id === actor.id) {
    return true;
  }

  return context.assignment?.teacher_id === actor.id;
}

async function loadSystemSettings() {
  const { data, error } = await supabase
    .from("system_settings")
    .select(`
      high_risk_below,
      medium_risk_below,
      suspicious_alert_below,
      manual_review_on_extraction_failure,
      auto_start_analysis
    `)
    .eq("id", true)
    .maybeSingle<SystemSettingsSnapshot>();

  if (error || !data) {
    return DEFAULT_SYSTEM_SETTINGS;
  }

  const highRiskBelow = Math.min(
    99,
    Math.max(1, clampPercent(data.high_risk_below, DEFAULT_SYSTEM_SETTINGS.high_risk_below)),
  );
  const mediumRiskBelow = Math.max(
    highRiskBelow + 1,
    clampPercent(data.medium_risk_below, DEFAULT_SYSTEM_SETTINGS.medium_risk_below),
  );
  const suspiciousAlertBelow = Math.max(
    highRiskBelow,
    Math.min(
      mediumRiskBelow,
      clampPercent(data.suspicious_alert_below, DEFAULT_SYSTEM_SETTINGS.suspicious_alert_below),
    ),
  );

  return {
    high_risk_below: highRiskBelow,
    medium_risk_below: mediumRiskBelow,
    suspicious_alert_below: suspiciousAlertBelow,
    manual_review_on_extraction_failure:
      typeof data.manual_review_on_extraction_failure === "boolean"
        ? data.manual_review_on_extraction_failure
        : DEFAULT_SYSTEM_SETTINGS.manual_review_on_extraction_failure,
    auto_start_analysis:
      typeof data.auto_start_analysis === "boolean"
        ? data.auto_start_analysis
        : DEFAULT_SYSTEM_SETTINGS.auto_start_analysis,
  };
}

async function markSubmissionStatus(
  submissionId: string,
  status: AnalysisStatus,
  extras: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from("submissions")
    .update({
      analysis_status: status,
      ...extras,
    })
    .eq("id", submissionId);

  if (error) {
    throw error;
  }
}

async function getSubmissionContext(submissionId: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select(`
      id,
      assignment_id,
      student_id,
      file_name,
      file_path,
      file_mime_type,
      submitted_at,
      assignment:assignments (
        id,
        teacher_id,
        title,
        subject_id,
        subject,
        level
      )
    `)
    .eq("id", submissionId)
    .single<SubmissionContext>();

  if (error || !data) {
    throw new HttpError("Submission not found", 404);
  }

  return data;
}

async function downloadSubmissionFile(path: string) {
  const { data, error } = await supabase.storage
    .from("student-submissions")
    .download(path);

  if (error || !data) {
    throw error ?? new Error("Failed to download submission file");
  }

  return new Uint8Array(await data.arrayBuffer());
}

async function extractTextFromPdf(buffer: Uint8Array) {
  const document = await pdfjsLib.getDocument({
    data: buffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  return pages.join("\n\n");
}

async function extractTextFromDocx(buffer: Uint8Array) {
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(buffer),
  });

  return result.value ?? "";
}

async function extractSubmissionText(fileName: string, buffer: Uint8Array) {
  const name = fileName.toLowerCase();

  if (name.endsWith(".pdf")) {
    return await extractTextFromPdf(buffer);
  }

  if (name.endsWith(".docx")) {
    return await extractTextFromDocx(buffer);
  }

  throw new Error("Unsupported file type");
}

async function createManualReviewResult(submissionId: string, message: string) {
  const { data, error } = await supabase
    .from("originality_checks")
    .insert({
      submission_id: submissionId,
      originality_score: 0,
      matching_percentage: 0,
      risk_level: "medium",
      recommended_status: "review",
      summary_for_teacher: message,
      summary_for_student: "تعذر تحليل الملف آلياً وتم تحويله إلى مراجعة يدوية.",
      summary_for_admin: message,
      confidence_score: 0,
      reasoning_notes: ["manual_review_required"],
      suspicious_sections: [],
      analysis_status: "manual_review_required",
      model_name: GEMINI_MODEL,
      prompt_version: GEMINI_PROMPT_VERSION,
      analyzed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create originality check");
  }

  await markSubmissionStatus(submissionId, "manual_review_required", {
    analysis_completed_at: new Date().toISOString(),
    analysis_error: message,
    latest_originality_check_id: data.id,
  });

  return data.id;
}

async function loadCandidateSubmissions(context: SubmissionContext) {
  const { data, error } = await supabase
    .from("submissions")
    .select(`
      id,
      student_id,
      student_name,
      assignment_id,
      file_name,
      file_path,
      file_mime_type,
      submitted_at,
      assignment:assignments (
        subject_id,
        level
      )
    `)
    .neq("id", context.id)
    .not("file_path", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(30);

  if (error) {
    throw error;
  }

  const scoped: CandidateSubmission[] = [];
  for (const row of (data ?? []) as Omit<CandidateSubmission, "source_scope">[]) {
    let sourceScope: SourceScope | null = null;

    if (row.assignment_id === context.assignment_id) {
      sourceScope = "same_assignment";
    } else if (
      context.assignment?.subject_id &&
      row.assignment?.subject_id === context.assignment.subject_id
    ) {
      sourceScope = "same_subject";
    } else if (context.assignment?.level && row.assignment?.level === context.assignment.level) {
      sourceScope = "same_level_semester";
    }

    if (sourceScope) {
      scoped.push({ ...row, source_scope: sourceScope });
    }
  }

  const priority: Record<SourceScope, number> = {
    same_assignment: 1,
    same_subject: 2,
    same_level_semester: 3,
  };

  return scoped
    .sort((left, right) => priority[left.source_scope] - priority[right.source_scope])
    .slice(0, 8);
}

function rankCandidatePassages(
  sourceText: string,
  candidate: CandidateSubmission,
  candidateText: string,
) {
  const ranked: RankedMatch[] = [];

  for (const sourcePassage of splitIntoPassages(sourceText)) {
    for (const candidatePassage of splitIntoPassages(candidateText)) {
      const similarityScore = jaccardSimilarity(sourcePassage, candidatePassage);
      if (similarityScore < 30) {
        continue;
      }

      ranked.push({
        matched_submission_id: candidate.id,
        matched_student_id: candidate.student_id,
        matched_student_name: candidate.student_name,
        matched_assignment_id: candidate.assignment_id,
        matched_subject_id: candidate.assignment?.subject_id ?? null,
        similarity_score: similarityScore,
        match_type: classifyMatchType(similarityScore),
        matched_excerpt: candidatePassage.slice(0, 800),
        section_text: sourcePassage.slice(0, 800),
        source_scope: candidate.source_scope,
        rank_order: 0,
      });
    }
  }

  return ranked
    .sort((left, right) => right.similarity_score - left.similarity_score)
    .slice(0, 3);
}

function geminiSchema() {
  return {
    type: "OBJECT",
    properties: {
      originality_score: { type: "INTEGER" },
      matching_percentage: { type: "INTEGER" },
      risk_level: { type: "STRING", enum: ["low", "medium", "high"] },
      recommended_status: { type: "STRING", enum: ["clean", "review", "flagged"] },
      confidence_score: { type: "INTEGER" },
      summary_for_teacher: { type: "STRING" },
      summary_for_student: { type: "STRING" },
      summary_for_admin: { type: "STRING" },
      suspicious_sections: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            section_text: { type: "STRING" },
            match_type: { type: "STRING", enum: MATCH_TYPE_VALUES },
            matched_reference_id: { type: "STRING" },
            reason: { type: "STRING" },
            similarity_score: { type: "INTEGER" },
          },
          required: [
            "section_text",
            "match_type",
            "matched_reference_id",
            "reason",
            "similarity_score",
          ],
        },
      },
      top_matches: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            matched_submission_id: { type: "STRING" },
            matched_student_id: { type: "STRING" },
            matched_student_name: { type: "STRING" },
            similarity_score: { type: "INTEGER" },
            match_type: { type: "STRING", enum: MATCH_TYPE_VALUES },
            matched_excerpt: { type: "STRING" },
            source_scope: { type: "STRING", enum: SOURCE_SCOPE_VALUES },
          },
          required: [
            "matched_submission_id",
            "matched_student_id",
            "matched_student_name",
            "similarity_score",
            "match_type",
            "matched_excerpt",
            "source_scope",
          ],
        },
      },
      reasoning_notes: {
        type: "ARRAY",
        items: { type: "STRING" },
      },
    },
    required: [
      "originality_score",
      "matching_percentage",
      "risk_level",
      "recommended_status",
      "confidence_score",
      "summary_for_teacher",
      "summary_for_student",
      "summary_for_admin",
      "suspicious_sections",
      "top_matches",
      "reasoning_notes",
    ],
  };
}

function buildPrompt(context: SubmissionContext, sourceText: string, topMatches: RankedMatch[]) {
  const references = topMatches.map((match, index) => ({
    reference_id: `match-${index + 1}`,
    matched_submission_id: match.matched_submission_id,
    matched_student_id: match.matched_student_id,
    matched_student_name: match.matched_student_name,
    similarity_score: match.similarity_score,
    match_type: match.match_type,
    source_scope: match.source_scope,
    source_excerpt: match.section_text,
    matched_excerpt: match.matched_excerpt,
  }));

  return `
Prompt version: ${GEMINI_PROMPT_VERSION}

${GEMINI_ANALYSIS_PROMPT}

Assignment context:
${JSON.stringify({
    assignment_id: context.assignment?.id ?? "",
    title: context.assignment?.title ?? "",
    subject: context.assignment?.subject ?? "",
    level: context.assignment?.level ?? "",
    source_submission_id: context.id,
  }, null, 2)}

Student submission text:
${sourceText.slice(0, 24000)}

Candidate internal matches:
${JSON.stringify(references, null, 2)}
  `.trim();
}

function normalizeGeminiAnalysis(
  value: unknown,
  topMatches: RankedMatch[],
  settings: SystemSettingsSnapshot,
): GeminiAnalysisResponse {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  const normalizedTopMatches = Array.isArray(raw.top_matches)
    ? raw.top_matches
        .map((item, index) => {
          const entry = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
          const fallback = topMatches[index];

          return {
            matched_submission_id: sanitizeTextValue(
              entry.matched_submission_id,
              fallback?.matched_submission_id ?? "",
              200,
            ),
            matched_student_id: sanitizeTextValue(
              entry.matched_student_id,
              fallback?.matched_student_id ?? "",
              200,
            ),
            matched_student_name: sanitizeTextValue(
              entry.matched_student_name,
              fallback?.matched_student_name ?? "",
              300,
            ),
            similarity_score: clampPercent(
              entry.similarity_score,
              fallback?.similarity_score ?? 0,
            ),
            match_type: normalizeMatchType(entry.match_type ?? fallback?.match_type),
            matched_excerpt: sanitizeTextValue(
              entry.matched_excerpt,
              fallback?.matched_excerpt ?? "",
              1200,
            ),
            source_scope: normalizeSourceScope(entry.source_scope ?? fallback?.source_scope),
          };
        })
        .slice(0, 8)
    : topMatches.slice(0, 8).map((match) => ({
        matched_submission_id: match.matched_submission_id,
        matched_student_id: match.matched_student_id,
        matched_student_name: match.matched_student_name,
        similarity_score: clampPercent(match.similarity_score, 0),
        match_type: match.match_type,
        matched_excerpt: match.matched_excerpt,
        source_scope: match.source_scope,
      }));

  const normalizedSections = Array.isArray(raw.suspicious_sections)
    ? raw.suspicious_sections
        .map((item, index) => {
          const entry = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
          const fallback = normalizedTopMatches[index];

          return {
            section_text: sanitizeTextValue(entry.section_text, "", 1200),
            match_type: normalizeMatchType(entry.match_type ?? fallback?.match_type),
            matched_reference_id: sanitizeTextValue(
              entry.matched_reference_id,
              fallback?.matched_submission_id ?? "",
              200,
            ),
            reason: sanitizeTextValue(entry.reason, "", 1200),
            similarity_score: clampPercent(
              entry.similarity_score,
              fallback?.similarity_score ?? 0,
            ),
          };
        })
        .filter((entry) => entry.section_text || entry.reason)
        .slice(0, 8)
    : [];

  const fallbackMatching = normalizedTopMatches[0]?.similarity_score ?? 0;
  const originalityScore = clampPercent(raw.originality_score, Math.max(0, 100 - fallbackMatching));
  const matchingPercentage = clampPercent(raw.matching_percentage, fallbackMatching);
  const modelRiskLevel = normalizeRiskLevel(raw.risk_level);
  const rulesRiskLevel = policyRiskLevel(originalityScore, settings);
  const riskLevel =
    riskLevelSeverity(modelRiskLevel) >= riskLevelSeverity(rulesRiskLevel)
      ? modelRiskLevel
      : rulesRiskLevel;
  const modelRecommendedStatus = normalizeRecommendedStatus(raw.recommended_status);
  const rulesRecommendedStatus = policyRecommendedStatus(riskLevel);
  const recommendedStatus =
    riskLevel === "high"
      ? "flagged"
      : riskLevel === "medium" && modelRecommendedStatus === "clean"
        ? rulesRecommendedStatus
        : modelRecommendedStatus;

  return {
    originality_score: originalityScore,
    matching_percentage: matchingPercentage,
    risk_level: riskLevel,
    recommended_status: recommendedStatus,
    confidence_score: clampPercent(raw.confidence_score, normalizedTopMatches.length > 0 ? 70 : 40),
    summary_for_teacher: sanitizeTextValue(
      raw.summary_for_teacher,
      "لم يتم إرجاع ملخص كافٍ للمعلم من المودل.",
      3000,
    ),
    summary_for_student: sanitizeTextValue(
      raw.summary_for_student,
      "تم تحليل التسليم وهو الآن بانتظار مراجعة المعلم.",
      2000,
    ),
    summary_for_admin: sanitizeTextValue(
      raw.summary_for_admin,
      "توجد نتيجة تحليل أصالة جديدة متاحة للإدارة.",
      3000,
    ),
    suspicious_sections: normalizedSections,
    top_matches: normalizedTopMatches,
    reasoning_notes: Array.isArray(raw.reasoning_notes)
      ? raw.reasoning_notes
          .map((item) => sanitizeTextValue(item, "", 500))
          .filter(Boolean)
          .slice(0, 12)
      : [],
  };
}

async function invokeGemini(
  context: SubmissionContext,
  sourceText: string,
  topMatches: RankedMatch[],
  settings: SystemSettingsSnapshot,
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildPrompt(context, sourceText, topMatches),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: geminiSchema(),
          temperature: 0.1,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned an empty payload");
  }

  const parsed = JSON.parse(text) as unknown;

  return {
    parsed: normalizeGeminiAnalysis(parsed, topMatches, settings),
    raw: payload as Record<string, unknown>,
  };
}

async function saveAnalysis(
  submissionId: string,
  analysis: GeminiAnalysisResponse,
  raw: Record<string, unknown>,
  topMatches: RankedMatch[],
) {
  const analyzedAt = new Date().toISOString();

  const { data: check, error: checkError } = await supabase
    .from("originality_checks")
    .insert({
      submission_id: submissionId,
      originality_score: analysis.originality_score,
      matching_percentage: analysis.matching_percentage,
      risk_level: analysis.risk_level,
      recommended_status: analysis.recommended_status,
      summary_for_teacher: analysis.summary_for_teacher,
      summary_for_student: analysis.summary_for_student,
      summary_for_admin: analysis.summary_for_admin,
      confidence_score: analysis.confidence_score,
      reasoning_notes: analysis.reasoning_notes,
      suspicious_sections: analysis.suspicious_sections,
      analysis_status: "completed",
      model_name: GEMINI_MODEL,
      prompt_version: GEMINI_PROMPT_VERSION,
      raw_response: raw,
      analyzed_at: analyzedAt,
    })
    .select("id")
    .single();

  if (checkError || !check) {
    throw checkError ?? new Error("Failed to store originality check");
  }

  if (topMatches.length > 0) {
    const { error: matchesError } = await supabase
      .from("submission_matches")
      .insert(
        topMatches.map((match, index) => ({
          originality_check_id: check.id,
          submission_id: submissionId,
          matched_submission_id: match.matched_submission_id,
          matched_student_id: match.matched_student_id,
          matched_student_name: match.matched_student_name,
          matched_assignment_id: match.matched_assignment_id,
          matched_subject_id: match.matched_subject_id,
          similarity_score: match.similarity_score,
          match_type: match.match_type,
          matched_excerpt: match.matched_excerpt,
          section_text: match.section_text,
          source_scope: match.source_scope,
          rank_order: index + 1,
        })),
      );

    if (matchesError) {
      throw matchesError;
    }
  }

  await markSubmissionStatus(submissionId, "completed", {
    analysis_completed_at: analyzedAt,
    analysis_error: "",
    latest_originality_check_id: check.id,
    originality: analysis.originality_score,
  });

  return check.id;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return jsonResponse({ error: "Missing Supabase configuration" }, 500);
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse({ error: "Missing GEMINI_API_KEY secret" }, 500);
  }

  let submissionId = "";

  try {
    const body = await request.json();
    submissionId = typeof body?.submission_id === "string" ? body.submission_id : "";
    if (!submissionId) {
      return jsonResponse({ error: "submission_id is required" }, 400);
    }

    const actor = await authenticateActor(request);
    if (!actor) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const context = await getSubmissionContext(submissionId);
    if (!canActorAnalyzeSubmission(actor, context)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    await markSubmissionStatus(submissionId, "processing", {
      analysis_requested_at: new Date().toISOString(),
      analysis_error: "",
    });

    const systemSettings = await loadSystemSettings();
    if (!context.file_path) {
      const checkId = await createManualReviewResult(submissionId, "لا يوجد ملف مرتبط بالتسليم.");
      return jsonResponse({
        ok: true,
        mode: "manual_review_required",
        originality_check_id: checkId,
      });
    }

    let sourceText = "";
    try {
      const bytes = await downloadSubmissionFile(context.file_path);
      sourceText = await extractSubmissionText(context.file_name, bytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر استخراج النص من الملف.";

      if (systemSettings.manual_review_on_extraction_failure) {
        const checkId = await createManualReviewResult(submissionId, message);
        return jsonResponse({
          ok: true,
          mode: "manual_review_required",
          originality_check_id: checkId,
        });
      }

      await markSubmissionStatus(submissionId, "failed", {
        analysis_completed_at: new Date().toISOString(),
        analysis_error: message,
        latest_originality_check_id: null,
      });
      return jsonResponse({ ok: true, mode: "failed", error: message });
    }

    if (normalizeText(sourceText).length < 200) {
      const message = "النص المستخرج قصير جداً للتحليل الآلي.";

      if (systemSettings.manual_review_on_extraction_failure) {
        const checkId = await createManualReviewResult(submissionId, message);
        return jsonResponse({
          ok: true,
          mode: "manual_review_required",
          originality_check_id: checkId,
        });
      }

      await markSubmissionStatus(submissionId, "failed", {
        analysis_completed_at: new Date().toISOString(),
        analysis_error: message,
        latest_originality_check_id: null,
      });
      return jsonResponse({ ok: true, mode: "failed", error: message });
    }

    const candidates = await loadCandidateSubmissions(context);
    const rankedMatches: RankedMatch[] = [];

    for (const candidate of candidates) {
      if (!candidate.file_path) {
        continue;
      }

      try {
        const bytes = await downloadSubmissionFile(candidate.file_path);
        const candidateText = await extractSubmissionText(candidate.file_name, bytes);
        rankedMatches.push(...rankCandidatePassages(sourceText, candidate, candidateText));
      } catch {
        continue;
      }
    }

    const topMatches = rankedMatches
      .sort((left, right) => right.similarity_score - left.similarity_score)
      .slice(0, 8)
      .map((match, index) => ({ ...match, rank_order: index + 1 }));

    const gemini = await invokeGemini(context, sourceText, topMatches, systemSettings);
    const originalityCheckId = await saveAnalysis(
      submissionId,
      gemini.parsed,
      gemini.raw,
      topMatches,
    );

    return jsonResponse({
      ok: true,
      originality_check_id: originalityCheckId,
      analysis_status: "completed",
      risk_level: gemini.parsed.risk_level,
      recommended_status: gemini.parsed.recommended_status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof HttpError ? error.status : 500;

    if (submissionId && status >= 500) {
      try {
        await markSubmissionStatus(submissionId, "failed", {
          analysis_completed_at: new Date().toISOString(),
          analysis_error: message,
        });
      } catch {
        // Ignore secondary persistence errors while returning the main failure.
      }
    }

    return jsonResponse({ error: message }, status);
  }
});
