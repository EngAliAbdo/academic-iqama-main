import { describe, expect, it } from "vitest";

import {
  canStudentAccessAssignmentWithMappings,
  formatAnalysisDuration,
  formatDurationSeconds,
  getAnalysisDurationSeconds,
} from "@/lib/academic-data";

describe("analysis duration helpers", () => {
  it("calculates elapsed seconds for completed analysis", () => {
    expect(
      getAnalysisDurationSeconds(
        "2026-03-24T10:00:00.000Z",
        "2026-03-24T10:01:05.000Z",
      ),
    ).toBe(65);
  });

  it("calculates ongoing elapsed seconds using the provided current time", () => {
    expect(
      getAnalysisDurationSeconds(
        "2026-03-24T10:00:00.000Z",
        null,
        new Date("2026-03-24T10:02:00.000Z"),
      ),
    ).toBe(120);
  });

  it("formats seconds into a short Arabic duration label", () => {
    expect(formatDurationSeconds(65)).toBe("1 د 5 ث");
    expect(formatDurationSeconds(3660)).toBe("1 س 1 د");
  });

  it("formats analysis duration and returns null for invalid intervals", () => {
    expect(
      formatAnalysisDuration(
        "2026-03-24T10:00:00.000Z",
        "2026-03-24T10:01:05.000Z",
      ),
    ).toBe("1 د 5 ث");

    expect(
      formatAnalysisDuration(
        "2026-03-24T10:01:05.000Z",
        "2026-03-24T10:00:00.000Z",
      ),
    ).toBeNull();
  });

  it("allows students by subject when the student is enrolled in the same subject", () => {
    expect(
      canStudentAccessAssignmentWithMappings(
        { subjectId: "subject-1" },
        [
          { studentId: "student-1", subjectId: "subject-1" },
        ],
        "student-1",
      ),
    ).toBe(true);
  });

  it("blocks students not enrolled in the same subject", () => {
    const mappings = [
      { studentId: "student-1", subjectId: "subject-2" },
      { studentId: "student-2", subjectId: "subject-1" },
    ];

    expect(
      canStudentAccessAssignmentWithMappings(
        { subjectId: "subject-1" },
        mappings,
        "student-1",
      ),
    ).toBe(false);

    expect(
      canStudentAccessAssignmentWithMappings(
        { subjectId: "subject-1" },
        mappings,
        "student-2",
      ),
    ).toBe(true);
  });
});
