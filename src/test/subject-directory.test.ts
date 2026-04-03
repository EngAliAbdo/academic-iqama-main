import { describe, expect, it } from "vitest";

import type {
  AcademicSubject,
  Assignment,
  StudentSubjectMapping,
  Submission,
} from "@/lib/academic-data";
import {
  buildCatalogSubjectSummaries,
  buildSubjectSummaries,
} from "@/lib/subject-directory";

const SUBJECTS: AcademicSubject[] = [
  {
    id: "subject-1",
    nameAr: "قواعد البيانات",
    nameEn: "Databases",
    code: "DB401",
    department: "كلية الحاسبات",
    level: "المستوى السادس",
    semester: "الفصل الثاني 1447",
    status: "active",
  },
];

const ASSIGNMENTS: Assignment[] = [
  {
    id: "assignment-1",
    subjectId: "subject-1",
    title: "تقرير القواعد",
    subject: "قواعد البيانات",
    teacherId: "teacher-1",
    teacherName: "د. سارة خالد القحطاني",
    level: "المستوى السادس",
    dueAt: "2026-03-30T10:00:00.000Z",
    description: "",
    instructions: "",
    allowedFormats: ["PDF"],
    maxSubmissions: 1,
    attachments: [],
    hasAttachment: false,
    resubmissionPolicy: "replace_latest",
    status: "published",
    createdAt: "2026-03-20T10:00:00.000Z",
  },
];

const SUBMISSIONS: Submission[] = [
  {
    id: "submission-1",
    assignmentId: "assignment-1",
    studentId: "student-1",
    studentName: "طالب 1",
    academicId: "202300001",
    fileName: "report.pdf",
    filePath: null,
    fileMimeType: "application/pdf",
    fileSize: "1 MB",
    notes: "",
    submittedAt: "2026-03-21T10:00:00.000Z",
    originality: 88,
    status: "submitted",
    grade: null,
    feedback: "",
    semester: "الفصل الثاني 1447",
    analysisStatus: "completed",
    analysisRequestedAt: "2026-03-21T10:00:00.000Z",
    analysisCompletedAt: "2026-03-21T10:02:00.000Z",
    analysisError: "",
    latestOriginalityCheckId: "check-1",
    events: [],
  },
];

describe("subject directory helpers", () => {
  it("prefers explicit student enrollments over submission counts in catalog summaries", () => {
    const studentSubjectMappings: StudentSubjectMapping[] = [
      {
        id: "mapping-1",
        studentId: "student-1",
        subjectId: "subject-1",
        createdAt: "2026-03-20T09:00:00.000Z",
      },
      {
        id: "mapping-2",
        studentId: "student-2",
        subjectId: "subject-1",
        createdAt: "2026-03-20T09:01:00.000Z",
      },
    ];

    const [summary] = buildCatalogSubjectSummaries(
      SUBJECTS,
      ASSIGNMENTS,
      SUBMISSIONS,
      studentSubjectMappings,
    );

    expect(summary?.studentCount).toBe(2);
    expect(summary?.submissionCount).toBe(1);
  });

  it("falls back to submitting students when no explicit enrollments exist", () => {
    const [summary] = buildSubjectSummaries(ASSIGNMENTS, SUBMISSIONS, SUBJECTS, []);

    expect(summary?.studentCount).toBe(1);
    expect(summary?.assignmentCount).toBe(1);
  });
});
