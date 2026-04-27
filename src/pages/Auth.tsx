import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";
import { useEffect } from "react";
import { GraduationCap } from "lucide-react";

const teacherLogin = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Nhập mật khẩu"),
});
const userLogin = z.object({
  login_id: z.string().trim().min(3, "Tối thiểu 3 ký tự").regex(/^[a-z0-9_]+$/i, "Chỉ chữ, số, _"),
  password: z.string().min(1, "Nhập mật khẩu"),
  role: z.enum(["student", "parent"]),
});
const teacherSignup = z.object({
  full_name: z.string().trim().min(1, "Nhập họ tên").max(100),
  tenant_name: z.string().trim().min(1, "Nhập tên lớp/trung tâm").max(100),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Tối thiểu 8 ký tự"),
  login_id: z.string().trim().min(3).regex(/^[a-z0-9_]+$/i, "Chỉ chữ, số, _"),
});

export default function AuthPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) nav("/", { replace: true });
  }, [user, loading, nav]);

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left: hero */}
      <div className="relative hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-foreground/10 font-display text-xl font-semibold">
            L
          </div>
          <span className="font-display text-xl">Lớp Học</span>
        </div>
        <div className="space-y-6">
          <h2 className="font-display text-4xl font-semibold leading-tight text-balance">
            Quản lý lớp học,<br />đơn giản như mở một quyển sổ.
          </h2>
          <p className="max-w-md text-primary-foreground/70">
            Điểm danh, giao bài tập, theo dõi học phí — tất cả trong một nơi
            được thiết kế riêng cho giáo viên dạy thêm.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/50">
          © {new Date().getFullYear()} Lớp Học
        </p>
      </div>

      {/* Right: forms */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="font-display text-xl font-semibold">Lớp Học</span>
            </div>
          </div>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Đăng nhập</TabsTrigger>
              <TabsTrigger value="signup">Đăng ký giáo viên</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <LoginCard />
            </TabsContent>
            <TabsContent value="signup">
              <SignupCard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function LoginCard() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"teacher" | "student" | "parent">("teacher");
  const [loading, setLoading] = useState(false);

  // teacher
  const [tEmail, setTEmail] = useState("");
  const [tPassword, setTPassword] = useState("");

  // student/parent
  const [loginId, setLoginId] = useState("");
  const [uPassword, setUPassword] = useState("");

  const handleTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = teacherLogin.safeParse({ email: tEmail, password: tPassword });
    if (!parsed.success) {
      toast({ title: "Lỗi", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Đăng nhập thất bại", description: error.message, variant: "destructive" });
      return;
    }
    nav("/");
  };

  const handleUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = userLogin.safeParse({
      login_id: loginId,
      password: uPassword,
      role: tab,
    });
    if (!parsed.success) {
      toast({ title: "Lỗi", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    // Resolve tenant_id from login_id + role (server-side, public function)
    const { data: resolved, error: resolveErr } = await supabase.functions.invoke(
      "resolve-login",
      { body: { login_id: parsed.data.login_id, role: parsed.data.role } },
    );
    if (resolveErr || (resolved as any)?.error || !(resolved as any)?.tenant_id) {
      setLoading(false);
      toast({
        title: "Đăng nhập thất bại",
        description: "Sai login ID hoặc mật khẩu",
        variant: "destructive",
      });
      return;
    }
    const tenantId = (resolved as any).tenant_id as number;
    const virtualEmail = `tnt${tenantId}_${parsed.data.role.slice(0, 3)}_${parsed.data.login_id.toLowerCase()}@app.local`;
    const { error } = await supabase.auth.signInWithPassword({
      email: virtualEmail,
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) {
      toast({
        title: "Đăng nhập thất bại",
        description: "Sai login ID hoặc mật khẩu",
        variant: "destructive",
      });
      return;
    }
    nav("/");
  };

  return (
    <Card className="mt-4 border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Đăng nhập</CardTitle>
        <CardDescription>Chọn vai trò để đăng nhập</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="teacher">Giáo viên</TabsTrigger>
            <TabsTrigger value="student">Học sinh</TabsTrigger>
            <TabsTrigger value="parent">Phụ huynh</TabsTrigger>
          </TabsList>

          <TabsContent value="teacher">
            <form className="mt-4 space-y-4" onSubmit={handleTeacher}>
              <div>
                <Label htmlFor="t-email">Email</Label>
                <Input
                  id="t-email"
                  type="email"
                  autoComplete="email"
                  value={tEmail}
                  onChange={(e) => setTEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="t-pass">Mật khẩu</Label>
                <Input
                  id="t-pass"
                  type="password"
                  autoComplete="current-password"
                  value={tPassword}
                  onChange={(e) => setTPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Đang đăng nhập…" : "Đăng nhập"}
              </Button>
            </form>
          </TabsContent>

          {(["student", "parent"] as const).map((r) => (
            <TabsContent key={r} value={r}>
              <form className="mt-4 space-y-4" onSubmit={handleUser}>
                <div>
                  <Label htmlFor={`${r}-login`}>Login ID</Label>
                  <Input
                    id={`${r}-login`}
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor={`${r}-pass`}>Mật khẩu</Label>
                  <Input
                    id={`${r}-pass`}
                    type="password"
                    autoComplete="current-password"
                    value={uPassword}
                    onChange={(e) => setUPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Đang đăng nhập…" : "Đăng nhập"}
                </Button>
              </form>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SignupCard() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    tenant_name: "",
    email: "",
    password: "",
    login_id: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = teacherSignup.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Lỗi", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("register-teacher", {
      body: parsed.data,
    });
    if (error || (data as any)?.error) {
      setLoading(false);
      const msg = (data as any)?.error
        ? typeof (data as any).error === "string"
          ? (data as any).error
          : "Dữ liệu không hợp lệ"
        : error?.message ?? "Lỗi không xác định";
      toast({ title: "Đăng ký thất bại", description: msg, variant: "destructive" });
      return;
    }
    // sign in luôn
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (signErr) {
      toast({ title: "Đã tạo tài khoản", description: "Vui lòng đăng nhập" });
      return;
    }
    toast({ title: "Chào mừng!", description: `Tenant của bạn đã sẵn sàng` });
    nav("/");
  };

  return (
    <Card className="mt-4 border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Đăng ký giáo viên</CardTitle>
        <CardDescription>
          Mỗi giáo viên = một không gian riêng (tenant). Học sinh & phụ huynh sẽ được bạn tạo sau.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="s-name">Họ và tên</Label>
            <Input id="s-name" value={form.full_name} onChange={set("full_name")} required maxLength={100} />
          </div>
          <div>
            <Label htmlFor="s-tenant">Tên lớp / trung tâm</Label>
            <Input
              id="s-tenant"
              value={form.tenant_name}
              onChange={set("tenant_name")}
              placeholder="vd: Lớp Toán cô Hương"
              required
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="s-email">Email</Label>
            <Input id="s-email" type="email" value={form.email} onChange={set("email")} required />
          </div>
          <div>
            <Label htmlFor="s-login">Login ID (cho hồ sơ)</Label>
            <Input
              id="s-login"
              value={form.login_id}
              onChange={set("login_id")}
              placeholder="vd: huong_gv"
              required
            />
          </div>
          <div>
            <Label htmlFor="s-pass">Mật khẩu (≥ 8 ký tự)</Label>
            <Input id="s-pass" type="password" value={form.password} onChange={set("password")} required minLength={8} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Đang tạo…" : "Tạo tài khoản & vào hệ thống"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Đã có tài khoản? <Link to="/auth" className="underline">Đăng nhập</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
