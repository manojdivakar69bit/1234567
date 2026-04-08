import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Shield, ScanLine, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";

const ADMIN_EMAIL = "manojdivakar69@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "Admin@123";

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "agent";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = role === "admin";
  const isSalesman = role === "salesman";
  const panelLabel = isAdmin ? "Admin" : isSalesman ? "Salesman" : "Agent";
  const redirectPath = isAdmin ? "/admin" : isSalesman ? "/salesman" : "/agent";

  const checkAgentApproval = async (userId: string) => {
    const { data } = await supabase
      .from("agents")
      .select("approval_status")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return "not_found";
    return data.approval_status;
  };

  const checkSalesmanStatus = async (userId: string) => {
    const { data } = await supabase
      .from("salesmen")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return "not_found";
    return data.status;
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const storedPwd = localStorage.getItem("cmf_admin_password") || DEFAULT_ADMIN_PASSWORD;
        if (email !== ADMIN_EMAIL || password !== storedPwd) {
          toast.error("Invalid admin credentials");
          return;
        }
        
        const { error } = await supabase.auth.signInWithPassword({ email, password: DEFAULT_ADMIN_PASSWORD });
        
        if (error) {
          const { error: signUpError } = await supabase.auth.signUp({ email, password: DEFAULT_ADMIN_PASSWORD });
          if (signUpError) {
            const { error: retryError } = await supabase.auth.signInWithPassword({ email, password });
            if (retryError) throw retryError;
          }
        }

        localStorage.setItem("cmf_role", "admin");
        localStorage.setItem("cmf_email", ADMIN_EMAIL);
        localStorage.setItem("cmf_admin_auth", "true");
        toast.success("Logged in as Admin");
        navigate(redirectPath);
      } else if (isSalesman) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const status = await checkSalesmanStatus(data.user.id);
        if (status === "not_found") {
          await supabase.auth.signOut();
          toast.error("Salesman profile not found. Contact admin.");
          return;
        }
        if (status !== "active") {
          await supabase.auth.signOut();
          toast.error("Your account is inactive. Contact admin.");
          return;
        }

        localStorage.setItem("cmf_role", "salesman");
        localStorage.setItem("cmf_email", data.user?.email || "");
        toast.success("Logged in as Salesman");
        navigate(redirectPath);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const status = await checkAgentApproval(data.user.id);
        if (status === "pending") {
          await supabase.auth.signOut();
          toast.error("Your account is pending admin approval");
          return;
        }
        if (status === "rejected") {
          await supabase.auth.signOut();
          toast.error("Your account has been rejected by admin");
          return;
        }
        if (status === "not_found") {
          await supabase.auth.signOut();
          toast.error("Agent profile not found. Contact admin to create your account.");
          return;
        }

        localStorage.setItem("cmf_role", role);
        localStorage.setItem("cmf_email", data.user?.email || "");
        toast.success(`Logged in as ${panelLabel}`);
        navigate(redirectPath);
      }
    } catch (error: any) {
      toast.error(error.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const iconMap: Record<string, React.ReactNode> = {
    admin: <Shield className="mx-auto mb-2 text-primary" size={40} />,
    agent: <ScanLine className="mx-auto mb-2 text-primary" size={40} />,
    salesman: <UserCheck className="mx-auto mb-2 text-primary" size={40} />,
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md card-shadow">
        <CardHeader className="text-center">
          {iconMap[role] || iconMap.agent}
          <CardTitle className="text-xl">{panelLabel} Login</CardTitle>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Admin access only" : `Sign in to access the ${panelLabel} Panel`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} /></div>
          <Button className="w-full emergency-gradient hover:opacity-90 text-primary-foreground" onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
          <Button asChild variant="ghost" className="w-full"><Link to="/"><ArrowLeft className="mr-2" size={16} />Back</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
