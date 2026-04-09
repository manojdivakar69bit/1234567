import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { QrCode, Users, Package, Plus, Trash2, LogOut, Settings, UserCheck, PowerOff, Eraser, KeyRound, UserPlus, Lock, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BulkStickerPrintCard from "@/components/BulkStickerPrintCard";
import PrintHistoryCard from "@/components/PrintHistoryCard";

const AdminPanel = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // --- ALL STATES ---
  const [qrCount, setQrCount] = useState(10);
  const [assignFrom, setAssignFrom] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [assignAgentId, setAssignAgentId] = useState("");
  const [agentForm, setAgentForm] = useState({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" });
  const [salesmanForm, setSalesmanForm] = useState({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" });
  const [pwdForm, setPwdForm] = useState({ current: "", new: "", confirm: "" });
  const [userResetData, setUserResetData] = useState({ id: "", newPwd: "" });

  // --- ALL QUERIES ---
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

  const approvedAgents = agents.filter((a: any) => a.approval_status === "approved");

  // --- ALL MUTATIONS ---
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["qr_codes"] }); toast.success("QR Codes Generated!"); },
  });

  const addAgentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("create-agent", { body: { ...agentForm, bank_name: agentForm.bank, account_number: agentForm.acc, ifsc_code: agentForm.ifsc } });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agents"] }); setAgentForm({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" }); toast.success("Agent Registered!"); }
  });

  const addSalesmanMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("create-salesman", { body: { ...salesmanForm, bank_name: salesmanForm.bank, account_number: salesmanForm.acc, ifsc_code: salesmanForm.ifsc } });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["salesmen"] }); setSalesmanForm({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" }); toast.success("Salesman Registered!"); }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string, type: 'agent' | 'salesman' }) => {
      const table = type === 'agent' ? 'agents' : 'salesmen';
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.type === 'agent' ? "agents" : "salesmen"] });
      toast.success("User Deleted Successfully");
    }
  });

  const resetUserPwdMutation = useMutation({
    mutationFn: async ({ id, newPassword, type }: any) => await supabase.functions.invoke("reset-user-password", { body: { userId: id, newPassword, type } }),
    onSuccess: () => { toast.success("Password Updated!"); setUserResetData({ id: "", newPwd: "" }); }
  });

  const rangeActionMutation = useMutation({
    mutationFn: async (action: "assign" | "unassign") => {
      const { data: codes } = await supabase.from("qr_codes").select("id").gte("code", assignFrom.toUpperCase()).lte("code", assignTo.toUpperCase());
      if (!codes?.length) throw new Error("Range not found");
      const ids = codes.map(q => q.id);
      const update = action === "assign" ? { assigned_agent_id: assignAgentId, status: "assigned" } : { assigned_agent_id: null, status: "available" };
      await supabase.from("qr_codes").update(update).in("id", ids);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["qr_codes"] }); toast.success("Range Updated!"); }
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => await supabase.from("print_history").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["print_history"] }); toast.success("History Cleared"); }
  });

  const handleAdminPasswordChange = () => {
    const stored = localStorage.getItem("cmf_admin_password") || "Admin@123";
    if (pwdForm.current !== stored) return toast.error("Current password wrong");
    if (pwdForm.new !== pwdForm.confirm) return toast.error("Mismatch");
    localStorage.setItem("cmf_admin_password", pwdForm.new);
    setPwdForm({ current: "", new: "", confirm: "" });
    toast.success("Admin Password Updated");
  };

  const handleLogout = () => { supabase.auth.signOut(); localStorage.clear(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-background p-4 max-w-7xl mx-auto space-y-6 text-sm">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-primary"/> ADMIN CONTROL</h1><Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="mr-2" size={16}/> Logout</Button></div>

      {/* STATS SECTION */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-blue-50/50 border-blue-200"><div className="text-2xl font-bold text-blue-600">{qrCodes.length}</div><div className="text-[10px] uppercase font-bold text-muted-foreground">Total QR Codes</div></Card>
        <Card className="p-4 bg-green-50/50 border-green-200"><div className="text-2xl font-bold text-green-600">{qrCodes.filter(q => q.status === 'available').length}</div><div className="text-[10px] uppercase font-bold text-muted-foreground">Available Stock</div></Card>
        <Card className="p-4 bg-purple-50/50 border-purple-200"><div className="text-2xl font-bold text-purple-600">{qrCodes.filter(q => q.status === 'activated').length}</div><div className="text-[10px] uppercase font-bold text-muted-foreground">Activated QRs</div></Card>
        <Card className="p-4 bg-orange-50/50 border-orange-200"><div className="text-2xl font-bold text-orange-600">₹{allPayments.reduce((s, p) => s + Number(p.amount), 0)}</div><div className="text-[10px] uppercase font-bold text-muted-foreground">Total Collection</div></Card>
      </div>

      {/* AGENT & SALESMAN MANAGEMENT TABLES (DELETION & RESET ADDED) */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="border-primary/20">
          <CardHeader className="bg-primary/5 py-3"><CardTitle className="text-base flex items-center gap-2"><Users size={18}/> Agent List & Control</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-64 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted text-[10px] uppercase sticky top-0">
                <tr><th className="p-3">Agent</th><th className="p-3">Bank Details</th><th className="p-3">Reset Password</th><th className="p-3 text-center">Action</th></tr>
              </thead>
              <tbody>
                {approvedAgents.map(a => (
                  <tr key={a.id} className="border-b hover:bg-muted/5">
                    <td className="p-3 font-medium">{a.name}<div className="text-[10px] text-muted-foreground">{a.email}</div></td>
                    <td className="p-3 text-[10px]">{a.bank_name}<br/>{a.account_number}<br/>{a.ifsc_code}</td>
                    <td className="p-3">
                      <div className="flex gap-1"><Input placeholder="New Pwd" type="password" className="h-7 text-[10px] w-24" onChange={e=>setUserResetData({id:a.id, newPwd:e.target.value})}/><Button size="sm" className="h-7 px-2" onClick={()=>resetUserPwdMutation.mutate({id:a.id, newPassword:userResetData.newPwd, type:'agent'})} disabled={!userResetData.newPwd || userResetData.id!==a.id}><Lock size={12}/></Button></div>
                    </td>
                    <td className="p-3 text-center">
                       <Button variant="ghost" size="sm" className="text-red-500 h-8 w-8 p-0" onClick={()=>{if(confirm("Permanent Delete?")) deleteUserMutation.mutate({id:a.id, type:'agent'})}}><Trash2 size={16}/></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-secondary/20">
          <CardHeader className="bg-secondary/5 py-3"><CardTitle className="text-base flex items-center gap-2"><UserCheck size={18}/> Salesman List & Control</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-64 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted text-[10px] uppercase sticky top-0">
                <tr><th className="p-3">Salesman</th><th className="p-3">Bank Details</th><th className="p-3">Reset Password</th><th className="p-3 text-center">Action</th></tr>
              </thead>
              <tbody>
                {salesmen.map(s => (
                  <tr key={s.id} className="border-b hover:bg-muted/5">
                    <td className="p-3 font-medium">{s.name}<Badge className="ml-2 text-[8px] h-3">{s.status}</Badge></td>
                    <td className="p-3 text-[10px]">{s.bank_name}<br/>{s.account_number}<br/>{s.ifsc_code}</td>
                    <td className="p-3">
                      <div className="flex gap-1"><Input placeholder="New Pwd" type="password" className="h-7 text-[10px] w-24" onChange={e=>setUserResetData({id:s.id, newPwd:e.target.value})}/><Button size="sm" variant="secondary" className="h-7 px-2" onClick={()=>resetUserPwdMutation.mutate({id:s.id, newPassword:userResetData.newPwd, type:'salesman'})} disabled={!userResetData.newPwd || userResetData.id!==s.id}><Lock size={12}/></Button></div>
                    </td>
                    <td className="p-3 text-center">
                       <Button variant="ghost" size="sm" className="text-red-500 h-8 w-8 p-0" onClick={()=>{if(confirm("Permanent Delete Salesman?")) deleteUserMutation.mutate({id:s.id, type:'salesman'})}}><Trash2 size={16}/></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* REGISTRATION FORMS (AGENT & SALESMAN) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-blue-200">
          <CardHeader className="py-3 bg-blue-50/30"><CardTitle className="text-base flex items-center gap-2"><UserPlus size={18}/> Add New Agent</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-2"><Input placeholder="Full Name" value={agentForm.name} onChange={e=>setAgentForm({...agentForm, name: e.target.value})} /><Input placeholder="Phone" value={agentForm.phone} onChange={e=>setAgentForm({...agentForm, phone: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-2"><Input placeholder="Email" value={agentForm.email} onChange={e=>setAgentForm({...agentForm, email: e.target.value})} /><Input placeholder="Password" type="password" value={agentForm.password} onChange={e=>setAgentForm({...agentForm, password: e.target.value})} /></div>
            <div className="p-2 border rounded bg-muted/20 space-y-2"><Label className="text-[10px] text-muted-foreground uppercase">Bank Info</Label><Input placeholder="Bank Name" value={agentForm.bank} onChange={e=>setAgentForm({...agentForm, bank: e.target.value})} /><div className="grid grid-cols-2 gap-2"><Input placeholder="Account No" value={agentForm.acc} onChange={e=>setAgentForm({...agentForm, acc: e.target.value})} /><Input placeholder="IFSC Code" value={agentForm.ifsc} onChange={e=>setAgentForm({...agentForm, ifsc: e.target.value})} /></div></div>
            <Button onClick={()=>addAgentMutation.mutate()} className="w-full">Register Agent</Button>
          </CardContent>
        </Card>
        <Card className="border-purple-200">
          <CardHeader className="py-3 bg-purple-50/30"><CardTitle className="text-base flex items-center gap-2"><UserPlus size={18}/> Add New Salesman</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-2"><Input placeholder="Full Name" value={salesmanForm.name} onChange={e=>setSalesmanForm({...salesmanForm, name: e.target.value})} /><Input placeholder="Phone" value={salesmanForm.phone} onChange={e=>setSalesmanForm({...salesmanForm, phone: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-2"><Input placeholder="Email" value={salesmanForm.email} onChange={e=>setSalesmanForm({...salesmanForm, email: e.target.value})} /><Input placeholder="Password" type="password" value={salesmanForm.password} onChange={e=>setSalesmanForm({...salesmanForm, password: e.target.value})} /></div>
            <div className="p-2 border rounded bg-muted/20 space-y-2"><Label className="text-[10px] text-muted-foreground uppercase">Bank Info</Label><Input placeholder="Bank Name" value={salesmanForm.bank} onChange={e=>setSalesmanForm({...salesmanForm, bank: e.target.value})} /><div className="grid grid-cols-2 gap-2"><Input placeholder="Account No" value={salesmanForm.acc} onChange={e=>setSalesmanForm({...salesmanForm, acc: e.target.value})} /><Input placeholder="IFSC Code" value={salesmanForm.ifsc} onChange={e=>setSalesmanForm({...salesmanForm, ifsc: e.target.value})} /></div></div>
            <Button onClick={()=>addSalesmanMutation.mutate()} className="w-full" variant="secondary">Register Salesman</Button>
          </CardContent>
        </Card>
      </div>

      {/* QR TOOLS (GENERATE & RANGE) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card><CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Plus size={18}/> Generate QR Codes</CardTitle></CardHeader>
          <CardContent className="flex gap-2"><Input type="number" value={qrCount} onChange={e => setQrCount(Number(e.target.value))} /><Button onClick={() => generateQrMutation.mutate(qrCount)}>Generate Now</Button></CardContent>
        </Card>
        <Card><CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Package size={18}/> QR Range Control</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2"><Input placeholder="From (EMR-00001)" value={assignFrom} onChange={e => setAssignFrom(e.target.value)} /><Input placeholder="To (EMR-00050)" value={assignTo} onChange={e => setAssignTo(e.target.value)} /></div>
            <Select value={assignAgentId} onValueChange={setAssignAgentId}><SelectTrigger><SelectValue placeholder="Select Agent to Assign" /></SelectTrigger><SelectContent>{approvedAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>
            <div className="flex gap-2"><Button onClick={() => rangeActionMutation.mutate("assign")} className="flex-1">Assign Range</Button><Button onClick={() => rangeActionMutation.mutate("unassign")} variant="outline" className="flex-1 text-red-500">Unassign Range</Button></div>
          </CardContent>
        </Card>
      </div>

      <BulkStickerPrintCard baseUrl={window.location.origin} printableCount={qrCodes.filter(q => q.status !== 'activated').length} />
      
      <div className="relative"><PrintHistoryCard /><Button size="sm" variant="ghost" className="absolute top-4 right-4 text-red-500" onClick={()=>{if(confirm("Clear Print History?")) clearHistoryMutation.mutate()}}><Eraser size={14} className="mr-1"/> Clear History</Button></div>

      {/* ADMIN PASSWORD SETTINGS */}
      <Card className="border-red-200">
        <CardHeader className="py-3 bg-red-50/30"><CardTitle className="text-base flex items-center gap-2"><KeyRound size={18}/> Admin Security Settings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div><Label>Current Password</Label><Input type="password" value={pwdForm.current} onChange={e=>setPwdForm({...pwdForm, current: e.target.value})} /></div>
          <div><Label>New Password</Label><Input type="password" value={pwdForm.new} onChange={e=>setPwdForm({...pwdForm, new: e.target.value})} /></div>
          <div><Label>Confirm New</Label><Input type="password" value={pwdForm.confirm} onChange={e=>setPwdForm({...pwdForm, confirm: e.target.value})} /></div>
          <Button onClick={handleAdminPasswordChange} className="bg-red-600 hover:bg-red-700">Update Admin Access</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
