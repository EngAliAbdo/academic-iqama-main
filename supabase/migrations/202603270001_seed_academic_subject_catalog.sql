with seed(code, name_ar, name_en, department, level, semester, status) as (
  values
    ('IT101', 'مقدمة في تقنية المعلومات', 'Introduction to Information Technology', 'تقنية المعلومات', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('IT221', 'شبكات الحاسوب', 'Computer Networks', 'تقنية المعلومات', 'المستوى الثاني', 'الفصل الثاني', 'active'),
    ('IT331', 'أمن المعلومات', 'Information Security', 'تقنية المعلومات', 'المستوى الثالث', 'الفصل الأول', 'active'),
    ('CS101', 'برمجة 1', 'Programming 1', 'علوم الحاسوب', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('CS202', 'هياكل البيانات', 'Data Structures', 'علوم الحاسوب', 'المستوى الثاني', 'الفصل الثاني', 'active'),
    ('CS431', 'الذكاء الاصطناعي', 'Artificial Intelligence', 'علوم الحاسوب', 'المستوى الرابع', 'الفصل الأول', 'active'),
    ('IS301', 'تحليل وتصميم النظم', 'Systems Analysis and Design', 'نظم المعلومات', 'المستوى الثالث', 'الفصل الأول', 'active'),
    ('IS302', 'قواعد البيانات', 'Databases', 'نظم المعلومات', 'المستوى الثالث', 'الفصل الثاني', 'active'),
    ('IS411', 'نظم تخطيط الموارد', 'Enterprise Resource Planning', 'نظم المعلومات', 'المستوى الرابع', 'الفصل الأول', 'active'),
    ('SE301', 'هندسة البرمجيات', 'Software Engineering', 'هندسة البرمجيات', 'المستوى الثالث', 'الفصل الأول', 'active'),
    ('SE402', 'اختبار البرمجيات', 'Software Testing', 'هندسة البرمجيات', 'المستوى الرابع', 'الفصل الأول', 'active'),
    ('SE404', 'إدارة المشاريع البرمجية', 'Software Project Management', 'هندسة البرمجيات', 'المستوى الرابع', 'الفصل الثاني', 'active'),
    ('BA101', 'مبادئ الإدارة', 'Principles of Management', 'إدارة الأعمال', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('BA221', 'إدارة الموارد البشرية', 'Human Resources Management', 'إدارة الأعمال', 'المستوى الثاني', 'الفصل الثاني', 'active'),
    ('BA331', 'الإدارة الاستراتيجية', 'Strategic Management', 'إدارة الأعمال', 'المستوى الثالث', 'الفصل الأول', 'active'),
    ('ACC101', 'مبادئ المحاسبة', 'Principles of Accounting', 'المحاسبة', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('ACC201', 'المحاسبة المالية', 'Financial Accounting', 'المحاسبة', 'المستوى الثاني', 'الفصل الأول', 'active'),
    ('ACC301', 'المحاسبة الإدارية', 'Managerial Accounting', 'المحاسبة', 'المستوى الثالث', 'الفصل الثاني', 'active'),
    ('MKT101', 'مبادئ التسويق', 'Principles of Marketing', 'التسويق', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('MKT222', 'التسويق الرقمي', 'Digital Marketing', 'التسويق', 'المستوى الثاني', 'الفصل الثاني', 'active'),
    ('MKT315', 'سلوك المستهلك', 'Consumer Behavior', 'التسويق', 'المستوى الثالث', 'الفصل الأول', 'active'),
    ('ENG101', 'مهارات القراءة', 'Reading Skills', 'اللغة الإنجليزية', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('ENG102', 'مهارات الكتابة', 'Writing Skills', 'اللغة الإنجليزية', 'المستوى الأول', 'الفصل الثاني', 'active'),
    ('ENG203', 'الترجمة', 'Translation', 'اللغة الإنجليزية', 'المستوى الثاني', 'الفصل الثاني', 'active'),
    ('GD101', 'مبادئ التصميم', 'Design Principles', 'التصميم الجرافيكي', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('GD215', 'تصميم الهوية البصرية', 'Visual Identity Design', 'التصميم الجرافيكي', 'المستوى الثاني', 'الفصل الأول', 'active'),
    ('GD320', 'تصميم الإعلانات', 'Advertising Design', 'التصميم الجرافيكي', 'المستوى الثالث', 'الفصل الثاني', 'active'),
    ('NUR101', 'أساسيات التمريض', 'Fundamentals of Nursing', 'التمريض', 'المستوى الأول', 'الفصل الأول', 'active'),
    ('NUR221', 'تمريض الباطنة والجراحة', 'Medical Surgical Nursing', 'التمريض', 'المستوى الثاني', 'الفصل الثاني', 'active'),
    ('NUR331', 'صحة الأم والطفل', 'Maternal and Child Health', 'التمريض', 'المستوى الثالث', 'الفصل الأول', 'active')
),
updated as (
  update public.subjects subject
  set
    name_ar = seed.name_ar,
    name_en = seed.name_en,
    department = seed.department,
    level = seed.level,
    semester = seed.semester,
    status = seed.status,
    updated_at = now()
  from seed
  where subject.code = seed.code
  returning subject.code
)
insert into public.subjects (
  name_ar,
  name_en,
  code,
  department,
  level,
  semester,
  status
)
select
  seed.name_ar,
  seed.name_en,
  seed.code,
  seed.department,
  seed.level,
  seed.semester,
  seed.status
from seed
where not exists (
  select 1
  from public.subjects subject
  where subject.code = seed.code
);
