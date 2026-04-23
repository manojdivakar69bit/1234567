import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Users, Trash2, LogOut, Settings, 
  UserCheck, UserPlus, Lock, IndianRupee, KeyRound
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BulkStickerPrintCard from "@/components/BulkStickerPrintCard";
import PrintHistoryCard from "@/components/PrintHistoryCard";
import UpiPaymentScreen from "@/components/UpiPaymentScreen";
import CommissionTracker from "@/components/CommissionTracker";

// Helper: expiry date calculate karo
const calcExpiresAt = (validity: string): string | null => {
  const now = new Date();
  if (validity === "6month") {
    now.setMonth(now.getMonth() + 6);
    return now.toISOString();
  } else if (validity === "1year") {
    now.setFullYear(now.getFullYear() + 1);
    return now.toISOString();
  } else if (validity === "5year") {
    now.setFullYear(now.getFullYear() + 5);
    return now.toISOString();
  } else if (validity === "lifetime") {
    return null;
  }
  return null;
};

// Helper: age text
const getAgeText = (activated_at: string) => {
  const days = Math.floor((Date.now() - new Date(activated_at).getTime()) / 86400000);
  if (days === 0) return { text: "Today", color: "text-green-600" };
  if (days === 1) return { text: "1 day", color: "text-blue-600" };
  if (days <= 30) return { text: `${days} days`, color: "text-blue-600" };
  if (days <= 365) return { text: `${Math.floor(days / 30)} months`, color: "text-orange-600" };
  return { text: `${Math.floor(days / 365)} yr ${Math.floor((days % 365) / 30)} mo`, color: "text-red-600" };
};

// Helper: row ka background color
const getRowBg = (q: any) => {
  if (q.status !== "activated") return "";
  if (!q.expires_at && q.validity !== "lifetime") return "";
  if (q.validity === "lifetime") return "";
  const now = new Date();
  const exp = new Date(q.expires_at);
  const daysLeft = Math.floor((exp.getTime() - now.getTime()) / 86400000);
  if (daysLeft < 0) return "bg-red-50 border-red-200"; // Expired
  if (daysLeft <= 30) return "bg-orange-50 border-orange-200"; // Expiring soon
  return "";
};

