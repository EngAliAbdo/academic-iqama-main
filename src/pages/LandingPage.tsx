import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap, Shield, BarChart3, Upload, Clock, CheckCircle2,
  Users, FileText, ChevronLeft, Star, ArrowLeft, Moon, Sun
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const features = [
  { icon: Upload, title: "تسليم رقمي آمن", desc: "رفع التكليفات بسهولة مع دعم صيغ متعددة وتتبع فوري للحالة" },
  { icon: Shield, title: "تحقق من الأصالة", desc: "فحص ذكي للتكليفات مع تقارير مفصلة عن نسبة الأصالة" },
  { icon: Clock, title: "تقييم أسرع", desc: "تبسيط سير عمل المراجعة والتقييم مع أدوات متقدمة للمعلمين" },
  { icon: BarChart3, title: "تحليلات شاملة", desc: "لوحات بيانات تفاعلية وتقارير مفصلة لدعم اتخاذ القرار" },
  { icon: Users, title: "إدارة مركزية", desc: "نظام متكامل لإدارة المستخدمين والأدوار والصلاحيات" },
  { icon: FileText, title: "أرشيف أكاديمي", desc: "حفظ وتوثيق جميع التكليفات والتقييمات بشكل منظم" },
];

const roles = [
  { icon: GraduationCap, title: "الطالب", desc: "رفع التكليفات، تتبع الحالة، استعراض الدرجات والتقييمات", link: "/student" },
  { icon: Users, title: "المعلم", desc: "إنشاء التكليفات، مراجعة التسليمات، التحقق من الأصالة والتقييم", link: "/teacher" },
  { icon: Shield, title: "المسؤول", desc: "إدارة المستخدمين، مراقبة النظام، التقارير والإعدادات", link: "/admin" },
];

const steps = [
  { num: "١", title: "إنشاء التكليف", desc: "يقوم المعلم بإنشاء التكليف وتحديد التعليمات والمواعيد" },
  { num: "٢", title: "رفع التسليم", desc: "يقوم الطالب برفع التكليف بالصيغة المطلوبة" },
  { num: "٣", title: "فحص الأصالة", desc: "يتم فحص التكليف تلقائياً للتحقق من الأصالة" },
  { num: "٤", title: "المراجعة والتقييم", desc: "يراجع المعلم التسليم ويضع التقييم والملاحظات" },
];

const stats = [
  { value: "١,٤٢٨", label: "تسليم مكتمل" },
  { value: "٨٧٪", label: "متوسط الأصالة" },
  { value: "٣.٢", label: "يوم متوسط المراجعة" },
  { value: "٩٨٪", label: "رضا المستخدمين" },
];

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="rounded-xl bg-primary p-2">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">نظام التحقق الذكي</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="تبديل الوضع">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link to="/login">
              <Button variant="ghost" size="sm">تسجيل الدخول</Button>
            </Link>
            <Link to="/login">
              <Button size="sm">طلب تجربة</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="max-w-5xl mx-auto px-6 py-24 lg:py-36 text-center relative">
          <motion.div {...fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary mb-6">
              <Star className="h-3.5 w-3.5" />
              منصة أكاديمية متكاملة
            </span>
          </motion.div>
          <motion.h1 {...fadeUp} transition={{ delay: 0.1 }} className="text-display font-extrabold leading-tight mb-6">
            نظام التحقق الذكي
            <br />
            <span className="text-primary">لتعزيز النزاهة الأكاديمية</span>
          </motion.h1>
          <motion.p {...fadeUp} transition={{ delay: 0.2 }} className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            منصة أكاديمية شاملة تربط بين الطلاب والمعلمين والإدارة لتبسيط سير العمل الأكاديمي وضمان جودة التكليفات الدراسية
          </motion.p>
          <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/login">
              <Button size="lg" className="rounded-xl px-8 shadow-button">
                تسجيل الدخول
                <ArrowLeft className="h-4 w-4 mr-2" />
              </Button>
            </Link>
            <Link to="/student">
              <Button variant="outline" size="lg" className="rounded-xl px-8">
                تعرف على النظام
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-6 -mt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-2xl p-6 text-center shadow-card"
            >
              <p className="text-h2 font-bold text-primary tabular-nums">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-h1 font-bold mb-4">مميزات النظام</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">أدوات متقدمة لتحسين جودة العملية الأكاديمية وضمان النزاهة</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className="rounded-xl bg-primary/10 p-3 w-fit mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-h3 font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="bg-card border-y border-border">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-h1 font-bold mb-4">مصمم لكل الأدوار</h2>
            <p className="text-muted-foreground">تجربة مخصصة لكل مستخدم في المنظومة الأكاديمية</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {roles.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link to={r.link} className="block bg-background rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5 group">
                  <div className="rounded-xl bg-primary/10 p-3 w-fit mb-4">
                    <r.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-h3 font-semibold mb-2">{r.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{r.desc}</p>
                  <span className="text-sm text-primary font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                    استكشف البوابة <ChevronLeft className="h-4 w-4" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-h1 font-bold mb-4">سير العمل</h2>
          <p className="text-muted-foreground">أربع خطوات بسيطة لإتمام دورة التكليف الأكاديمي</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-primary-foreground">{s.num}</span>
              </div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="bg-primary rounded-3xl p-12 text-center text-primary-foreground">
          <h2 className="text-h1 font-bold mb-4">ابدأ في تعزيز النزاهة الأكاديمية اليوم</h2>
          <p className="text-primary-foreground/80 max-w-lg mx-auto mb-8">انضم إلى المؤسسات الأكاديمية التي تستخدم نظام التحقق الذكي</p>
          <Link to="/login">
            <Button size="lg" variant="secondary" className="rounded-xl px-8">
              ابدأ الآن
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-primary p-2">
                <GraduationCap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold">نظام التحقق الذكي من التكاليف الدراسية</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>عن النظام</span>
              <span>الخصوصية</span>
              <span>تواصل معنا</span>
            </div>
            <p className="text-xs text-muted-foreground">© ٢٠٢٦ جميع الحقوق محفوظة</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
