import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, isBefore, isSameDay, isSameMonth, startOfDay } from "date-fns";
import { ar } from "date-fns/locale";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Clock3,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { useAcademicData } from "@/contexts/AcademicDataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatDateLabel,
  getSubmissionAnalysisStatusLabel,
  getSubmissionBadgeVariant,
  isAnalysisPending,
  type Assignment,
  type Review,
  type Submission,
} from "@/lib/academic-data";
import { cn } from "@/lib/utils";

type CalendarEventType = "due" | "overdue" | "submitted" | "analysis" | "reviewed";

interface CalendarEventItem {
  id: string;
  date: Date;
  assignmentId: string;
  title: string;
  subject: string;
  type: CalendarEventType;
  description: string;
  actionHref: string;
  actionLabel: string;
}

function getEventTypeLabel(type: CalendarEventType) {
  return {
    due: "موعد نهائي",
    overdue: "متأخر",
    submitted: "تم الرفع",
    analysis: "تحليل الأصالة",
    reviewed: "تمت المراجعة",
  }[type];
}

function getEventTypeClass(type: CalendarEventType) {
  return {
    due: "bg-primary/10 text-primary",
    overdue: "bg-destructive/10 text-destructive",
    submitted: "bg-success/10 text-success",
    analysis: "bg-warning/10 text-warning",
    reviewed: "bg-info/10 text-info",
  }[type];
}

function getUniqueDays(items: CalendarEventItem[], type?: CalendarEventType) {
  const keys = new Map<number, Date>();

  items.forEach((item) => {
    if (type && item.type !== type) {
      return;
    }

    const day = startOfDay(item.date);
    keys.set(day.getTime(), day);
  });

  return Array.from(keys.values());
}

function getPreferredCalendarDate(items: CalendarEventItem[], referenceDate = new Date()) {
  if (items.length === 0) {
    return null;
  }

  const referenceDay = startOfDay(referenceDate);
  const sortedDays = getUniqueDays(items).sort((left, right) => +left - +right);
  const todayMatch = sortedDays.find((day) => isSameDay(day, referenceDay));

  if (todayMatch) {
    return todayMatch;
  }

  const upcoming = sortedDays.find((day) => +day >= +referenceDay);
  if (upcoming) {
    return upcoming;
  }

  return sortedDays[sortedDays.length - 1];
}

