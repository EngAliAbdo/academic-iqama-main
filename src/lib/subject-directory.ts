import type {
  AcademicSubject,
  Assignment,
  StudentSubjectMapping,
  Submission,
} from "@/lib/academic-data";

export interface SubjectSummary {
  id: string;
  name: string;
  teacherNames: string[];
  levels: string[];
  assignmentCount: number;
  studentCount: number;
  submissionCount: number;
  status: AcademicSubject["status"];
  code?: string;
  department?: string;
  semester?: string;
}

function normalizeSubjectName(subject: string) {
  return subject.trim() || "غير محدد";
}

function toSubjectId(subject: string) {
  return normalizeSubjectName(subject)
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function buildSubjectSummaries(
  assignments: Assignment[],
  submissions: Submission[] = [],
  subjects: AcademicSubject[] = [],
  studentSubjectMappings: StudentSubjectMapping[] = [],
) {
  const catalogById = new Map(subjects.map((subject) => [subject.id, subject]));
  const grouped = new Map<
    string,
    {
      id: string;
      name: string;
      teacherNames: Set<string>;
      levels: Set<string>;
      assignmentIds: Set<string>;
      studentIds: Set<string>;
      enrolledStudentIds: Set<string>;
      submissionCount: number;
      code?: string;
      department?: string;
      semester?: string;
    }
  >();

  assignments.forEach((assignment) => {
    const subject = assignment.subjectId ? catalogById.get(assignment.subjectId) : undefined;
    const subjectName = normalizeSubjectName(subject?.nameAr ?? assignment.subject);
    const key = assignment.subjectId ?? subjectName.toLowerCase();
    const current = grouped.get(key) ?? {
      id: subject?.id ?? assignment.subjectId ?? toSubjectId(subjectName),
      name: subjectName,
      teacherNames: new Set<string>(),
      levels: new Set<string>(subject?.level ? [subject.level] : []),
      assignmentIds: new Set<string>(),
      studentIds: new Set<string>(),
      enrolledStudentIds: new Set<string>(),
      submissionCount: 0,
      code: subject?.code,
      department: subject?.department,
      semester: subject?.semester,
    };

    if (assignment.teacherName) {
      current.teacherNames.add(assignment.teacherName);
    }

    if (assignment.level) {
      current.levels.add(assignment.level);
    }

    current.assignmentIds.add(assignment.id);
    grouped.set(key, current);
  });

  submissions.forEach((submission) => {
    const assignment = assignments.find((item) => item.id === submission.assignmentId);
    if (!assignment) {
      return;
    }

    const subject = assignment.subjectId ? catalogById.get(assignment.subjectId) : undefined;
    const subjectName = normalizeSubjectName(subject?.nameAr ?? assignment.subject);
    const key = assignment.subjectId ?? subjectName.toLowerCase();
    const current = grouped.get(key);
    if (!current) {
      return;
    }

    current.studentIds.add(submission.studentId);
    current.submissionCount += 1;
  });

  studentSubjectMappings.forEach((mapping) => {
    const current = grouped.get(mapping.subjectId);
    if (!current) {
      return;
    }

    current.enrolledStudentIds.add(mapping.studentId);
  });

  return Array.from(grouped.values())
    .map((subject) => ({
      id: subject.id,
      name: subject.name,
      teacherNames: Array.from(subject.teacherNames),
      levels: Array.from(subject.levels),
      assignmentCount: subject.assignmentIds.size,
      studentCount:
        subject.enrolledStudentIds.size > 0
          ? subject.enrolledStudentIds.size
          : subject.studentIds.size,
      submissionCount: subject.submissionCount,
      status: "active",
      code: subject.code,
      department: subject.department,
      semester: subject.semester,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "ar"));
}

export function buildCatalogSubjectSummaries(
  subjects: AcademicSubject[],
  assignments: Assignment[],
  submissions: Submission[] = [],
  studentSubjectMappings: StudentSubjectMapping[] = [],
) {
  const subjectAssignments = assignments.filter((assignment) => assignment.subjectId);
  const seededMap = new Map(
    subjects.map((subject) => [
      subject.id,
      {
        id: subject.id,
        name: normalizeSubjectName(subject.nameAr),
        teacherNames: [] as string[],
        levels: subject.level ? [subject.level] : [],
        assignmentCount: 0,
        studentIds: new Set<string>(),
        enrolledStudentIds: new Set<string>(),
        submissionCount: 0,
        status: subject.status,
        code: subject.code,
        department: subject.department,
        semester: subject.semester,
      },
    ]),
  );

  subjectAssignments.forEach((assignment) => {
    if (!assignment.subjectId) {
      return;
    }

    const current = seededMap.get(assignment.subjectId);
    if (!current) {
      return;
    }

    current.assignmentCount += 1;
    if (assignment.teacherName && !current.teacherNames.includes(assignment.teacherName)) {
      current.teacherNames.push(assignment.teacherName);
    }
    if (assignment.level && !current.levels.includes(assignment.level)) {
      current.levels.push(assignment.level);
    }
  });

  submissions.forEach((submission) => {
    const assignment = assignments.find((item) => item.id === submission.assignmentId);
    if (!assignment?.subjectId) {
      return;
    }

    const current = seededMap.get(assignment.subjectId);
    if (!current) {
      return;
    }

    current.submissionCount += 1;
    current.studentIds.add(submission.studentId);
  });

  studentSubjectMappings.forEach((mapping) => {
    const current = seededMap.get(mapping.subjectId);
    if (!current) {
      return;
    }

    current.enrolledStudentIds.add(mapping.studentId);
  });

  return Array.from(seededMap.values())
    .map((subject) => ({
      id: subject.id,
      name: subject.name,
      teacherNames: subject.teacherNames.sort((left, right) => left.localeCompare(right, "ar")),
      levels: subject.levels.sort((left, right) => left.localeCompare(right, "ar")),
      assignmentCount: subject.assignmentCount,
      studentCount:
        subject.enrolledStudentIds.size > 0
          ? subject.enrolledStudentIds.size
          : subject.studentIds.size,
      submissionCount: subject.submissionCount,
      status: subject.status,
      code: subject.code,
      department: subject.department,
      semester: subject.semester,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "ar"));
}
