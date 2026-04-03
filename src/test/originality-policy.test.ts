import { beforeEach, describe, expect, it } from "vitest";

import {
  getOriginalityRiskLevel,
  getSubmissionAttentionPriority,
  isSuspiciousSubmission,
} from "@/lib/academic-data";
import {
  DEFAULT_SYSTEM_SETTINGS,
  getOriginalityPolicySnapshot,
  normalizeSystemSettings,
  saveSystemSettings,
} from "@/lib/system-settings";

type SubmissionRiskInput = {
  status: "submitted" | "flagged";
  originality: number;
  analysisStatus: "pending" | "processing" | "completed" | "failed" | "manual_review_required";
};

function createRiskInput(overrides: Partial<SubmissionRiskInput> = {}): SubmissionRiskInput {
  return {
    status: "submitted",
    originality: 85,
    analysisStatus: "completed",
    ...overrides,
  };
}

describe("originality policy", () => {
  beforeEach(() => {
    localStorage.clear();
    saveSystemSettings(DEFAULT_SYSTEM_SETTINGS);
  });

  it("normalizes system settings and clamps risk thresholds", () => {
    const normalized = normalizeSystemSettings({
      highRiskBelow: 120,
      mediumRiskBelow: 20,
      suspiciousAlertBelow: 10,
      maxUploadSizeMb: 300,
      allowedSubmissionFormats: ["pdf", "docx", "txt", " PDF "],
    });

    expect(normalized.highRiskBelow).toBe(99);
    expect(normalized.mediumRiskBelow).toBe(100);
    expect(normalized.suspiciousAlertBelow).toBe(99);
    expect(normalized.maxUploadSizeMb).toBe(100);
    expect(normalized.allowedSubmissionFormats).toEqual(["PDF", "DOCX"]);
  });

  it("uses the configured originality thresholds when computing risk levels", () => {
    saveSystemSettings({
      highRiskBelow: 40,
      mediumRiskBelow: 70,
      suspiciousAlertBelow: 55,
    });

    expect(getOriginalityPolicySnapshot()).toEqual({
      highRiskBelow: 40,
      mediumRiskBelow: 70,
      suspiciousAlertBelow: 55,
    });

    expect(getOriginalityRiskLevel(createRiskInput({ analysisStatus: "manual_review_required" }))).toBe("manual");
    expect(getOriginalityRiskLevel(createRiskInput({ analysisStatus: "processing" }))).toBe("pending");
    expect(getOriginalityRiskLevel(createRiskInput({ originality: 35 }))).toBe("high");
    expect(getOriginalityRiskLevel(createRiskInput({ originality: 60 }))).toBe("medium");
    expect(getOriginalityRiskLevel(createRiskInput({ originality: 90 }))).toBe("low");
    expect(getOriginalityRiskLevel(createRiskInput({ status: "flagged", originality: 95 }))).toBe("high");
  });

  it("identifies suspicious submissions and assigns attention priority in the correct order", () => {
    saveSystemSettings({
      highRiskBelow: 50,
      mediumRiskBelow: 80,
      suspiciousAlertBelow: 65,
    });

    expect(isSuspiciousSubmission(createRiskInput({ analysisStatus: "manual_review_required" }))).toBe(true);
    expect(isSuspiciousSubmission(createRiskInput({ analysisStatus: "pending", originality: 40 }))).toBe(false);
    expect(isSuspiciousSubmission(createRiskInput({ originality: 60 }))).toBe(true);
    expect(isSuspiciousSubmission(createRiskInput({ originality: 90 }))).toBe(false);

    expect(getSubmissionAttentionPriority(createRiskInput({ analysisStatus: "failed" }))).toBe(5);
    expect(getSubmissionAttentionPriority(createRiskInput({ analysisStatus: "manual_review_required" }))).toBe(4);
    expect(getSubmissionAttentionPriority(createRiskInput({ originality: 45 }))).toBe(3);
    expect(getSubmissionAttentionPriority(createRiskInput({ analysisStatus: "processing" }))).toBe(2);
    expect(getSubmissionAttentionPriority(createRiskInput({ originality: 60 }))).toBe(1);
    expect(getSubmissionAttentionPriority(createRiskInput({ originality: 92 }))).toBe(0);
  });
});
