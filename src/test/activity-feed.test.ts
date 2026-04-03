import { describe, expect, it } from "vitest";

import { buildActivityFeed, isFailedAnalysisActivity } from "@/lib/activity-feed";
import type { Assignment, Submission } from "@/lib/academic-data";

function createAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "assignment-1",
    title: "بحث الذكاء الاصطناعي",
    subject: "الذكاء الاصطناعي",
    teacherId: "teacher-1",
    teacherName: "د. أحمد",
    level: "المستوى الثامن",
    dueAt: "2026-03-30T12:00:00.000Z",
    description: "وصف التكليف",
    instructions: "تعليمات التكليف",
    allowedFormats: ["pdf", "docx"],
    maxSubmissions: 1,
    attachments: [],
    hasAttachment: false,
    status: "published",
    createdAt: "2026-03-20T08:00:00.000Z",
    ...overrides,
  };
}

function createSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: "submission-1",
    assignmentId: "assignment-1",
    studentId: "student-1",
    studentName: "سارة علي",
    academicId: "202312345",
    fileName: "assignment.pdf",
    filePath: null,
    fileMimeType: "application/pdf",
    fileSize: "1.2 MB",
    notes: "",
    submittedAt: "2026-03-21T08:00:00.000Z",
    originality: 87,
    status: "submitted",
    grade: null,
    feedback: "",
    semester: "الفصل الثاني",
    analysisStatus: "completed",
    analysisRequestedAt: "2026-03-21T09:00:00.000Z",
    analysisCompletedAt: "2026-03-21T09:05:00.000Z",
    analysisError: "",
    latestOriginalityCheckId: null,
    events: [],
    ...overrides,
  };
}

describe("buildActivityFeed", () => {
  it("adds the analysis error to failed analysis events", () => {
    const feed = buildActivityFeed({
      assignments: [createAssignment()],
      originalityChecks: [],
      reviews: [],
      submissions: [
        createSubmission({
          analysisStatus: "failed",
          analysisCompletedAt: "2026-03-21T09:06:00.000Z",
          analysisError: "OCR extraction failed",
        }),
      ],
    });

    const failedEvent = feed.find((item) => item.id === "analysis-failed-submission-1");

    expect(failedEvent).toBeDefined();
    expect(failedEvent?.details).toContain("OCR extraction failed");
    expect(failedEvent && isFailedAnalysisActivity(failedEvent)).toBe(true);
    expect(feed[0]?.id).toBe("analysis-failed-submission-1");
    expect(feed[1]?.id).toBe("analysis-request-submission-1");
  });

  it("adds the analysis error to manual review events", () => {
    const feed = buildActivityFeed({
      assignments: [createAssignment()],
      originalityChecks: [],
      reviews: [],
      submissions: [
        createSubmission({
          analysisStatus: "manual_review_required",
          analysisCompletedAt: "2026-03-21T09:06:00.000Z",
          analysisError: "File text was too short",
        }),
      ],
    });

    const manualReviewEvent = feed.find((item) => item.id === "analysis-manual-submission-1");

    expect(manualReviewEvent).toBeDefined();
    expect(manualReviewEvent?.details).toContain("File text was too short");
    expect(manualReviewEvent?.statusVariant).toBe("revision");
  });
});
