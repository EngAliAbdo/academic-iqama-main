export const SYSTEM_SETTINGS_STORAGE_KEY = "academic-iqama.system-settings";
export const SYSTEM_SETTINGS_UPDATED_EVENT = "academic-iqama.system-settings.updated";
export const SYSTEM_SETTINGS_ACTIVITY_EVENT = "academic-iqama.system-settings.activity";
export const SUPPORTED_SUBMISSION_FORMATS = ["PDF", "DOCX"] as const;

export type SupportedSubmissionFormat = (typeof SUPPORTED_SUBMISSION_FORMATS)[number];

export interface SystemSettings {
  institutionName: string;
  academicYear: string;
  maxUploadSizeMb: number;
  allowedSubmissionFormats: string[];
  mediumRiskBelow: number;
  highRiskBelow: number;
  suspiciousAlertBelow: number;
  manualReviewOnExtractionFailure: boolean;
  autoStartAnalysis: boolean;
}

export interface SystemSettingsActivityDetail {
  actorId?: string | null;
  actorName: string;
  actorRole: "student" | "teacher" | "admin" | "system";
  occurredAt: string;
  previousSettings: SystemSettings;
  nextSettings: SystemSettings;
  storageMode: "local" | "supabase";
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  institutionName: "جامعة المعرفة",
  academicYear: "1447 هـ",
  maxUploadSizeMb: 10,
  allowedSubmissionFormats: [...SUPPORTED_SUBMISSION_FORMATS],
  mediumRiskBelow: 80,
  highRiskBelow: 50,
  suspiciousAlertBelow: 60,
  manualReviewOnExtractionFailure: true,
  autoStartAnalysis: true,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeFormats(formats: unknown) {
  if (!Array.isArray(formats)) {
    return DEFAULT_SYSTEM_SETTINGS.allowedSubmissionFormats;
  }

  const normalized = Array.from(
    new Set(
      formats
        .map((format) => (typeof format === "string" ? format.trim().toUpperCase() : ""))
        .filter((format) =>
          SUPPORTED_SUBMISSION_FORMATS.includes(format as SupportedSubmissionFormat),
        )
        .filter(Boolean),
    ),
  );

  return normalized.length > 0 ? normalized : DEFAULT_SYSTEM_SETTINGS.allowedSubmissionFormats;
}

export function normalizeSystemSettings(
  value: Partial<SystemSettings> | null | undefined,
): SystemSettings {
  const highRiskBelow = clamp(
    Number(value?.highRiskBelow ?? DEFAULT_SYSTEM_SETTINGS.highRiskBelow),
    1,
    99,
  );
  const mediumRiskBelow = clamp(
    Number(value?.mediumRiskBelow ?? DEFAULT_SYSTEM_SETTINGS.mediumRiskBelow),
    highRiskBelow + 1,
    100,
  );
  const suspiciousAlertBelow = clamp(
    Number(value?.suspiciousAlertBelow ?? DEFAULT_SYSTEM_SETTINGS.suspiciousAlertBelow),
    highRiskBelow,
    mediumRiskBelow,
  );

  return {
    institutionName:
      typeof value?.institutionName === "string" && value.institutionName.trim()
        ? value.institutionName.trim()
        : DEFAULT_SYSTEM_SETTINGS.institutionName,
    academicYear:
      typeof value?.academicYear === "string" && value.academicYear.trim()
        ? value.academicYear.trim()
        : DEFAULT_SYSTEM_SETTINGS.academicYear,
    maxUploadSizeMb: clamp(
      Number(value?.maxUploadSizeMb ?? DEFAULT_SYSTEM_SETTINGS.maxUploadSizeMb),
      1,
      100,
    ),
    allowedSubmissionFormats: normalizeFormats(value?.allowedSubmissionFormats),
    mediumRiskBelow,
    highRiskBelow,
    suspiciousAlertBelow,
    manualReviewOnExtractionFailure:
      typeof value?.manualReviewOnExtractionFailure === "boolean"
        ? value.manualReviewOnExtractionFailure
        : DEFAULT_SYSTEM_SETTINGS.manualReviewOnExtractionFailure,
    autoStartAnalysis:
      typeof value?.autoStartAnalysis === "boolean"
        ? value.autoStartAnalysis
        : DEFAULT_SYSTEM_SETTINGS.autoStartAnalysis,
  };
}

export function loadSystemSettings() {
  if (typeof window === "undefined") {
    return DEFAULT_SYSTEM_SETTINGS;
  }

  const raw = localStorage.getItem(SYSTEM_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SYSTEM_SETTINGS;
  }

  try {
    return normalizeSystemSettings(JSON.parse(raw) as Partial<SystemSettings>);
  } catch {
    return DEFAULT_SYSTEM_SETTINGS;
  }
}

export function saveSystemSettings(settings: Partial<SystemSettings>) {
  const normalized = normalizeSystemSettings(settings);

  if (typeof window !== "undefined") {
    localStorage.setItem(SYSTEM_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event(SYSTEM_SETTINGS_UPDATED_EVENT));
  }

  return normalized;
}

export function dispatchSystemSettingsActivity(detail: SystemSettingsActivityDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<SystemSettingsActivityDetail>(SYSTEM_SETTINGS_ACTIVITY_EVENT, {
      detail,
    }),
  );
}

export function getSystemSettingsSnapshot() {
  return loadSystemSettings();
}

export function getInstitutionAllowedFormats(settings = getSystemSettingsSnapshot()) {
  return settings.allowedSubmissionFormats;
}

export function getEffectiveAllowedFormats(
  assignmentFormats: string[] | undefined,
  settings = getSystemSettingsSnapshot(),
) {
  const institutionFormats = getInstitutionAllowedFormats(settings);
  const normalizedAssignmentFormats = Array.isArray(assignmentFormats)
    ? assignmentFormats.map((format) => format.trim().toUpperCase()).filter(Boolean)
    : [];

  if (normalizedAssignmentFormats.length === 0) {
    return institutionFormats;
  }

  return normalizedAssignmentFormats.filter((format) => institutionFormats.includes(format));
}

export function getMaxUploadSizeBytes(settings = getSystemSettingsSnapshot()) {
  return settings.maxUploadSizeMb * 1024 * 1024;
}

export function getOriginalityPolicySnapshot(settings = getSystemSettingsSnapshot()) {
  return {
    highRiskBelow: settings.highRiskBelow,
    mediumRiskBelow: settings.mediumRiskBelow,
    suspiciousAlertBelow: settings.suspiciousAlertBelow,
  };
}