const AdminPanel = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [qrCount, setQrCount] = useState(10);
  const [settingsForm, setSettingsForm] = useState({ qr_price: "", agent_commission: "", salesman_commission: "" });
  const [assignFrom, setAssignFrom] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [assignAgentId, setAssignAgentId] = useState("");
  const [isProcessing, setIsProcessing] = useState(null);
  const [agentForm, setAgentForm] = useState({ name: "", phone: "", email: "", password: "", upi_id: "", bank: "", acc: "", ifsc: "" });
  const [salesmanForm, setSalesmanForm] = useState({ name: "", phone: "", email: "", password: "", upi_id: "", bank: "", acc: "", ifsc: "" });

  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [adminPwdForm, setAdminPwdForm] = useState({ current: "", newPwd: "", confirm: "" });

  // --- QUERIES ---
  const { data: qrCodes = [] } = useQuery({
    queryKey: ["qr_codes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("qr_codes").select("*, agents(name)").order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: salesmen = [] } = useQuery({
    queryKey: ["salesmen"],
    queryFn: async () => {
      const { data, error } = await supabase.from("salesmen").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["all_payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      return data;
    }
  });

  const { data: printHistory = [] } = useQuery({
    queryKey: ["print_history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("print_history").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (appSettings && appSettings.length > 0) {
      const map: any = {};
      appSettings.forEach((s: any) => { map[s.key] = s.value; });
      setSettingsForm({
        qr_price: map.qr_price || "70",
        agent_commission: map.agent_commission || "5",
        salesman_commission: map.salesman_commission || "15",
      });
    }
  }, [appSettings.length]);

  const qrPrice = Number(settingsForm.qr_price) || 0;
  const agentComm = Number(settingsForm.agent_commission) || 0;
  const salesmanComm = Number(settingsForm.salesman_commission) || 0;
  const adminShare = qrPrice - agentComm - salesmanComm;
  const approvedAgents = agents.filter((a: any) => a.approval_status === "approved");

  // Expired QRs count
  const expiredCount = qrCodes.filter((q: any) => {
    if (q.status !== "activated" || q.validity === "lifetime" || !q.expires_at) return false;
    return new Date(q.expires_at) < new Date();
  }).length;

  const expiringSoonCount = qrCodes.filter((q: any) => {
    if (q.status !== "activated" || q.validity === "lifetime" || !q.expires_at) return false;
    const daysLeft = Math.floor((new Date(q.expires_at).getTime() - Date.now()) / 86400000);
    return daysLeft >= 0 && daysLeft <= 30;
  }).length;

  // --- MUTATIONS ---
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const keys = ["qr_price", "agent_commission", "salesman_commission"] as const;
      for (const key of keys) {
        const { error } = await supabase.from("app_settings").upsert({ key, value: settingsForm[key] }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Settings Saved!");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const resetUserPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      if (!newPassword || newPassword.length < 6) throw new Error("Password must be at least 6 characters");
      const { error } = await supabase.functions.invoke("reset-user-password", {
        body: { user_id: userId, new_password: newPassword },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setResetPasswords({});
      toast.success("Password Reset Successfully!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const changeAdminPasswordMutation = useMutation({
    mutationFn: async () => {
      if (adminPwdForm.newPwd !== adminPwdForm.confirm) throw new Error("Passwords do not match");
      if (adminPwdForm.newPwd.length < 6) throw new Error("Password must be at least 6 characters");
      const { error } = await supabase.auth.updateUser({ password: adminPwdForm.newPwd });
      if (error) throw error;
    },
    onSuccess: () => {
      setAdminPwdForm({ current: "", newPwd: "", confirm: "" });
      toast.success("Admin Password Changed!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addAgentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("create-agent", { 
        body: { 
          name: agentForm.name,
          phone: agentForm.phone,
          email: agentForm.email,
          password: agentForm.password,
          upi_id: agentForm.upi_id || null,
          bank_name: agentForm.bank || null,
          account_number: agentForm.acc || null,
          ifsc_code: agentForm.ifsc || null,
        } 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setAgentForm({ name: "", phone: "", email: "", password: "", upi_id: "", bank: "", acc: "", ifsc: "" });
      toast.success("Agent Registered!");
    },
    onError: (err: any) => toast.error(err.message || "Agent registration failed"),
  });

  const addSalesmanMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("create-salesman", { 
        body: { 
          name: salesmanForm.name,
          phone: salesmanForm.phone,
          email: salesmanForm.email,
          password: salesmanForm.password,
          upi_id: salesmanForm.upi_id || null,
          bank_name: salesmanForm.bank || null,
          account_number: salesmanForm.acc || null,
          ifsc_code: salesmanForm.ifsc || null,
        } 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesmen"] });
      setSalesmanForm({ name: "", phone: "", email: "", password: "", upi_id: "", bank: "", acc: "", ifsc: "" });
      toast.success("Salesman Registered!");
    },
    onError: (err: any) => toast.error(err.message || "Salesman registration failed"),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string, type: 'agent' | 'salesman' }) => {
      const table = type === 'agent' ? 'agents' : 'salesmen';
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: [v.type === 'agent' ? "agents" : "salesmen"] });
      toast.success("User Deleted");
    }
  });

  const generateQrMutation = useMutation({
    mutationFn: async (count: number) => {
      const { data: existing } = await supabase.from("qr_codes").select("code").order("code", { ascending: false }).limit(1);
      let maxNum = 0;
      if (existing?.length > 0) {
        const match = existing[0].code.match(/EMR-(\d+)/);
        if (match) maxNum = parseInt(match[1], 10);
      }
      const newCodes = Array.from({ length: count }, (_, i) => ({
        code: `EMR-${String(maxNum + i + 1).padStart(5, "0")}`,
        status: "available"
      }));
      await supabase.from("qr_codes").insert(newCodes);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["qr_codes"] }); toast.success("QR Generated!"); },
  });

  const rangeActionMutation = useMutation({
    mutationFn: async (action: "assign" | "unassign") => {
      const { data: codes } = await supabase.from("qr_codes").select("id").gte("code", assignFrom.toUpperCase()).lte("code", assignTo.toUpperCase());
      if (!codes?.length) throw new Error("Range error");
      const ids = codes.map(q => q.id);
      const update = action === "assign" ? { assigned_agent_id: assignAgentId, status: "assigned" } : { assigned_agent_id: null, status: "available" };
      await supabase.from("qr_codes").update(update).in("id", ids);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["qr_codes"] }); toast.success("Range Updated!"); }
  });

  const deletePrintHistoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("print_history").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print_history"] });
      toast.success("Record Deleted!");
    },
    onError: () => toast.error("Delete failed"),
  });

  const clearAllPrintHistoryMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("print_history").delete().neq("id", "");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print_history"] });
      toast.success("All History Cleared!");
    },
    onError: () => toast.error("Clear all failed"),
  });

  const handleLogout = () => { supabase.auth.signOut(); localStorage.clear(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-7xl mx-auto space-y-6 text-sm">

      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-1">
          <img src="/logo.png" alt="Logo" className="w-50 h-50 object-contain" />
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <Settings className="text-blue-600" />ADMIN
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="border-red-200 text-red-600 hover:bg-red-50">
          <LogOut size={16} className="mr-2"/> LOGOUT
        </Button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-blue-600 shadow-sm">
          <div className="text-2xl font-bold">{qrCodes.length}</div>
          <div className="text-xs text-muted-foreground uppercase font-bold">Total QR</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-green-600 shadow-sm">
          <div className="text-2xl font-bold text-green-600">{qrCodes.filter((q: any) => q.status === 'available').length}</div>
          <div className="text-xs text-muted-foreground uppercase font-bold">Available</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-purple-600 shadow-sm">
          <div className="text-2xl font-bold text-purple-600">{qrCodes.filter((q: any) => q.status === 'activated').length}</div>
          <div className="text-xs text-muted-foreground uppercase font-bold">Activated</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-orange-500 shadow-sm bg-orange-50/30">
          <div className="text-2xl font-black text-orange-700">₹{allPayments.reduce((acc: number, p: any) => acc + Number(p.amount), 0)}</div>
          <div className="text-xs text-orange-900 uppercase font-bold">Total Collection</div>
        </Card>
      </div>

      {/* EXPIRY ALERTS */}
      {(expiredCount > 0 || expiringSoonCount > 0) && (
        <div className="flex flex-col gap-2">
          {expiredCount > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-2 text-red-700 font-semibold text-xs flex items-center gap-2">
              ⚠ {expiredCount} QR code{expiredCount > 1 ? "s" : ""} expired — automatically deactivate ho jayenge raat 12 baje
            </div>
          )}
          {expiringSoonCount > 0 && (
            <div className="bg-orange-50 border border-orange-300 rounded-lg px-4 py-2 text-orange-700 font-semibold text-xs flex items-center gap-2">
              🕐 {expiringSoonCount} QR code{expiringSoonCount > 1 ? "s" : ""} 30 din mein expire hone wale hain
            </div>
          )}
        </div>
      )}

      {/* PAYMENT HISTORY */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-100/50 py-3 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <IndianRupee size={18} className="text-green-600"/> All Transactions
          </CardTitle>
          <Badge variant="secondary">{allPayments.length} Payments</Badge>
        </CardHeader>
        <CardContent className="p-0 max-h-80 overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 sticky top-0">
              <tr><th className="p-3">Customer</th><th className="p-3">Amount</th><th className="p-3">Role</th><th className="p-3 text-right">Date</th></tr>
            </thead>
            <tbody>
              {allPayments.map((p: any) => (
                <tr key={p.id} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-semibold">{p.customer_name || "Direct"}</td>
                  <td className="p-3 font-mono font-bold text-blue-600">₹{p.amount}</td>
                  <td className="p-3"><Badge className="text-[9px]">{p.collected_by_role?.toUpperCase() || 'USER'}</Badge></td>
                  <td className="p-3 text-right text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleString('en-IN')}</td>
                </tr>
              ))}
              {allPayments.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-slate-400">No payments yet</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* AGENTS & SALESMEN LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 py-3 border-b"><CardTitle className="text-sm font-bold flex items-center gap-2"><Users size={16}/> Agents List</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-60 overflow-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-[10px] uppercase">
                <tr><th className="p-3">Name</th><th className="p-3">Reset Pwd</th><th className="p-3 text-center">Del</th></tr>
              </thead>
              <tbody>
                {approvedAgents.map((a: any) => (
                  <tr key={a.id} className="border-b">
                    <td className="p-3 font-medium">{a.name}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Input placeholder="New Pwd" type="password" className="h-8 text-xs w-24"
                          value={resetPasswords[a.id] || ""}
                          onChange={e => setResetPasswords({...resetPasswords, [a.id]: e.target.value})}
                        />
                        <Button size="sm" variant="secondary" className="h-8 px-2"
                          onClick={() => resetUserPasswordMutation.mutate({ userId: a.user_id, newPassword: resetPasswords[a.id] })}>
                          <Lock size={12}/>
                        </Button>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <Button variant="ghost" size="sm" className="text-red-500 h-8 p-0"
                        onClick={() => { if(confirm("Delete Agent?")) deleteUserMutation.mutate({id: a.id, type: 'agent'}) }}>
                        <Trash2 size={16}/>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 py-3 border-b"><CardTitle className="text-sm font-bold flex items-center gap-2"><UserCheck size={16}/> Salesmen List</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-60 overflow-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-[10px] uppercase">
                <tr><th className="p-3">Name</th><th className="p-3">Reset Pwd</th><th className="p-3 text-center">Del</th></tr>
              </thead>
              <tbody>
                {salesmen.map((s: any) => (
                  <tr key={s.id} className="border-b">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Input placeholder="New Pwd" type="password" className="h-8 text-xs w-24"
                          value={resetPasswords[s.id] || ""}
                          onChange={e => setResetPasswords({...resetPasswords, [s.id]: e.target.value})}
                        />
                        <Button size="sm" variant="secondary" className="h-8 px-2"
                          onClick={() => resetUserPasswordMutation.mutate({ userId: s.user_id, newPassword: resetPasswords[s.id] })}>
                          <Lock size={12}/>
                        </Button>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <Button variant="ghost" size="sm" className="text-red-500 h-8 p-0"
                        onClick={() => { if(confirm("Delete Salesman?")) deleteUserMutation.mutate({id: s.id, type: 'salesman'}) }}>
                        <Trash2 size={16}/>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* REGISTRATION FORMS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <Card className="border-blue-100 shadow-sm">
          <CardHeader className="py-3 bg-blue-50/50 border-b">
            <CardTitle className="text-sm flex items-center gap-2"><UserPlus size={16}/> New Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Name *" value={agentForm.name} onChange={e=>setAgentForm({...agentForm, name: e.target.value})} />
              <Input placeholder="Email *" value={agentForm.email} onChange={e=>setAgentForm({...agentForm, email: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Phone *" value={agentForm.phone} onChange={e=>setAgentForm({...agentForm, phone: e.target.value})} />
              <Input placeholder="Password *" type="password" value={agentForm.password} onChange={e=>setAgentForm({...agentForm, password: e.target.value})} />
            </div>
            <Input placeholder="UPI ID (e.g. name@upi)" value={agentForm.upi_id} onChange={e=>setAgentForm({...agentForm, upi_id: e.target.value})} />
            <div className="p-2 border rounded bg-slate-50/50 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Bank Details (Optional)</p>
              <Input placeholder="Bank Name" value={agentForm.bank} onChange={e=>setAgentForm({...agentForm, bank: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Account No" value={agentForm.acc} onChange={e=>setAgentForm({...agentForm, acc: e.target.value})} />
                <Input placeholder="IFSC" value={agentForm.ifsc} onChange={e=>setAgentForm({...agentForm, ifsc: e.target.value})} />
              </div>
            </div>
            <Button onClick={() => addAgentMutation.mutate()} disabled={addAgentMutation.isPending} className="w-full">
              {addAgentMutation.isPending ? "Registering..." : "Register Agent"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-purple-100 shadow-sm">
          <CardHeader className="py-3 bg-purple-50/50 border-b">
            <CardTitle className="text-sm flex items-center gap-2"><UserPlus size={16}/> New Salesman</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Name *" value={salesmanForm.name} onChange={e=>setSalesmanForm({...salesmanForm, name: e.target.value})} />
              <Input placeholder="Email *" value={salesmanForm.email} onChange={e=>setSalesmanForm({...salesmanForm, email: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Phone *" value={salesmanForm.phone} onChange={e=>setSalesmanForm({...salesmanForm, phone: e.target.value})} />
              <Input placeholder="Password *" type="password" value={salesmanForm.password} onChange={e=>setSalesmanForm({...salesmanForm, password: e.target.value})} />
            </div>
            <Input placeholder="UPI ID (e.g. name@upi)" value={salesmanForm.upi_id} onChange={e=>setSalesmanForm({...salesmanForm, upi_id: e.target.value})} />
            <div className="p-2 border rounded bg-slate-50/50 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Bank Details (Optional)</p>
              <Input placeholder="Bank Name" value={salesmanForm.bank} onChange={e=>setSalesmanForm({...salesmanForm, bank: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Account No" value={salesmanForm.acc} onChange={e=>setSalesmanForm({...salesmanForm, acc: e.target.value})} />
                <Input placeholder="IFSC" value={salesmanForm.ifsc} onChange={e=>setSalesmanForm({...salesmanForm, ifsc: e.target.value})} />
              </div>
            </div>
            <Button onClick={() => addSalesmanMutation.mutate()} disabled={addSalesmanMutation.isPending} variant="secondary" className="w-full">
              {addSalesmanMutation.isPending ? "Registering..." : "Register Salesman"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* QR TOOLS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="py-3 bg-slate-50"><CardTitle className="text-sm">Batch QR Generate</CardTitle></CardHeader>
          <CardContent className="flex gap-2 pt-4">
            <Input type="number" value={qrCount} onChange={e => setQrCount(Number(e.target.value))} />
            <Button onClick={() => generateQrMutation.mutate(qrCount)}>Generate</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 bg-slate-50"><CardTitle className="text-sm">Range Assign to Agent</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="From (EMR-00001)" value={assignFrom} onChange={e => setAssignFrom(e.target.value)} />
              <Input placeholder="To (EMR-00010)" value={assignTo} onChange={e => setAssignTo(e.target.value)} />
            </div>
            <Select value={assignAgentId} onValueChange={setAssignAgentId}>
              <SelectTrigger><SelectValue placeholder="Select Agent" /></SelectTrigger>
              <SelectContent>{approvedAgents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button onClick={() => rangeActionMutation.mutate("assign")} className="flex-1">Assign</Button>
              <Button onClick={() => rangeActionMutation.mutate("unassign")} variant="outline" className="flex-1">Unassign</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GENERATED QR LIST */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 py-3 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold">Generated QR Codes</CardTitle>
          <div className="flex items-center gap-2">
            {expiredCount > 0 && <Badge className="bg-red-100 text-red-700 border-red-300 text-[10px]">⚠ {expiredCount} Expired</Badge>}
            {expiringSoonCount > 0 && <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-[10px]">🕐 {expiringSoonCount} Expiring</Badge>}
            <Badge variant="secondary">{qrCodes.length} Total</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-72 overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] uppercase sticky top-0">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Status</th>
                <th className="p-3">Agent</th>
                <th className="p-3">Activated</th>
                <th className="p-3">Validity</th>
                <th className="p-3">Expires</th>
                <th className="p-3">Age</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {qrCodes.map((q: any) => {
                const rowBg = getRowBg(q);
                const isExpired = q.expires_at && q.validity !== "lifetime" && new Date(q.expires_at) < new Date();
                const daysLeft = q.expires_at && q.validity !== "lifetime"
                  ? Math.floor((new Date(q.expires_at).getTime() - Date.now()) / 86400000)
                  : null;

                return (
                  <tr key={q.id} className={`border-b hover:brightness-95 ${rowBg}`}>
                    <td className="p-3 font-mono font-bold">{q.code}</td>
                    <td className="p-3">
                      <Badge variant={q.status === 'activated' ? 'default' : q.status === 'assigned' ? 'secondary' : 'outline'}>
                        {q.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{q.agents?.name || '—'}</td>

                    {/* Activation Date */}
                    <td className="p-3 text-xs text-muted-foreground">
                      {q.activated_at
                        ? new Date(q.activated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>

                    {/* Validity Badge */}
                    <td className="p-3">
                      {q.validity ? (
                        <Badge variant="outline" className={
                          q.validity === 'lifetime' ? 'border-purple-400 text-purple-700' :
                          q.validity === '5year' ? 'border-blue-400 text-blue-700' :
                          q.validity === '1year' ? 'border-green-400 text-green-700' :
                          'border-orange-400 text-orange-700'
                        }>
                          {q.validity === '6month' ? '6 Months' :
                           q.validity === '1year' ? '1 Year' :
                           q.validity === '5year' ? '5 Years' :
                           q.validity === 'lifetime' ? '♾ Lifetime' : q.validity}
                        </Badge>
                      ) : '—'}
                    </td>

                    {/* Expiry */}
                    <td className="p-3 text-xs">
                      {q.validity === 'lifetime'
                        ? <span className="text-purple-600 font-semibold">Never</span>
                        : q.expires_at ? (
                          <span className={isExpired ? 'text-red-600 font-bold' : daysLeft !== null && daysLeft <= 30 ? 'text-orange-600 font-semibold' : 'text-slate-600'}>
                            {isExpired ? '⚠ Expired' : daysLeft !== null && daysLeft === 0 ? '⚠ Today' : new Date(q.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {!isExpired && daysLeft !== null && daysLeft <= 30 && daysLeft > 0 && (
                              <span className="block text-[10px] text-orange-500">{daysLeft}d left</span>
                            )}
                          </span>
                        ) : '—'}
                    </td>

                    {/* Age */}
                    <td className="p-3 text-xs font-semibold">
                      {q.activated_at ? (() => {
                        const { text, color } = getAgeText(q.activated_at);
                        return <span className={color}>{text}</span>;
                      })() : '—'}
                    </td>

                    {/* Action */}
                    <td className="p-3 text-center">
                      {q.status === 'activated' && (
                        <div className="flex flex-col gap-1 min-w-[110px]">
                          {/* Validity Change */}
                          <select
                            className="w-full text-[10px] border rounded px-1 py-0.5 text-slate-600 bg-white"
                            defaultValue=""
                            onChange={async (e) => {
                              const val = e.target.value;
                              if (!val) return;
                              const expires_at = calcExpiresAt(val);
                              const { error } = await supabase
                                .from("qr_codes")
                                .update({ validity: val, expires_at })
                                .eq("id", q.id);
                              if (error) toast.error("Update failed");
                              else {
                                queryClient.invalidateQueries({ queryKey: ["qr_codes"] });
                                toast.success("Validity updated!");
                              }
                              e.target.value = "";
                            }}
                          >
                            <option value="">Change Validity</option>
                            <option value="6month">6 Months</option>
                            <option value="1year">1 Year</option>
                            <option value="5year">5 Years</option>
                            <option value="lifetime">♾ Lifetime</option>
                          </select>

                            {/* Deactivate */}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isProcessing === q.id}
                              className="h-7 text-[10px] w-full border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              onClick={async () => {
                                if (!confirm(`Deactivate ${q.code}? Customer ka saara data erase ho jayega.`)) return;

                                setIsProcessing(q.id);
                                try {
                                  // 1. Dono tables se data delete karein
                                  await Promise.all([
                                    supabase.from("customers").delete().eq("qr_code_id", q.id),
                                    supabase.from("emergency_contacts").delete().eq("qr_code_id", q.id)
                                  ]);

                                  // 2. QR status reset karein
                                  const { error } = await supabase
                                    .from("qr_codes")
                                    .update({ 
                                      status: "available", 
                                      activated_at: null, 
                                      validity: null, 
                                      expires_at: null 
                                    })
                                    .eq("id", q.id);

                                  if (error) throw error;

                                  queryClient.invalidateQueries({ queryKey: ["qr_codes"] });
                                  toast.success(`${q.code} deactivated & data erased!`);
                                } catch (err) {
                                  console.error(err);
                                  toast.error("Deactivate failed!");
                                } finally {
                                  setIsProcessing(null);
                                }
                              }}
                            >
                              {isProcessing === q.id ? "Processing..." : "Deactivate"}
                            </Button>


        {/* Legend */}
        <div className="px-4 py-2 bg-slate-50 border-t flex gap-4 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block"/> Expired</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-300 inline-block"/> Expiring in 30 days</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block"/> Active</span>
        </div>
      </Card>

      {/* PRICING CONTROL */}
      <Card className="border-green-100 shadow-sm">
        <CardHeader className="py-3 bg-green-50/50 border-b">
          <CardTitle className="text-sm flex items-center gap-2"><IndianRupee size={16} className="text-green-600"/> Pricing & Commission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs font-bold">QR Price (₹)</Label><Input type="number" value={settingsForm.qr_price} onChange={e => setSettingsForm({ ...settingsForm, qr_price: e.target.value })} /></div>
            <div><Label className="text-xs font-bold">Agent Commission (₹)</Label><Input type="number" value={settingsForm.agent_commission} onChange={e => setSettingsForm({ ...settingsForm, agent_commission: e.target.value })} /></div>
            <div><Label className="text-xs font-bold">Salesman Commission (₹)</Label><Input type="number" value={settingsForm.salesman_commission} onChange={e => setSettingsForm({ ...settingsForm, salesman_commission: e.target.value })} /></div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border text-center font-mono">
            <span className="text-blue-700 font-bold">₹{qrPrice} Total</span> → <span className="text-orange-600">₹{agentComm} Agent</span> + <span className="text-purple-600">₹{salesmanComm} Salesman</span> + <span className="text-green-600 font-bold">₹{adminShare} You</span>
          </div>
          <Button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending} className="w-full bg-green-600 hover:bg-green-700">
            {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* ADMIN PASSWORD CHANGE */}
      <Card className="border-red-100 shadow-sm">
        <CardHeader className="py-3 bg-red-50/50 border-b">
          <CardTitle className="text-sm flex items-center gap-2"><KeyRound size={16} className="text-red-600"/> Change Admin Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-bold">New Password</Label>
              <Input type="password" placeholder="New Password" value={adminPwdForm.newPwd}
                onChange={e => setAdminPwdForm({...adminPwdForm, newPwd: e.target.value})} />
            </div>
            <div>
              <Label className="text-xs font-bold">Confirm Password</Label>
              <Input type="password" placeholder="Confirm Password" value={adminPwdForm.confirm}
                onChange={e => setAdminPwdForm({...adminPwdForm, confirm: e.target.value})} />
            </div>
            <div className="flex items-end">
              <Button onClick={() => changeAdminPasswordMutation.mutate()}
                disabled={!adminPwdForm.newPwd || !adminPwdForm.confirm || changeAdminPasswordMutation.isPending}
                className="w-full bg-red-600 hover:bg-red-700 text-white">
                <Lock size={14} className="mr-2"/>
                {changeAdminPasswordMutation.isPending ? "Changing..." : "Update Password"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UPI PAYMENT */}
      <UpiPaymentScreen
        onPaymentSubmit={async (data) => {
          const { error } = await supabase.from("payments").insert({
            amount: data.amount,
            payment_method: "upi",
            status: "utr_submitted",
            collected_by_role: "admin",
            customer_name: data.customerName,
            notes: `Phone: ${data.customerPhone} | UTR: ${data.utr} | Ref: ${data.orderRef}`,
          });
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ["all_payments"] });
        }}
      />

      {/* COMMISSION TRACKING */}
      <CommissionTracker />

      {/* BULK STICKER PRINT */}
      <BulkStickerPrintCard baseUrl={window.location.origin} printableCount={qrCodes.filter((q: any) => q.status !== 'activated').length} />

      {/* PRINT HISTORY */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 py-3 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold">Print History</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="text-red-500 border-red-200 h-7 text-xs hover:bg-red-50"
            onClick={() => { if(confirm("Delete all print history?")) clearAllPrintHistoryMutation.mutate(); }}
            disabled={clearAllPrintHistoryMutation.isPending || printHistory.length === 0}
          >
            Clear All
          </Button>
        </CardHeader>
        <CardContent className="p-0 max-h-72 overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] uppercase sticky top-0">
              <tr><th className="p-3">Details</th><th className="p-3">Count</th><th className="p-3">Date</th><th className="p-3 text-center">Del</th></tr>
            </thead>
            <tbody>
              {printHistory.map((h: any) => (
                <tr key={h.id} className="border-b hover:bg-slate-50">
                  <td className="p-3 text-xs">{h.details || h.range || "—"}</td>
                  <td className="p-3 font-mono font-bold">{h.count || "—"}</td>
                  <td className="p-3 text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleString('en-IN')}</td>
                  <td className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 h-7 p-0"
                      onClick={() => { if(confirm("Delete this record?")) deletePrintHistoryMutation.mutate(h.id); }}
                    >
                      <Trash2 size={14}/>
                    </Button>
                  </td>
                </tr>
              ))}
              {printHistory.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-400">No print history yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

    </div>
  );
};

export default AdminPanel;
