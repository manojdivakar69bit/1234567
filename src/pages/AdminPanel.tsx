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
import { QrCode, Users, Package, Plus, Trash2, ArrowLeft, LogOut, CheckCircle2, XCircle, Clock, Settings, IndianRupee, UserCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import BulkStickerPrintCard from "@/components/BulkStickerPrintCard";
import PrintHistoryCard from "@/components/PrintHistoryCard";

const AdminPanel = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [qrCount, setQrCount] = useState(10);
  const [agentName, setAgentName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPassword, setAgentPassword] = useState("");
  const [assignFrom, setAssignFrom] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [assignAgentId, setAssignAgentId] = useState("");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  // Salesman fields
  const [salesmanName, setSalesmanName] = useState("");
  const [salesmanPhone, setSalesmanPhone] = useState("");
  const [salesmanEmail, setSalesmanEmail] = useState("");
  const [salesmanPassword, setSalesmanPassword] = useState("");

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

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*");
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

  const generateQrMutation = useMutation({
    mutationFn: async (count: number) => {
      const { data: existing } = await supabase.from("qr_codes").select("code").order("code", { ascending: false }).limit(1);
      let maxNum = 0;
      if (existing && existing.length > 0) {
        const match = existing[0].code.match(/EMR-(\d+)/);
        if (match) maxNum = parseInt(match[1], 10);
      }
      const newCodes = [];
      for (let i = 1; i <= count; i++) {
        newCodes.push({ code: `EMR-${String(maxNum + i).padStart(5, "0")}`, status: "available" });
      }
      const { data, error } = await supabase.from("qr_codes").insert(newCodes).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (codes) => {
      queryClient.invalidateQueries({ queryKey: ["qr_codes"] });
      toast.success(`${codes.length} QR codes generated!`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const { error } = await supabase.from("agents").update({ approval_status: "approved" }).eq("id", agentId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agents"] }); toast.success("Agent approved!"); },
  });

  const rejectAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const { error } = await supabase.from("agents").update({ approval_status: "rejected" }).eq("id", agentId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agents"] }); toast.success("Agent rejected"); },
  });

  const addAgentMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-agent", {
        body: { email: agentEmail, password: agentPassword, name: agentName, phone: agentPhone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setAgentName(""); setAgentPhone(""); setAgentEmail(""); setAgentPassword("");
      toast.success("Agent added!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("delete-agent", { body: { agent_id: id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agents"] }); toast.success("Agent removed"); },
  });
  const unassignAllQrMutation = useMutation({
  mutationFn: async (agentId: string) => {
    const { error } = await supabase
      .from("qr_codes")
      .update({ 
        assigned_agent_id: null, 
        status: "available" 
      })
      .eq("assigned_agent_id", agentId)
      .eq("status", "assigned"); // Sirf wahi jo activate nahi huye hain

    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["qr_codes"] });
    toast.success("QR codes unassigned from agent");
  },
});
  

  const addSalesmanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-salesman", {
        body: { email: salesmanEmail, password: salesmanPassword, name: salesmanName, phone: salesmanPhone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesmen"] });
      setSalesmanName(""); setSalesmanPhone(""); setSalesmanEmail(""); setSalesmanPassword("");
      toast.success("Salesman added!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignQrMutation = useMutation({
    mutationFn: async () => {
      if (!assignAgentId || !assignFrom || !assignTo) throw new Error("Missing fields");
      const from = assignFrom.toUpperCase();
      const to = assignTo.toUpperCase();
      const { data: rangeCodes, error: fetchError } = await supabase
        .from("qr_codes").select("id, code").gte("code", from).lte("code", to).eq("status", "available");
      if (fetchError) throw fetchError;
      if (!rangeCodes || rangeCodes.length === 0) throw new Error("No available QR codes in this range");
      const ids = rangeCodes.map(q => q.id);
      const { error } = await supabase.from("qr_codes").update({ assigned_agent_id: assignAgentId, status: "assigned" }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qr_codes"] });
      setAssignFrom(""); setAssignTo(""); setAssignAgentId("");
      toast.success("QR codes assigned to agent!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("cmf_role");
    localStorage.removeItem("cmf_email");
    localStorage.removeItem("cmf_admin_auth");
    navigate("/login");
  };

  const handleChangePassword = () => {
    const storedPwd = localStorage.getItem("cmf_admin_password") || "Admin@123";
    if (currentPwd !== storedPwd) { toast.error("Current password is incorrect"); return; }
    if (newPwd.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (newPwd !== confirmPwd) { toast.error("New passwords do not match"); return; }
    localStorage.setItem("cmf_admin_password", newPwd);
    setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    toast.success("Password changed successfully!");
  };

  const available = qrCodes.filter((q: any) => q.status === "available").length;
  const assigned = qrCodes.filter((q: any) => q.status === "assigned").length;
  const activated = qrCodes.filter((q: any) => q.status === "activated").length;
  const baseUrl = window.location.origin;
  const totalPayments = allPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  const getAgentStats = (agentId: string) => {
    const agentQrs = qrCodes.filter((q: any) => q.assigned_agent_id === agentId);
    return { total: agentQrs.length, used: agentQrs.filter((q: any) => q.status === "activated").length };
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <Button variant="ghost" onClick={handleLogout}><LogOut size={18} className="mr-1" /> Logout</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total QR Codes", value: qrCodes.length },
          { label: "Available", value: available },
          { label: "Assigned", value: assigned },
          { label: "Activated", value: activated },
          { label: "Total Revenue", value: `₹${totalPayments}` },
        ].map((s) => (
          <Card key={s.label} className="card-shadow">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-primary">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        {pendingAgents.length > 0 && (
          <Card className="card-shadow">
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock size={18} /> Pending Agent Approvals ({pendingAgents.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {pendingAgents.map((agent: any) => (
                <div key={agent.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-sm text-muted-foreground">{agent.email}</div>
                    <div className="text-xs text-muted-foreground">{agent.phone || "No phone"}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
  variant="outline" 
  size="sm" 
  onClick={() => unassignAllQrMutation.mutate(agent.id)}
  disabled={unassignAllQrMutation.isPending || getAgentStats(agent.id).total === 0}
  className="h-8 w-8 p-0"
  title="Unassign QR Codes"
>
  <Package size={14} className="text-orange-500" />
</Button>
                    
                    <Button size="sm" onClick={() => approveAgentMutation.mutate(agent.id)} className="bg-green-600 hover:bg-green-700 text-primary-foreground">
                      <CheckCircle2 size={14} className="mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectAgentMutation.mutate(agent.id)}>
                      <XCircle size={14} className="mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="card-shadow">
          <CardHeader><CardTitle className="flex items-center gap-2"><QrCode size={18} /> Generate QR Codes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 items-end">
              <div className="flex-1"><Label>Count</Label><Input type="number" min={1} max={1000} value={qrCount} onChange={(e) => setQrCount(Number(e.target.value))} className="w-24" /></div>
              <Button onClick={() => generateQrMutation.mutate(qrCount)} disabled={generateQrMutation.isPending} className="emergency-gradient hover:opacity-90 text-primary-foreground">
                <Plus size={14} className="mr-1" /> Generate
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="card-shadow">
          <CardHeader><CardTitle className="flex items-center gap-2"><Package size={18} /> Assign QR Range to Agent</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="EMR-00001" value={assignFrom} onChange={(e) => setAssignFrom(e.target.value)} />
              <Input placeholder="EMR-00010" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} />
            </div>
            <Select value={assignAgentId} onValueChange={setAssignAgentId}>
              <SelectTrigger><SelectValue placeholder="Select Agent" /></SelectTrigger>
              <SelectContent>
                {approvedAgents.map((a: any) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button onClick={() => assignQrMutation.mutate()} disabled={!assignFrom || !assignTo || !assignAgentId} className="emergency-gradient hover:opacity-90 text-primary-foreground">Assign</Button>
          </CardContent>
        </Card>

        <BulkStickerPrintCard baseUrl={baseUrl} printableCount={available + assigned} />

        {/* Salesmen Management */}
        <Card className="card-shadow">
          <CardHeader><CardTitle className="flex items-center gap-2"><UserCheck size={18} /> Salesmen ({salesmen.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Salesman Name" value={salesmanName} onChange={(e) => setSalesmanName(e.target.value)} />
              <Input placeholder="Phone" value={salesmanPhone} onChange={(e) => setSalesmanPhone(e.target.value)} />
              <Input placeholder="Email" value={salesmanEmail} onChange={(e) => setSalesmanEmail(e.target.value)} />
              <Input placeholder="Password" type="password" value={salesmanPassword} onChange={(e) => setSalesmanPassword(e.target.value)} />
            </div>
            <Button onClick={() => addSalesmanMutation.mutate()} disabled={!salesmanName || !salesmanEmail || !salesmanPassword || addSalesmanMutation.isPending} className="emergency-gradient hover:opacity-90 text-primary-foreground">
              <Plus size={14} className="mr-1" /> Add Salesman
            </Button>
            {salesmen.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-sm text-muted-foreground">{s.email} • {s.phone || "No phone"}</div>
                </div>
                <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Payment Records */}
        <Card className="card-shadow">
          <CardHeader><CardTitle className="flex items-center gap-2"><IndianRupee size={18} /> Payment Records ({allPayments.length}) — Total: ₹{totalPayments}</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {allPayments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <div className="font-medium">{p.customer_name || "N/A"}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.collected_by_role} • {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">₹{p.amount}</div>
                  <Badge variant="secondary">{p.payment_method}</Badge>
                </div>
              </div>
            ))}
            {allPayments.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No payments yet</p>}
          </CardContent>
        </Card>

        {/* QR Codes List */}
        <Card className="card-shadow">
          <CardHeader><CardTitle className="flex items-center gap-2"><QrCode size={18} /> QR Codes ({qrCodes.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-60 overflow-y-auto">
            {qrCodes.map((qr: any) => (
              <div key={qr.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{qr.code}</span>
                  {qr.agents?.name && <span className="text-xs text-muted-foreground">→ {qr.agents.name}</span>}
                </div>
                <Badge variant={qr.status === "available" ? "secondary" : qr.status === "activated" ? "default" : "outline"}>
                  {qr.status}
                </Badge>
              </div>
            ))}
            {qrCodes.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No QR codes yet</p>}
          </CardContent>
        </Card>

        <Card className="card-shadow">
          <CardHeader><CardTitle className="flex items-center gap-2"><Users size={18} /> Agents ({approvedAgents.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Agent Name" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
              <Input placeholder="Phone" value={agentPhone} onChange={(e) => setAgentPhone(e.target.value)} />
              <Input placeholder="Email" value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)} />
              <Input placeholder="Password" type="password" value={agentPassword} onChange={(e) => setAgentPassword(e.target.value)} />
            </div>
            <Button onClick={() => addAgentMutation.mutate()} disabled={!agentName || !agentPhone || !agentEmail || !agentPassword || addAgentMutation.isPending} className="emergency-gradient hover:opacity-90 text-primary-foreground">
              <Plus size={14} className="mr-1" /> Add Agent
            </Button>
            {approvedAgents.map((agent: any) => {
              const stats = getAgentStats(agent.id);
              return (
                <div key={agent.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-sm text-muted-foreground">{agent.phone}</div>
                    <div className="text-xs text-muted-foreground">QRs: {stats.total} (used: {stats.used})</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteAgentMutation.mutate(agent.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="card-shadow">
          <CardHeader><CardTitle>Customers ({customers.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-60 overflow-y-auto">
            {customers.map((c: any) => (
              <div key={c.id} className="p-2 border rounded">
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-muted-foreground">{c.vehicle_number} • Blood: {c.blood_group}</div>
              </div>
            ))}
            {customers.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No customers yet</p>}
          </CardContent>
        </Card>

        <PrintHistoryCard />

        <Card className="card-shadow">
          <CardHeader><CardTitle className="flex items-center gap-2"><Settings size={18} /> Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <h3 className="font-semibold">Change Password</h3>
            <div><Label>Current Password</Label><Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="Enter current password" /></div>
            <div><Label>New Password</Label><Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Enter new password" /></div>
            <div><Label>Confirm New Password</Label><Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Confirm new password" /></div>
            <Button onClick={handleChangePassword} className="emergency-gradient hover:opacity-90 text-primary-foreground">Save Password</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPanel;
