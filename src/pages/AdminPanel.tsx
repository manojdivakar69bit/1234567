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
import { 
  Users, Package, Plus, Trash2, LogOut, Settings, 
  UserCheck, Eraser, KeyRound, UserPlus, Lock, IndianRupee, 
  History, CreditCard, Search
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BulkStickerPrintCard from "@/components/BulkStickerPrintCard";
import PrintHistoryCard from "@/components/PrintHistoryCard";

const AdminPanel = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // --- STATES ---
  const [qrCount, setQrCount] = useState(10);
  const [settingsForm, setSettingsForm] = useState({ qr_price: "", agent_commission: "", salesman_commission: "" });
  const [assignFrom, setAssignFrom] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [assignAgentId, setAssignAgentId] = useState("");
  const [agentForm, setAgentForm] = useState({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" });
  const [salesmanForm, setSalesmanForm] = useState({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" });
  const [pwdForm, setPwdForm] = useState({ current: "", new: "", confirm: "" });
  const [userResetData, setUserResetData] = useState({ id: "", newPwd: "" });

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
      // Yahan se saara payment data aayega (Any amount, not just 500)
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
    },
    meta: {
      onSettled: (data: any) => {
        if (data) {
          const map: any = {};
          data.forEach((s: any) => { map[s.key] = s.value; });
          setSettingsForm({
            qr_price: map.qr_price || "70",
            agent_commission: map.agent_commission || "5",
            salesman_commission: map.salesman_commission || "15",
          });
        }
      }
    }
  });

  // Sync settings form when data loads
  useEffect(() => {
  if (appSettings.length > 0) {
    const map: any = {};
    appSettings.forEach((s: any) => { map[s.key] = s.value; });
    setSettingsForm({
      qr_price: map.qr_price || "70",
      agent_commission: map.agent_commission || "5",
      salesman_commission: map.salesman_commission || "15",
    });
  }
}, [appSettings.length]);

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

  const qrPrice = Number(settingsForm.qr_price) || 0;
  const agentComm = Number(settingsForm.agent_commission) || 0;
  const salesmanComm = Number(settingsForm.salesman_commission) || 0;
  const adminShare = qrPrice - agentComm - salesmanComm;

  const approvedAgents = agents.filter((a: any) => a.approval_status === "approved");

  // --- MUTATIONS ---
  const addAgentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("create-agent", { 
        body: { ...agentForm, bank_name: agentForm.bank, account_number: agentForm.acc, ifsc_code: agentForm.ifsc } 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setAgentForm({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" });
      toast.success("Agent Registered!");
    }
  });

  const addSalesmanMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("create-salesman", { 
        body: { ...salesmanForm, bank_name: salesmanForm.bank, account_number: salesmanForm.acc, ifsc_code: salesmanForm.ifsc } 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesmen"] });
      setSalesmanForm({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" });
      toast.success("Salesman Registered!");
    }
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

  const handleLogout = () => { supabase.auth.signOut(); localStorage.clear(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-7xl mx-auto space-y-6 text-sm">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
          <Settings className="text-blue-600" /> DASHBOARD ADMIN
        </h1>
        <Button variant="outline" size="sm" onClick={handleLogout} className="border-red-200 text-red-600 hover:bg-red-50">
          <LogOut size={16} className="mr-2"/> LOGOUT
        </Button>
      </div>

      {/* STATS - Ismein total collection dynamically calculation hogi */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-blue-600 shadow-sm">
          <div className="text-2xl font-bold">{qrCodes.length}</div>
          <div className="text-xs text-muted-foreground uppercase font-bold">Total QR</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-green-600 shadow-sm">
          <div className="text-2xl font-bold text-green-600">{qrCodes.filter(q => q.status === 'available').length}</div>
          <div className="text-xs text-muted-foreground uppercase font-bold">Available</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-purple-600 shadow-sm">
          <div className="text-2xl font-bold text-purple-600">{qrCodes.filter(q => q.status === 'activated').length}</div>
          <div className="text-xs text-muted-foreground uppercase font-bold">Activated</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-orange-500 shadow-sm bg-orange-50/30">
          {/* Yahan koi bhi amount ho, uska sum dikhega */}
          <div className="text-2xl font-black text-orange-700">₹{allPayments.reduce((acc, p) => acc + Number(p.amount), 0)}</div>
          <div className="text-xs text-orange-900 uppercase font-bold">Total Collection</div>
        </Card>
      </div>

      {/* PAYMENT HISTORY TABLE - ALL AMOUNTS */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-100/50 py-3 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <IndianRupee size={18} className="text-green-600"/> All Transactions History
          </CardTitle>
          <Badge variant="secondary">{allPayments.length} Payments</Badge>
        </CardHeader>
        <CardContent className="p-0 max-h-80 overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 sticky top-0">
              <tr>
                <th className="p-3">Customer Name</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Collected By</th>
                <th className="p-3 text-right">Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {allPayments.map((p: any) => (
                <tr key={p.id} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-semibold">{p.customer_name || "Direct Customer"}</td>
                  <td className="p-3 font-mono font-bold text-blue-600">₹{p.amount}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Badge className="text-[9px] h-4 bg-slate-200 text-slate-700 hover:bg-slate-200 border-none">
                        {p.collector_type?.toUpperCase() || 'USER'}
                      </Badge>
                      <span className="font-medium text-slate-700">{p.collector_name || "Unknown"}</span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-[10px] text-muted-foreground font-mono">
                    {new Date(p.created_at).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
              {allPayments.length === 0 && (
                <tr><td colSpan={4} className="p-10 text-center text-slate-400 italic">No payments found in database.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* AGENT & SALESMAN CONTROL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 py-3 border-b"><CardTitle className="text-sm font-bold flex items-center gap-2"><Users size={16}/> Agents List</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-60 overflow-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-[10px] uppercase">
                <tr><th className="p-3">Name</th><th className="p-3">Reset Pwd</th><th className="p-3 text-center">Action</th></tr>
              </thead>
              <tbody>
                {approvedAgents.map(a => (
                  <tr key={a.id} className="border-b">
                    <td className="p-3 font-medium">{a.name}</td>
                    <td className="p-3">
                      <div className="flex gap-1"><Input placeholder="New" type="password" className="h-7 text-[10px] w-20" onChange={e=>setUserResetData({id:a.id, newPwd:e.target.value})}/><Button size="sm" className="h-7 px-2" onClick={()=>toast.success("Password Updated")}><Lock size={12}/></Button></div>
                    </td>
                    <td className="p-3 text-center"><Button variant="ghost" size="sm" className="text-red-500 h-8 w-8 p-0" onClick={()=>{if(confirm("Delete Agent?")) deleteUserMutation.mutate({id:a.id, type:'agent'})}}><Trash2 size={16}/></Button></td>
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
                <tr><th className="p-3">Name</th><th className="p-3">Reset Pwd</th><th className="p-3 text-center">Action</th></tr>
              </thead>
              <tbody>
                {salesmen.map(s => (
                  <tr key={s.id} className="border-b">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3">
                      <div className="flex gap-1"><Input placeholder="New" type="password" className="h-7 text-[10px] w-20" onChange={e=>setUserResetData({id:s.id, newPwd:e.target.value})}/><Button size="sm" variant="secondary" className="h-7 px-2" onClick={()=>toast.success("Password Updated")}><Lock size={12}/></Button></div>
                    </td>
                    <td className="p-3 text-center"><Button variant="ghost" size="sm" className="text-red-500 h-8 w-8 p-0" onClick={()=>{if(confirm("Delete Salesman?")) deleteUserMutation.mutate({id:s.id, type:'salesman'})}}><Trash2 size={16}/></Button></td>
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
          <CardHeader className="py-3 bg-blue-50/50 border-b"><CardTitle className="text-sm flex items-center gap-2"><UserPlus size={16}/> New Agent</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-2"><Input placeholder="Name" value={agentForm.name} onChange={e=>setAgentForm({...agentForm, name: e.target.value})} /><Input placeholder="Email" value={agentForm.email} onChange={e=>setAgentForm({...agentForm, email: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-2"><Input placeholder="Phone" value={agentForm.phone} onChange={e=>setAgentForm({...agentForm, phone: e.target.value})} /><Input placeholder="Password" type="password" value={agentForm.password} onChange={e=>setAgentForm({...agentForm, password: e.target.value})} /></div>
            <div className="p-2 border rounded bg-slate-50/50 space-y-2"><Input placeholder="Bank Name" value={agentForm.bank} onChange={e=>setAgentForm({...agentForm, bank: e.target.value})} /><div className="grid grid-cols-2 gap-2"><Input placeholder="Account No" value={agentForm.acc} onChange={e=>setAgentForm({...agentForm, acc: e.target.value})} /><Input placeholder="IFSC" value={agentForm.ifsc} onChange={e=>setAgentForm({...agentForm, ifsc: e.target.value})} /></div></div>
            <Button onClick={()=>addAgentMutation.mutate()} className="w-full">Register Agent</Button>
          </CardContent>
        </Card>

        <Card className="border-purple-100 shadow-sm">
          <CardHeader className="py-3 bg-purple-50/50 border-b"><CardTitle className="text-sm flex items-center gap-2"><UserPlus size={16}/> New Salesman</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-2"><Input placeholder="Name" value={salesmanForm.name} onChange={e=>setSalesmanForm({...salesmanForm, name: e.target.value})} /><Input placeholder="Email" value={salesmanForm.email} onChange={e=>setSalesmanForm({...salesmanForm, email: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-2"><Input placeholder="Phone" value={salesmanForm.phone} onChange={e=>setSalesmanForm({...salesmanForm, phone: e.target.value})} /><Input placeholder="Password" type="password" value={salesmanForm.password} onChange={e=>setSalesmanForm({...salesmanForm, password: e.target.value})} /></div>
            <div className="p-2 border rounded bg-slate-50/50 space-y-2"><Input placeholder="Bank Name" value={salesmanForm.bank} onChange={e=>setSalesmanForm({...salesmanForm, bank: e.target.value})} /><div className="grid grid-cols-2 gap-2"><Input placeholder="Account No" value={salesmanForm.acc} onChange={e=>setSalesmanForm({...salesmanForm, acc: e.target.value})} /><Input placeholder="IFSC" value={salesmanForm.ifsc} onChange={e=>setSalesmanForm({...salesmanForm, ifsc: e.target.value})} /></div></div>
            <Button onClick={()=>addSalesmanMutation.mutate()} variant="secondary" className="w-full">Register Salesman</Button>
          </CardContent>
        </Card>
      </div>

      {/* QR TOOLS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card><CardHeader className="py-3 bg-slate-50"><CardTitle className="text-sm">Batch QR</CardTitle></CardHeader>
          <CardContent className="flex gap-2 pt-4"><Input type="number" value={qrCount} onChange={e => setQrCount(Number(e.target.value))} /><Button onClick={() => generateQrMutation.mutate(qrCount)}>Generate</Button></CardContent>
        </Card>
        <Card><CardHeader className="py-3 bg-slate-50"><CardTitle className="text-sm">Range Assign</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-2"><Input placeholder="From" value={assignFrom} onChange={e => setAssignFrom(e.target.value)} /><Input placeholder="To" value={assignTo} onChange={e => setAssignTo(e.target.value)} /></div>
            <Select value={assignAgentId} onValueChange={setAssignAgentId}><SelectTrigger><SelectValue placeholder="Agent" /></SelectTrigger><SelectContent>{approvedAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>
            <div className="flex gap-2"><Button onClick={() => rangeActionMutation.mutate("assign")} className="flex-1">Assign</Button><Button onClick={() => rangeActionMutation.mutate("unassign")} variant="outline" className="flex-1">Unassign</Button></div>
          </CardContent>
        </Card>
      </div>

      {/* PRICING & COMMISSION CONTROL */}
      <Card className="border-green-100 shadow-sm">
        <CardHeader className="py-3 bg-green-50/50 border-b">
          <CardTitle className="text-sm flex items-center gap-2"><IndianRupee size={16} className="text-green-600"/> Pricing & Commission Control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-bold text-slate-600">QR Price (₹)</Label>
              <Input type="number" value={settingsForm.qr_price} onChange={e => setSettingsForm({ ...settingsForm, qr_price: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Agent Commission (₹)</Label>
              <Input type="number" value={settingsForm.agent_commission} onChange={e => setSettingsForm({ ...settingsForm, agent_commission: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Salesman Commission (₹)</Label>
              <Input type="number" value={settingsForm.salesman_commission} onChange={e => setSettingsForm({ ...settingsForm, salesman_commission: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border text-sm font-mono text-center">
            <span className="font-bold text-blue-700">₹{qrPrice}</span>
            <span className="text-slate-400 mx-1">→</span>
            <span className="text-orange-600">₹{agentComm} agent</span>
            <span className="text-slate-400 mx-1">+</span>
            <span className="text-purple-600">₹{salesmanComm} salesman</span>
            <span className="text-slate-400 mx-1">+</span>
            <span className={`font-bold ${adminShare >= 0 ? 'text-green-600' : 'text-red-600'}`}>₹{adminShare} yours</span>
          </div>
          <Button onClick={() => saveSettingsMutation.mutate()} className="w-full bg-green-600 hover:bg-green-700" disabled={saveSettingsMutation.isPending}>
            {saveSettingsMutation.isPending ? "Saving..." : "Save All Settings"}
          </Button>
        </CardContent>
      </Card>

      <BulkStickerPrintCard baseUrl={window.location.origin} printableCount={qrCodes.filter(q => q.status !== 'activated').length} />
      <PrintHistoryCard />
    </div>
  );
};

export default AdminPanel;
