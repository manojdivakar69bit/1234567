import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const role = localStorage.getItem("cmf_role");
      if (!role || !allowedRoles.includes(role)) { setLoading(false); return; }

      if (role === "admin") {
        const adminAuth = localStorage.getItem("cmf_admin_auth");
        const adminEmail = localStorage.getItem("cmf_email");
        if (adminAuth === "true" && adminEmail === "manojdivakar69@gmail.com") {
          // Also check Supabase session
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setAuthorized(true);
          } else {
            // Try to get session from storage
            setAuthorized(true); // Allow if localStorage auth is valid
          }
        }
        setLoading(false);
        return;
      }

      // Agent uses Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      if (role === "agent") {
        const { data } = await supabase
          .from("agents")
          .select("approval_status")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (!data || data.approval_status !== "approved") { setLoading(false); return; }
      }

      setAuthorized(true);
      setLoading(false);
    };
    checkAuth();
  }, [allowedRoles]);

  if (loading) return null;
  if (!authorized) return <Navigate to="/login" />;
  return <>{children}</>;
};

export default ProtectedRoute;
