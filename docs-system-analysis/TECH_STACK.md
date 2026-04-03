# TECH_STACK

## طبيعة التطبيق
**مؤكد من `src/main.tsx` و`src/App.tsx`:**

- التطبيق عبارة عن **React Single-Page Application (SPA)**
- نقطة الدخول الأمامية: `index.html`
- bootstrap React: `src/main.tsx`
- التوجيه: `react-router-dom`

## لغات البرمجة المستخدمة فعليًا
| اللغة | أماكن الاستخدام المؤكدة |
|---|---|
| TypeScript | `src/*`, `supabase/functions/*` |
| JavaScript (MJS) | `scripts/*.mjs` |
| SQL | `supabase/migrations/*.sql`, `supabase/manual-deploy.sql` |
| CSS | `src/index.css`, `src/App.css` |
| HTML | `index.html` |
| Markdown | `README.md`, `docs/*`, `supabase/functions/*/README.md` |

## الأطر والمكتبات والأدوات
### واجهة المستخدم
| المكتبة/الأداة | الحالة | الملاحظات |
|---|---|---|
| `react`, `react-dom` | مستخدمة فعليًا | أساس الواجهة |
| `react-router-dom` | مستخدمة فعليًا | التنقل والحماية |
| `tailwindcss` | مستخدمة فعليًا | التنسيق |
| `shadcn/ui` + `@radix-ui/*` | مستخدمة فعليًا | عناصر UI |
| `lucide-react` | مستخدمة فعليًا | أيقونات |
| `recharts` | مستخدمة فعليًا | الرسوم البيانية |
| `sonner` | مستخدمة فعليًا | toast notifications |
| `framer-motion` | مستخدمة فعليًا | في `LandingPage.tsx` |

### إدارة الحالة
| الأداة | الحالة | الملاحظات |
|---|---|---|
| React Context | مستخدمة فعليًا | `AuthContext`, `AcademicDataContext`, `NotificationsContext` |
| `@tanstack/react-query` | مستخدمة جزئيًا | يوجد `QueryClientProvider` في `App.tsx`، لكن لم يُكتشف استخدام مباشر لـ `useQuery` أو `useMutation` |

### Forms / Validation
| الأداة | الحالة | الملاحظات |
|---|---|---|
| `react-hook-form` | غير مستخدم بوضوح في الصفحات | يوجد wrapper في `src/components/ui/form.tsx` |
| `zod` | غير مستخدم بوضوح في التدفق التشغيلي | dependency مثبتة، لكن الاستخدام الفعلي غير مؤكد |
| validation يدوي | مستخدم فعليًا | عبر handlers وشروط داخل الصفحات |

### Date / Time
| الأداة | الحالة |
|---|---|
| `date-fns` | مستخدمة فعليًا |
| `react-day-picker` | مستخدمة فعليًا |
| JavaScript `Date` API | مستخدمة فعليًا |

### جداول / مودالات / قوائم / رسائل
| الفئة | الأداة |
|---|---|
| جداول | shadcn table + markup مخصص |
| Dialogs / alerts | Radix dialog / alert-dialog |
| Select / dropdown | Radix select / dropdown-menu |
| Tabs | Radix tabs |
| Drawers | `vaul` + wrappers |
| Notifications | `sonner`, `toaster` |

## هل المشروع React SPA أو HTML مباشر؟
**مؤكد:** React SPA بالكامل، ولا توجد تطبيقات HTML منفصلة موازية.

## أدوات البناء والتشغيل
| الأداة | الدور |
|---|---|
| Vite | dev server + build |
| `@vitejs/plugin-react-swc` | دعم React عبر SWC |
| TypeScript | typing |
| ESLint | lint |
| Vitest | unit tests |
| Playwright | E2E/testing support |
| Tailwind CSS | styling |
| PostCSS | CSS pipeline |

## ملفات الإعدادات المهمة
| الملف | الوظيفة |
|---|---|
| `package.json` | dependencies + scripts |
| `vite.config.ts` | build/dev/chunks/env consistency |
| `vitest.config.ts` | test config |
| `tailwind.config.ts` | Tailwind config |
| `postcss.config.js` | PostCSS pipeline |
| `eslint.config.js` | lint rules |
| `tsconfig.json` / `tsconfig*.json` | TS config |
| `supabase/config.toml` | Supabase project/functions config |

## Routing libraries
- `react-router-dom`

## State management
- React Context
- component local state
- localStorage/sessionStorage

## UI framework
- Tailwind CSS
- shadcn/ui
- Radix UI

## Form libraries
- `react-hook-form` wrapper موجود
- الاستخدام التشغيلي الفعلي يعتمد غالبًا على controlled inputs

## Validation libraries
- `zod` مثبتة
- الاستخدام المؤكد في التدفق الحالي غير واضح

## Date libraries
- `date-fns`
- `react-day-picker`

## Charting / table / modal / notification libraries
| النوع | المكتبات |
|---|---|
| Charts | `recharts` |
| Tables | shadcn table |
| Modals | Radix dialog / alert-dialog |
| Notifications | `sonner` |
| Tooltip / popover | Radix |
| Drawer | `vaul` |

## SDKs الخاصة بـ Supabase أو AI أو خدمات أخرى
### Supabase
- `@supabase/supabase-js`

### AI
- لا توجد SDK خاصة بـ Gemini
- التكامل يتم عبر `fetch` مباشر داخل Edge Function

### خدمات أخرى
- Google Fonts (`Tajawal`) من `src/index.css`

## مكتبات متعلقة بالشبكات أو auth أو analytics أو monitoring
### مؤكد
- Supabase SDK يغطي auth/database/storage/functions/rpc
- `fetch` مباشر لنداء Gemini

### غير مكتشف
- Axios
- Interceptors network layer خارج Supabase
- Sentry / LogRocket / Datadog / GA

## اعتمادات خارجية مهمة
### مؤكدة
- Supabase
- Google Gemini
- Google Fonts

### غير مؤكدة
- لا يوجد backend خارجي إضافي واضح
- لا يوجد provider بريد إلكتروني خارجي واضح من الكود

## ملاحظات مهمة
1. هناك اعتماد تركيبي على `react-query` لكنه ليس طبقة البيانات الرئيسية.
2. معظم العمليات تمر عبر `src/lib/supabase-app.ts`.
3. التحليل الذكي مفصول تمامًا عن الواجهة، ويعيش داخل Edge Function.
4. وجود dependency لا يعني استخدامها فعليًا؛ بعض الحزم موجودة لدعم UI wrapper أو مراحل سابقة من التطوير.
