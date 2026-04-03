import { Link } from "react-router-dom";
import { BookOpen, Hash, KeyRound, Mail, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleLabel } from "@/lib/auth";

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-h1 font-bold">الملف الشخصي</h1>

      <div className="bg-card rounded-2xl shadow-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{user.fullName}</h2>
            <p className="text-sm text-muted-foreground">{user.roleTitle}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          {[
            { icon: Hash, label: "الرقم الأكاديمي", value: user.academicId },
            { icon: BookOpen, label: "القسم", value: user.department },
            { icon: Mail, label: "البريد", value: user.email },
            { icon: Shield, label: "الدور", value: getRoleLabel(user.role) },
          ].map((field) => (
            <div key={field.label} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
              <field.icon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{field.label}</p>
                <p className="font-medium">{field.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">إدارة كلمة المرور</h2>
            <p className="text-sm text-muted-foreground">يمكنك تحديث كلمة المرور من صفحة الأمان المخصصة.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link to="/change-password">
            <Button className="rounded-xl shadow-button">تغيير كلمة المرور</Button>
          </Link>
          <Link to="/settings">
            <Button variant="outline" className="rounded-xl">الذهاب إلى الإعدادات</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