function shortenLabel(value: string, maxLength = 26) {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength)}...`;
}

function buildAssignmentEvents(
  assignment: Assignment,
  submission: Submission | undefined,
  review: Review | undefined,
): CalendarEventItem[] {
  const dueDate = new Date(assignment.dueAt);
  const isOverdue = !submission && isBefore(dueDate, new Date());
  const events: CalendarEventItem[] = [
    {
      id: `due-${assignment.id}`,
      date: dueDate,
      assignmentId: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      type: isOverdue ? "overdue" : "due",
      description: submission
        ? "الموعد النهائي الأصلي للتكليف مع وجود تسليم محفوظ."
        : isOverdue
          ? "انتهى موعد التسليم ولم يتم رفع الملف بعد."
          : "الموعد النهائي لرفع ملف التكليف.",
      actionHref: submission
        ? `/student/status?assignment=${assignment.id}`
        : `/student/upload?assignment=${assignment.id}`,
      actionLabel: submission ? "متابعة التسليم" : "رفع التكليف",
    },
  ];

  if (submission) {
    events.push({
      id: `submitted-${submission.id}`,
      date: new Date(submission.submittedAt),
      assignmentId: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      type: "submitted",
      description: `تم رفع الملف: ${submission.fileName}`,
      actionHref: `/student/status?assignment=${assignment.id}`,
      actionLabel: "عرض الحالة",
    });

    if (submission.analysisRequestedAt) {
      events.push({
        id: `analysis-${submission.id}`,
        date: new Date(submission.analysisCompletedAt ?? submission.analysisRequestedAt),
        assignmentId: assignment.id,
        title: assignment.title,
        subject: assignment.subject,
        type: "analysis",
        description: `حالة التحليل الحالية: ${getSubmissionAnalysisStatusLabel(submission.analysisStatus)}`,
        actionHref: `/student/originality?assignment=${assignment.id}`,
        actionLabel: "عرض الأصالة",
      });
    }
  }

  if (review?.reviewedAt) {
    events.push({
      id: `review-${review.id}`,
      date: new Date(review.reviewedAt),
      assignmentId: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      type: "reviewed",
      description: "أضاف المعلم مراجعة أو قرارًا نهائيًا على هذا التسليم.",
      actionHref: `/student/status?assignment=${assignment.id}`,
      actionLabel: "عرض النتيجة",
    });
  }

  return events;
}

export default function StudentCalendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    getReviewBySubmissionId,
    getStudentAssignments,
    getStudentSubmission,
    getStudentSubmissions,
  } = useAcademicData();

  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [month, setMonth] = useState<Date>(() => startOfDay(new Date()));
  const [didAutoSelectDate, setDidAutoSelectDate] = useState(false);

  const userId = user?.id ?? "";

  const assignments = useMemo(
    () => (userId ? getStudentAssignments(userId).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)) : []),
    [getStudentAssignments, userId],
  );

  const submissions = useMemo(
    () => (userId ? getStudentSubmissions(userId) : []),
    [getStudentSubmissions, userId],
  );

  const events = useMemo(() => {
    if (!userId) {
      return [];
    }

    return assignments
      .flatMap((assignment) => {
        const submission = getStudentSubmission(userId, assignment.id);
        const review = submission ? getReviewBySubmissionId(submission.id) : undefined;
        return buildAssignmentEvents(assignment, submission, review);
      })
      .sort((left, right) => +left.date - +right.date);
  }, [assignments, getReviewBySubmissionId, getStudentSubmission, userId]);

  const selectedDayEvents = useMemo(
    () => events.filter((item) => isSameDay(item.date, selectedDate)),
    [events, selectedDate],
  );

  const monthEvents = useMemo(
    () => events.filter((item) => isSameMonth(item.date, month)),
    [events, month],
  );

  const upcomingAssignments = useMemo(
    () =>
      assignments
        .filter((assignment) => !getStudentSubmission(userId, assignment.id))
        .slice()
        .sort((left, right) => +new Date(left.dueAt) - +new Date(right.dueAt))
        .slice(0, 6),
    [assignments, getStudentSubmission, userId],
  );

  const openAssignmentsCount = upcomingAssignments.length;
  const overdueAssignmentsCount = assignments.filter((assignment) => {
    const submission = getStudentSubmission(userId, assignment.id);
    return !submission && isBefore(new Date(assignment.dueAt), new Date());
  }).length;
  const monthDueCount = monthEvents.filter((event) => event.type === "due" || event.type === "overdue").length;
  const activeAnalysisCount = submissions.filter((submission) => isAnalysisPending(submission.analysisStatus)).length;

  const dueDays = getUniqueDays(events, "due");
  const overdueDays = getUniqueDays(events, "overdue");
  const submittedDays = getUniqueDays(events, "submitted");
  const analysisDays = getUniqueDays(events, "analysis");
  const reviewedDays = getUniqueDays(events, "reviewed");
  const allEventDays = getUniqueDays(events);
  const preferredEventDate = useMemo(() => getPreferredCalendarDate(events), [events]);

  useEffect(() => {
    if (didAutoSelectDate || !preferredEventDate) {
      return;
    }

    setSelectedDate(preferredEventDate);
    setMonth(preferredEventDate);
    setDidAutoSelectDate(true);
  }, [didAutoSelectDate, preferredEventDate]);

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setMonth(date);
    setDidAutoSelectDate(true);
  };

  const handleJumpToDate = (date: Date | null) => {
    if (!date) {
      return;
    }

    handleSelectDate(date);
  };

  const nextEventDate = useMemo(() => {
    if (selectedDayEvents.length > 0) {
      return null;
    }

    return getPreferredCalendarDate(events, selectedDate);
  }, [events, selectedDate, selectedDayEvents.length]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-h1 font-bold">التقويم والمواعيد</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          عرض حي لمواعيد التكليفات، وعمليات الرفع، وآخر مراحل التحليل والمراجعة الخاصة بك.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="تكليفات مفتوحة"
          value={openAssignmentsCount}
          icon={BookOpen}
          onClick={() => navigate("/student/assignments")}
        />
        <StatCard
          title="متأخرة"
          value={overdueAssignmentsCount}
          icon={AlertTriangle}
          onClick={() => navigate("/student/upload")}
        />
        <StatCard
          title={format(month, "MMMM yyyy", { locale: ar })}
          value={monthDueCount}
          icon={CalendarDays}
          onClick={monthDueCount > 0 ? () => handleJumpToDate(monthEvents[0]?.date ?? null) : undefined}
        />
        <StatCard
          title="تحليلات جارية"
          value={activeAnalysisCount}
          icon={Clock3}
          onClick={() => navigate("/student/status")}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2">
            <div>
              <h2 className="font-semibold">تقويم الطالب</h2>
              <p className="text-xs text-muted-foreground">
                اختر أي يوم لعرض جميع الأحداث المرتبطة به.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { label: "مواعيد التسليم", className: "bg-primary/10 text-primary" },
                { label: "متأخر", className: "bg-destructive/10 text-destructive" },
                { label: "تم الرفع", className: "bg-success/10 text-success" },
                { label: "التحليل", className: "bg-warning/10 text-warning" },
                { label: "المراجعة", className: "bg-info/10 text-info" },
              ].map((item) => (
                <span key={item.label} className={cn("rounded-full px-3 py-1 font-medium", item.className)}>
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && handleSelectDate(date)}
            month={month}
            onMonthChange={setMonth}
            locale={ar}
            weekStartsOn={6}
            modifiers={{
              hasEvents: allEventDays,
              due: dueDays,
              overdue: overdueDays,
              submitted: submittedDays,
              analysis: analysisDays,
              reviewed: reviewedDays,
            }}
            modifiersClassNames={{
              hasEvents: "relative after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary",
              due: "bg-primary/5 text-primary-foreground",
              overdue: "bg-destructive/10 text-destructive after:bg-destructive",
              submitted: "bg-success/10 text-success after:bg-success",
              analysis: "bg-warning/10 text-warning after:bg-warning",
              reviewed: "bg-info/10 text-info after:bg-info",
            }}
            className="rounded-2xl border border-border"
          />
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-card p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">أحداث اليوم المحدد</h2>
                <p className="text-xs text-muted-foreground">
                  {format(selectedDate, "EEEE d MMMM yyyy", { locale: ar })}
                </p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {selectedDayEvents.length} حدث
              </span>
            </div>

            <div className="space-y-3">
              {selectedDayEvents.length > 0 ? (
                selectedDayEvents.map((event) => (
                  <div key={event.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium break-words" title={event.title}>
                          {shortenLabel(event.title, 42)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate" title={event.subject}>
                          {event.subject}
                        </p>
                      </div>
                      <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", getEventTypeClass(event.type))}>
                        {getEventTypeLabel(event.type)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{event.description}</p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">{formatDateLabel(event.date.toISOString())}</p>
                      <Link to={event.actionHref}>
                        <Button variant="outline" size="sm" className="rounded-lg text-xs">
                          {event.actionLabel}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  <p>لا توجد أحداث مرتبطة بهذا اليوم.</p>
                  {nextEventDate ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 rounded-lg text-xs"
                      onClick={() => handleJumpToDate(nextEventDate)}
                    >
                      الانتقال إلى أقرب يوم فيه حدث
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-card p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold">أقرب المواعيد المفتوحة</h2>
              <span className="text-xs text-muted-foreground">{upcomingAssignments.length} عناصر</span>
            </div>

            <div className="space-y-3">
              {upcomingAssignments.length > 0 ? (
                upcomingAssignments.map((assignment) => {
                  const overdue = isBefore(new Date(assignment.dueAt), new Date());

                  return (
                    <div key={assignment.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-4">
                      <div>
                        <p className="font-medium break-words" title={assignment.title}>
                          {shortenLabel(assignment.title, 36)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate" title={assignment.subject}>
                          {assignment.subject}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">{formatDateLabel(assignment.dueAt)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            overdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
                          )}
                        >
                          {overdue ? "متأخر" : "مفتوح"}
                        </span>
                        <Link to={`/student/upload?assignment=${assignment.id}`}>
                          <Button size="sm" variant="outline" className="rounded-lg text-xs">
                            رفع الآن
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  لا توجد تكليفات مفتوحة بدون تسليم حاليًا.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-card p-6 shadow-card">
            <h2 className="mb-4 font-semibold">ملخص سريع</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">آخر تسليم محفوظ</span>
                <span className="font-medium">
                  {submissions[0] ? formatDateLabel(submissions[0].submittedAt) : "لا يوجد"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">آخر حالة تحليل</span>
                <span className="font-medium">
                  {submissions[0] ? getSubmissionAnalysisStatusLabel(submissions[0].analysisStatus) : "لا يوجد"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">آخر حالة تسليم</span>
                <span className="font-medium">
                  {submissions[0] ? (
                    <StatusBadge variant={getSubmissionBadgeVariant(submissions[0].status)} />
                  ) : (
                    "لا يوجد"
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
