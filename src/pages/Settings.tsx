import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, KeyRound, Building2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useRole } from "@/features/auth/AuthProvider";
import { toast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { profile, user, refresh } = useAuth();
  const { isTeacher } = useRole();
  const qc = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const tenantQ = useQuery({
    queryKey: ["tenant", profile?.tenant_id],
    enabled: !!profile?.tenant_id && isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, timezone")
        .eq("id", profile!.tenant_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [tenantName, setTenantName] = useState("");
  const [savingTenant, setSavingTenant] = useState(false);
  useEffect(() => {
    if (tenantQ.data) setTenantName(tenantQ.data.name ?? "");
  }, [tenantQ.data]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone: phone || null })
        .eq("id", user.id);
      if (error) throw error;
      toast({ title: "Đã lưu thông tin cá nhân" });
      await refresh();
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveTenant = async () => {
    if (!profile?.tenant_id) return;
    setSavingTenant(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ name: tenantName })
        .eq("id", profile.tenant_id);
      if (error) throw error;
      toast({ title: "Đã lưu thông tin trung tâm" });
      qc.invalidateQueries({ queryKey: ["tenant"] });
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    } finally {
      setSavingTenant(false);
    }
  };

  const savePassword = async () => {
    if (pwd.length < 6) {
      toast({ title: "Mật khẩu tối thiểu 6 ký tự", variant: "destructive" });
      return;
    }
    if (pwd !== pwd2) {
      toast({ title: "Hai mật khẩu không khớp", variant: "destructive" });
      return;
    }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast({ title: "Đã đổi mật khẩu" });
      setPwd("");
      setPwd2("");
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div>
      <PageHeader title="Cài đặt" description="Quản lý thông tin cá nhân, trung tâm và bảo mật." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Thông tin cá nhân
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Tên đăng nhập</Label>
              <Input value={profile?.login_id ?? ""} disabled />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={profile?.email ?? ""} disabled />
            </div>
            <div>
              <Label>Họ tên</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>Số điện thoại</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button onClick={saveProfile} disabled={savingProfile}>
              <Save className="mr-2 h-4 w-4" /> Lưu
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" /> Đổi mật khẩu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Mật khẩu mới</Label>
              <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
            </div>
            <div>
              <Label>Nhập lại mật khẩu</Label>
              <Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
            </div>
            <Button onClick={savePassword} disabled={savingPwd}>
              <Save className="mr-2 h-4 w-4" /> Đổi mật khẩu
            </Button>
          </CardContent>
        </Card>

        {isTeacher && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> Trung tâm
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Tên trung tâm</Label>
                <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
              </div>
              <div>
                <Label>Múi giờ</Label>
                <Input value={tenantQ.data?.timezone ?? ""} disabled />
              </div>
              <Button onClick={saveTenant} disabled={savingTenant}>
                <Save className="mr-2 h-4 w-4" /> Lưu
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
