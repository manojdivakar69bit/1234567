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
import { QrCode, Users, Package, Plus, Trash2, LogOut, CheckCircle2, XCircle, Clock, Settings, IndianRupee, UserCheck, PowerOff, Eraser, Building2, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BulkStickerPrintCard from "@/components/BulkStickerPrintCard";
import PrintHistoryCard from "@/components/PrintHistoryCard";

const AdminPanel = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // States
  const [qrCount, setQrCount] = useState(10);
  const [assignFrom, setAssignFrom] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [assignAgentId, setAssignAgentId] = useState("");
  
  // Form States
  const [agentForm, setAgentForm] = useState({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" });
  const [salesmanForm, setSalesmanForm] = useState({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" });
  const [pwdForm, setPwdForm] = useState({ current: "", new: "", confirm: "" });

  // Queries
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

  const pendingAgents = agents.filter((a: any) => a.approval_status === "pending");
  const approvedAgents = agents.filter((a: any) => a.approval_status === "approved");

  // --- MUTATIONS ---

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
      const { error } = await supabase.from("qr_codes").insert(newCodes);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["qr_codes"] }); toast.success("QR Generated!"); },
  });

  const rangeActionMutation = useMutation({
    mutationFn: async (action: "assign" | "unassign") => {
      const { data: codes } = await supabase.from("qr_codes").select("id").gte("code", assignFrom.toUpperCase()).lte("code", assignTo.toUpperCase());
      if (!codes?.length) throw new Error("Range not found");
      const ids = codes.map(q => q.id);
      const update = action === "assign" ? { assigned_agent_id: assignAgentId, status: "assigned" } : { assigned_agent_id: null, status: "available" };
      await supabase.from("qr_codes").update(update).in("id", ids);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["qr_codes"] }); toast.success("Range Updated"); }
  });

  const addAgentMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-agent", {
        body: { ...agentForm, bank_name: agentForm.bank, account_number: agentForm.acc, ifsc_code: agentForm.ifsc }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agents"] }); setAgentForm({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" }); toast.success("Agent added!"); }
  });

  const addSalesmanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-salesman", {
        body: { ...salesmanForm, bank_name: salesmanForm.bank, account_number: salesmanForm.acc, ifsc_code: salesmanForm.ifsc }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["salesmen"] }); setSalesmanForm({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" }); toast.success("Salesman added!"); }
  });

  const approveAgentMutation = useMutation({
    mutationFn: async (id: string) => await supabase.from("agents").update({ approval_status: "approved" }).eq("id", id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents"] })
  });

  const deactivateQrMutation = useMutation({
    mutationFn: async (id: string) => await supabase.from("qr_codes").update({ status: "available", assigned_agent_id: null }).eq("id", id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["qr_codes"] })
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => await supabase.from("print_history").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["print_history"] }); toast.success("History Cleared"); }
  });

  const handlePasswordChange = () => {
    const stored = localStorage.getItem("cmf_admin_password") || "Admin@123";
    if (pwdForm.current !== stored) return toast.error("Current password wrong");
    if (pwdForm.new !== pwdForm.confirm) return toast.error("Mismatch");
    localStorage.setItem("cmf_admin_password", pwdForm.new);
    setPwdForm({ current: "", new: "", confirm: "" });
    toast.success("Password Updated");
  };

  const handleLogout = () => { supabase.auth.signOut(); localStorage.clear(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-background p-4 max-w-6xl mx-auto space-y-6 text-sm">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">Admin Panel</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="mr-2" size={16}/> Logout</Button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center border-blue-200 bg-blue-50/30">
          <div className="text-2xl font-bold text-blue-600">{qrCodes.length}</div>
          <div className="text-xs text-muted-foreground uppercase">Total QR</div>
        </Card>
        <Card className="p-4 text-center border-green-200 bg-green-50/30">
          <div className="text-2xl font-bold text-green-600">{qrCodes.filter(q => q.status === 'available').length}</div>
          <div className="text-xs text-muted-foreground uppercase">Available</div>
        </Card>
        <Card className="p-4 text-center border-purple-200 bg-purple-50/30">
          <div className="text-2xl font-bold text-purple-600">{qrCodes.filter(q => q.status === 'activated').length}</div>
          <div className="text-xs text-muted-foreground uppercase">Activated</div>
        </Card>
        <Card className="p-4 text-center border-orange-200 bg-orange-50/30">
          <div className="text-2xl font-bold text-orange-600">₹{allPayments.reduce((s, p) => s + Number(p.amount), 0)}</div>
          <div className="text-xs text-muted-foreground uppercase">Revenue</div>
        </Card>
      </div>

      {/* PENDING APPROVALS */}
      {pendingAgents.length > 0 && (
        <Card className="border-red-200 bg-red-50/10">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock size={18}/> Pending Approvals</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pendingAgents.map(a => (
              <div key={a.id} className="flex justify-between items-center p-2 border rounded bg-white">
                <span>{a.name} ({a.email})</span>
                <Button size="sm" onClick={() => approveAgentMutation.mutate(a.id)}>Approve</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* QR GENERATION & RANGE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus size={18}/> Generate QR</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Input type="number" value={qrCount} onChange={e => setQrCount(Number(e.target.value))} />
            <Button onClick={() => generateQrMutation.mutate(qrCount)}>Generate</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package size={18}/> Range Control</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="From" value={assignFrom} onChange={e => setAssignFrom(e.target.value)} />
              <Input placeholder="To" value={assignTo} onChange={e => setAssignTo(e.target.value)} />
            </div>
            <Select value={assignAgentId} onValueChange={setAssignAgentId}>
              <SelectTrigger><SelectValue placeholder="Select Agent" /></SelectTrigger>
              <SelectContent>{approvedAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button onClick={() => rangeActionMutation.mutate("assign")} className="flex-1">Assign</Button>
              <Button onClick={() => rangeActionMutation.mutate("unassign")} variant="outline" className="flex-1">Unassign</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AGENT & SALESMAN FORMS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Add Agent (+Bank)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Name" value={agentForm.name} onChange={e => setAgentForm({...agentForm, name: e.target.value})} />
            <Input placeholder="Email" value={agentForm.email} onChange={e => setAgentForm({...agentForm, email: e.target.value})} />
            <Input placeholder="Bank Name" value={agentForm.bank} onChange={e => setAgentForm({...agentForm, bank: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Acc No" value={agentForm.acc} onChange={e => setAgentForm({...agentForm, acc: e.target.value})} />
              <Input placeholder="IFSC" value={agentForm.ifsc} onChange={e => setAgentForm({...agentForm, ifsc: e.target.value})} />
            </div>
            <Button onClick={() => addAgentMutation.mutate()} className="w-full">Save Agent</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Add Salesman (+Bank)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Name" value={salesmanForm.name} onChange={e => setSalesmanForm({...salesmanForm, name: e.target.value})} />
            <Input placeholder="Email" value={salesmanForm.email} onChange={e => setSalesmanForm({...salesmanForm, email: e.target.value})} />
            <Input placeholder="Bank Name" value={salesmanForm.bank} onChange={e => setSalesmanForm({...salesmanForm, bank: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Acc No" value={salesmanForm.acc} onChange={e => setSalesmanForm({...salesmanForm, acc: e.target.value})} />
              <Input placeholder="IFSC" value={salesmanForm.ifsc} onChange={e => setSalesmanForm({...salesmanForm, ifsc: e.target.value})} />
            </div>
            <Button onClick={() => addSalesmanMutation.mutate()} className="w-full" variant="secondary">Save Salesman</Button>
          </CardContent>
        </Card>
      </div>

      {/* MONITORING TABLES */}
      <Card className="max-h-96 overflow-auto">
        <CardHeader><CardTitle className="text-base">QR Monitor & Reset</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr><th className="p-2 text-left">Code</th><th className="p-2 text-left">Agent</th><th className="p-2 text-left">Status</th><th className="p-2">Reset</th></tr>
            </thead>
            <tbody>
              {qrCodes.map(q => (
                <tr key={q.id} className="border-b">
                  <td className="p-2 font-mono">{q.code}</td>
                  <td className="p-2">{q.agents?.name || "-"}</td>
                  <td className="p-2"><Badge variant={q.status==='activated'?'default':'outline'}>{q.status}</Badge></td>
                  <td className="p-2 text-center">
                    {q.status !== 'available' && <Button variant="ghost" size="sm" onClick={() => deactivateQrMutation.mutate(q.id)}><PowerOff size={14} className="text-red-500"/></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <BulkStickerPrintCard baseUrl={window.location.origin} printableCount={qrCodes.filter(q => q.status !== 'activated').length} />
      
      <div className="relative">
        <PrintHistoryCard />
        <Button size="sm" variant="ghost" className="absolute top-4 right-4 text-red-500" onClick={() => { if(confirm("Clear history?")) clearHistoryMutation.mutate() }}>
          <Eraser size={14} className="mr-1"/> Clear All
        </Button>
      </div>

      {/* PASSWORD SETTINGS */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound size={18}/> Update Admin Password</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div><Label>Current</Label><Input type="password" value={pwdForm.current} onChange={e=>setPwdForm({...pwdForm, current: e.target.value})} /></div>
          <div><Label>New</Label><Input type="password" value={pwdForm.new} onChange={e=>setPwdForm({...pwdForm, new: e.target.value})} /></div>
          <div><Label>Confirm</Label><Input type="password" value={pwdForm.confirm} onChange={e=>setPwdForm({...pwdForm, confirm: e.target.value})} /></div>
          <Button onClick={handlePasswordChange}>Update</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
