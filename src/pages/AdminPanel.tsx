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
import { QrCode, Users, Package, Plus, Trash2, LogOut, CheckCircle2, XCircle, Clock, Settings, IndianRupee, UserCheck, PowerOff, Eraser, Building2, UserMinus } from "lucide-react";
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

  const approvedAgents = agents.filter((a: any) => a.approval_status === "approved");

  // --- MUTATIONS ---

  const addAgentMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-agent", {
        body: { 
          email: agentForm.email, password: agentForm.password, name: agentForm.name, phone: agentForm.phone,
          bank_name: agentForm.bank, account_number: agentForm.acc, ifsc_code: agentForm.ifsc 
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setAgentForm({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" });
      toast.success("Agent added successfully!");
    },
    onError: (e: any) => toast.error(e.message)
  });

  const addSalesmanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-salesman", {
        body: { 
          email: salesmanForm.email, password: salesmanForm.password, name: salesmanForm.name, phone: salesmanForm.phone,
          bank_name: salesmanForm.bank, account_number: salesmanForm.acc, ifsc_code: salesmanForm.ifsc 
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesmen"] });
      setSalesmanForm({ name: "", phone: "", email: "", password: "", bank: "", acc: "", ifsc: "" });
      toast.success("Salesman added successfully!");
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("qr_codes").update({ assigned_agent_id: null, status: "available" }).eq("assigned_agent_id", id);
      const { error } = await supabase.functions.invoke("delete-agent", { body: { agent_id: id } });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agents"] }); toast.success("Agent deleted"); }
  });

  const rangeActionMutation = useMutation({
    mutationFn: async (action: "assign" | "unassign") => {
      const from = assignFrom.toUpperCase();
      const to = assignTo.toUpperCase();
      const { data: codes } = await supabase.from("qr_codes").select("id").gte("code", from).lte("code", to);
      if (!codes?.length) throw new Error("Range not found");
      const ids = codes.map(q => q.id);
      const update = action === "assign" ? { assigned_agent_id: assignAgentId, status: "assigned" } : { assigned_agent_id: null, status: "available" };
      const { error } = await supabase.from("qr_codes").update(update).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["qr_codes"] }); toast.success("Success!"); }
  });

  const deactivateQrMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("qr_codes").update({ status: "available", assigned_agent_id: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["qr_codes"] }); toast.success("QR Reset Done"); }
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => { await supabase.from("print_history").delete().neq("id", "000"); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["print_history"] }); toast.success("History Cleared"); }
  });

  const handleLogout = () => { supabase.auth.signOut(); localStorage.clear(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-background p-4 max-w-5xl mx-auto space-y-6 text-sm">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-primary"/> Admin Control</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="mr-2" size={16}/> Logout</Button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-blue-50/50 border-blue-100">
          <div className="text-2xl font-bold text-blue-700">{qrCodes.length}</div>
          <div className="text-xs uppercase text-muted-foreground">Total QR Codes</div>
        </Card>
        <Card className="p-4 bg-green-50/50 border-green-100">
          <div className="text-2xl font-bold text-green-700">{qrCodes.filter(q=>q.status==='available').length}</div>
          <div className="text-xs uppercase text-muted-foreground">Available Stock</div>
        </Card>
        <Card className="p-4 bg-purple-50/50 border-purple-100">
          <div className="text-2xl font-bold text-purple-700">{qrCodes.filter(q=>q.status==='activated').length}</div>
          <div className="text-xs uppercase text-muted-foreground">Total Activated</div>
        </Card>
        <Card className="p-4 bg-orange-50/50 border-orange-100">
          <div className="text-2xl font-bold text-orange-700">₹{allPayments.reduce((s,p)=>s+Number(p.amount),0)}</div>
          <div className="text-xs uppercase text-muted-foreground">Total Revenue</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ADD AGENT */}
        <Card className="card-shadow">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users size={18}/> New Agent Setup</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Name" value={agentForm.name} onChange={e=>setAgentForm({...agentForm, name: e.target.value})} />
              <Input placeholder="Email" value={agentForm.email} onChange={e=>setAgentForm({...agentForm, email: e.target.value})} />
              <Input placeholder="Phone" value={agentForm.phone} onChange={e=>setAgentForm({...agentForm, phone: e.target.value})} />
              <Input placeholder="Password" type="password" value={agentForm.password} onChange={e=>setAgentForm({...agentForm, password: e.target.value})} />
            </div>
            <div className="p-2 border rounded bg-muted/20 space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground">BANK DETAILS</p>
              <Input placeholder="Bank Name" value={agentForm.bank} onChange={e=>setAgentForm({...agentForm, bank: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Account No" value={agentForm.acc} onChange={e=>setAgentForm({...agentForm, acc: e.target.value})} />
                <Input placeholder="IFSC Code" value={agentForm.ifsc} onChange={e=>setAgentForm({...agentForm, ifsc: e.target.value})} />
              </div>
            </div>
            <Button onClick={()=>addAgentMutation.mutate()} className="w-full" disabled={addAgentMutation.isPending}>Register Agent</Button>
          </CardContent>
        </Card>

        {/* ADD SALESMAN */}
        <Card className="card-shadow">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserCheck size={18}/> New Salesman Setup</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Name" value={salesmanForm.name} onChange={e=>setSalesmanForm({...salesmanForm, name: e.target.value})} />
              <Input placeholder="Email" value={salesmanForm.email} onChange={e=>setSalesmanForm({...salesmanForm, email: e.target.value})} />
              <Input placeholder="Phone" value={salesmanForm.phone} onChange={e=>setSalesmanForm({...salesmanForm, phone: e.target.value})} />
              <Input placeholder="Password" type="password" value={salesmanForm.password} onChange={e=>setSalesmanForm({...salesmanForm, password: e.target.value})} />
            </div>
            <div className="p-2 border rounded bg-muted/20 space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground">BANK DETAILS</p>
              <Input placeholder="Bank Name" value={salesmanForm.bank} onChange={e=>setSalesmanForm({...salesmanForm, bank: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Account No" value={salesmanForm.acc} onChange={e=>setSalesmanForm({...salesmanForm, acc: e.target.value})} />
                <Input placeholder="IFSC Code" value={salesmanForm.ifsc} onChange={e=>setSalesmanForm({...salesmanForm, ifsc: e.target.value})} />
              </div>
            </div>
            <Button onClick={()=>addSalesmanMutation.mutate()} className="w-full" variant="secondary" disabled={addSalesmanMutation.isPending}>Register Salesman</Button>
          </CardContent>
        </Card>
      </div>

      {/* RANGE MANAGEMENT */}
      <Card className="card-shadow">
        <CardHeader><CardTitle className="text-base flex gap-2 items-center"><Package size={18}/> QR Range Management</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>From Code</Label><Input placeholder="EMR-00001" value={assignFrom} onChange={e=>setAssignFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>To Code</Label><Input placeholder="EMR-00050" value={assignTo} onChange={e=>setAssignTo(e.target.value)} /></div>
          </div>
          <Select value={assignAgentId} onValueChange={setAssignAgentId}>
            <SelectTrigger><SelectValue placeholder="Select Agent to Assign" /></SelectTrigger>
            <SelectContent>{approvedAgents.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button onClick={()=>rangeActionMutation.mutate("assign")} className="flex-1 emergency-gradient text-white">Assign Range</Button>
            <Button onClick={()=>rangeActionMutation.mutate("unassign")} variant="outline" className="flex-1 text-red-500 border-red-200">De-assign (Make Available)</Button>
          </div>
        </CardContent>
      </Card>

      {/* QR LIST & DEACTIVATION */}
      <Card className="card-shadow overflow-hidden">
        <CardHeader className="bg-muted/30"><CardTitle className="text-base flex justify-between items-center"><span>QR Status Monitor</span> <Badge variant="outline">{qrCodes.length} Total</Badge></CardTitle></CardHeader>
        <CardContent className="p-0 max-h-64 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white border-b text-[10px] uppercase text-muted-foreground">
              <tr><th className="p-2">Code</th><th className="p-2">Agent</th><th className="p-2">Status</th><th className="p-2">Action</th></tr>
            </thead>
            <tbody>
              {qrCodes.map(qr=>(
                <tr key={qr.id} className="border-b hover:bg-muted/10">
                  <td className="p-2 font-mono font-bold">{qr.code}</td>
                  <td className="p-2 text-xs">{qr.agents?.name || "-"}</td>
                  <td className="p-2"><Badge className="text-[9px]" variant={qr.status==='available'?'secondary':qr.status==='activated'?'default':'outline'}>{qr.status}</Badge></td>
                  <td className="p-2">
                    {qr.status !== 'available' && <Button variant="ghost" size="sm" className="h-6 text-red-500" onClick={()=>deactivateQrMutation.mutate(qr.id)}><PowerOff size={12}/></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AGENT LIST */}
        <Card className="card-shadow">
          <CardHeader><CardTitle className="text-base">Active Agents</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {approvedAgents.map(a=>(
              <div key={a.id} className="flex justify-between items-center p-2 border rounded-lg">
                <div>
                  <p className="font-bold">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground">{a.bank_name} - {a.account_number}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={()=>deleteAgentMutation.mutate(a.id)} className="text-red-500"><Trash2 size={16}/></Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* SALESMAN LIST */}
        <Card className="card-shadow">
          <CardHeader><CardTitle className="text-base">Salesmen Status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {salesmen.map(s=>(
              <div key={s.id} className="flex justify-between items-center p-2 border rounded-lg">
                <div>
                  <p className="font-bold">{s.name}</p>
                  <Badge variant={s.status==='active'?'default':'destructive'} className="text-[9px]">{s.status}</Badge>
                </div>
                <div className="text-[10px] text-right text-muted-foreground">
                  {s.bank_name}<br/>{s.account_number}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <BulkStickerPrintCard baseUrl={window.location.origin} printableCount={qrCodes.filter(q=>q.status!=='activated').length} />
      
      <div className="relative">
        <PrintHistoryCard />
        <Button size="sm" variant="ghost" className="absolute top-4 right-4 text-red-500" onClick={()=>{if(confirm("Clear all history?")) clearHistoryMutation.mutate()}}><Eraser size={14} className="mr-1"/> Clear All</Button>
      </div>
    </div>
  );
};

export default AdminPanel;
