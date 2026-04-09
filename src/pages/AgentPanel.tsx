import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ScanLine, ArrowLeft, CheckCircle2, LogOut, IndianRupee, Users, Package, Trash2, Eraser, UserPlus, Database, ListFilter, ChevronDown, ChevronUp } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import QrScanner from "@/components/QrScanner";
import EmergencyContactsForm, { type EmergencyContact } from "@/components/EmergencyContactsForm";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const AgentPanel = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<"register" | "payment" | "salesman">("register");
  const [showStockList, setShowStockList] = useState(false); // Stock list toggle
  const [success, setSuccess] = useState(false);

  // States
  const [qrCodeInput, setQrCodeInput] = useState("");
  const [selectedQr, setSelectedQr] = useState<{ id: string; code: string } | null>(null);
  const [form, setForm] = useState({ name: "", vehicle_number: "", blood_group: "", address: "" });
  const [contacts, setContacts] = useState<EmergencyContact[]>([{ name: "", phone: "", relationship: "" }]);
  const [salesmanForm, setSalesmanForm] = useState({ name: "", email: "", password: "", phone: "", bank: "", acc: "", ifsc: "" });
  const [assignFrom, setAssignFrom] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [assignSalesmanId, setAssignSalesmanId] = useState("");

  // 1. Current Agent Data
  const { data: currentAgent } = useQuery({
    queryKey: ["current_agent"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase.from("agents").select("*").eq("user_id", session.user.id).maybeSingle();
      return data;
    },
  });

  // 2. Fetch All QR Codes Assigned to this Agent
  const { data: myQrStock = [] } = useQuery({
    queryKey: ["my_qr_stock", currentAgent?.id],
    queryFn: async () => {
      if (!currentAgent?.id) return [];
      const { data, error } = await supabase
        .from("qr_codes")
        .select(`
          *,
          salesmen (name)
        `)
        .eq("assigned_agent_id", currentAgent.id)
        .order("code", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentAgent?.id,
  });

  // 3. Fetch Agent's Salesmen
  const { data: mySalesmen = [] } = useQuery({
    queryKey: ["my_salesmen", currentAgent?.id],
    queryFn: async () => {
      if (!currentAgent?.id) return [];
      const { data } = await supabase.from("salesmen").select("*").eq("created_by_agent_id", currentAgent.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!currentAgent?.id,
  });

  // Mutations
  const addSalesmanMutation = useMutation({
    mutationFn: async () => {
      await supabase.functions.invoke("create-salesman", {
        body: { ...salesmanForm, created_by_agent_id: currentAgent?.id, bank_name: salesmanForm.bank, account_number: salesmanForm.acc, ifsc_code: salesmanForm.ifsc },
      });
    },
    onSuccess: () => {
      toast.success("Salesman registered!");
      setSalesmanForm({ name: "", email: "", password: "", phone: "", bank: "", acc: "", ifsc: "" });
      queryClient.invalidateQueries({ queryKey: ["my_salesmen"] });
    }
  });

  const qrRangeActionMutation = useMutation({
    mutationFn: async (action: "assign" | "unassign") => {
      const from = assignFrom.toUpperCase();
      const to = assignTo.toUpperCase();
      const codesInRange = myQrStock.filter(q => q.code >= from && q.code <= to);
      if (!codesInRange.length) throw new Error("Range not found in your stock");
      const ids = codesInRange.map(q => q.id);
      const update = action === "assign" ? { assigned_salesman_id: assignSalesmanId, status: "assigned" } : { assigned_salesman_id: null, status: "available" };
      await supabase.from("qr_codes").update(update).in("id", ids);
    },
    onSuccess: () => {
      toast.success("Stock updated!");
      queryClient.invalidateQueries({ queryKey: ["my_qr_stock"] });
    },
    onError: (e: any) => toast.error(e.message)
  });

  const lookupQr = useMutation({
    mutationFn: async (code: string) => {
      const qr = myQrStock.find(q => q.code === code.trim().toUpperCase());
      if (!qr) throw new Error("This QR is not in your stock");
      if (qr.status === "activated") throw new Error("Already activated");
      return qr;
    },
    onSuccess: (data) => setSelectedQr(data),
    onError: (e: any) => toast.error(e.message)
  });

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-lg mx-auto space-y-6 pb-20">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border-l-4 border-red-600">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg text-white"><Users size={20}/></div>
          <div><h1 className="text-lg font-black text-slate-800 tracking-tighter uppercase leading-none">Agent Panel</h1><p className="text-[10px] text-red-600 font-bold mt-1 uppercase">{currentAgent?.name}</p></div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-red-600"><LogOut size={20}/></Button>
      </div>

      {/* STOCK OVERVIEW CARD */}
      <div className="space-y-2">
        <Card className="bg-red-600 text-white border-none shadow-lg shadow-red-100 overflow-hidden">
          <CardHeader className="pb-0 flex flex-row items-center justify-between opacity-80">
            <CardTitle className="text-[10px] uppercase font-black tracking-widest text-white">Stock Summary</CardTitle>
            <Database size={14}/>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 py-5">
            <div className="text-center"><div className="text-2xl font-black">{myQrStock.length}</div><div className="text-[8px] uppercase font-bold opacity-70">Total QR</div></div>
            <div className="text-center border-x border-white/20"><div className="text-2xl font-black">{myQrStock.filter(q => q.status === 'available').length}</div><div className="text-[8px] uppercase font-bold opacity-70">Unsold</div></div>
            <div className="text-center"><div className="text-2xl font-black">{myQrStock.filter(q => q.status === 'activated').length}</div><div className="text-[8px] uppercase font-bold opacity-70">Activated</div></div>
          </CardContent>
          
          {/* BUTTON TO SHOW ACTUAL QR LIST */}
          <div className="bg-red-700 p-2 text-center">
            <button 
              onClick={() => setShowStockList(!showStockList)}
              className="text-[10px] font-black uppercase flex items-center justify-center gap-1 w-full"
            >
              {showStockList ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              {showStockList ? "Hide List" : "View My QR Numbers"}
            </button>
          </div>
        </Card>

        {/* ACTUAL QR LIST (Hidden by default) */}
        {showStockList && (
          <Card className="border-none shadow-md max-h-60 overflow-auto bg-white animate-in slide-in-from-top-2 duration-300">
            <CardContent className="p-0">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-[10px] font-black text-slate-500 border-b uppercase">
                    <th className="p-3">QR Number</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Holder</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {myQrStock.map((qr) => (
                    <tr key={qr.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-700">{qr.code}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={`text-[8px] px-1 h-4 ${
                          qr.status === 'activated' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          qr.status === 'assigned' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                          'bg-green-50 text-green-600 border-green-200'
                        }`}>
                          {qr.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right text-[10px] text-slate-500 font-medium">
                        {qr.salesmen?.name || "Self (Agent)"}
                      </td>
                    </tr>
                  ))}
                  {myQrStock.length === 0 && (
                    <tr><td colSpan={3} className="p-10 text-center text-slate-400 italic">No QR Codes assigned to you.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
        <Button size="sm" variant={activeTab === "register" ? "default" : "ghost"} onClick={() => setActiveTab("register")} className={`flex-1 rounded-lg ${activeTab === "register" ? "bg-red-600 text-white shadow-md" : "text-slate-500"}`}>Scan</Button>
        <Button size="sm" variant={activeTab === "payment" ? "default" : "ghost"} onClick={() => setActiveTab("payment")} className={`flex-1 rounded-lg ${activeTab === "payment" ? "bg-red-600 text-white shadow-md" : "text-slate-500"}`}>Revenue</Button>
        <Button size="sm" variant={activeTab === "salesman" ? "default" : "ghost"} onClick={() => setActiveTab("salesman")} className={`flex-1 rounded-lg ${activeTab === "salesman" ? "bg-red-600 text-white shadow-md" : "text-slate-500"}`}>Team</Button>
      </div>

      {/* TEAM MANAGEMENT TAB */}
      {activeTab === "salesman" && (
        <div className="space-y-4 animate-in fade-in">
          <Card className="shadow-md border-none">
            <CardHeader className="pb-2 border-b"><CardTitle className="text-sm font-bold flex items-center gap-2"><UserPlus size={16} className="text-red-600"/> Create Salesman</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2"><Input placeholder="Name" value={salesmanForm.name} onChange={e=>setSalesmanForm({...salesmanForm, name: e.target.value})} /><Input placeholder="Phone" value={salesmanForm.phone} onChange={e=>setSalesmanForm({...salesmanForm, phone: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-2"><Input placeholder="Email" value={salesmanForm.email} onChange={e=>setSalesmanForm({...salesmanForm, email: e.target.value})} /><Input type="password" placeholder="Pass" value={salesmanForm.password} onChange={e=>setSalesmanForm({...salesmanForm, password: e.target.value})} /></div>
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl space-y-2">
                <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Bank Payout Info</p>
                <Input placeholder="Bank Name" className="h-8 text-xs bg-white" value={salesmanForm.bank} onChange={e=>setSalesmanForm({...salesmanForm, bank: e.target.value})} />
                <div className="grid grid-cols-2 gap-2"><Input placeholder="Acc No" className="h-8 text-xs bg-white" value={salesmanForm.acc} onChange={e=>setSalesmanForm({...salesmanForm, acc: e.target.value})} /><Input placeholder="IFSC" className="h-8 text-xs bg-white" value={salesmanForm.ifsc} onChange={e=>setSalesmanForm({...salesmanForm, ifsc: e.target.value})} /></div>
              </div>
              <Button onClick={() => addSalesmanMutation.mutate()} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12">Register Member</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md border-none">
            <CardHeader className="pb-2 border-b"><CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700"><Package size={16} className="text-red-600"/> QR Range Distribution</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2"><Input placeholder="From (EMR-001)" value={assignFrom} onChange={e=>setAssignFrom(e.target.value)} /><Input placeholder="To (EMR-010)" value={assignTo} onChange={e=>setAssignTo(e.target.value)} /></div>
              <Select value={assignSalesmanId} onValueChange={setAssignSalesmanId}>
                <SelectTrigger><SelectValue placeholder="Choose Salesman" /></SelectTrigger>
                <SelectContent>{mySalesmen.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button onClick={()=>qrRangeActionMutation.mutate("assign")} className="bg-slate-800 text-white font-bold">Assign</Button>
                <Button onClick={()=>qrRangeActionMutation.mutate("unassign")} variant="outline" className="text-red-600 border-red-200 font-bold">Unassign</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* REGISTER TAB */}
      {activeTab === "register" && (
        <div className="space-y-4 animate-in fade-in">
          {!selectedQr ? (
            <Card className="p-4 shadow-md border-none space-y-4">
              <QrScanner onScan={(code) => lookupQr.mutate(code)} />
              <div className="flex gap-2">
                <Input placeholder="Enter QR Number Manually" value={qrCodeInput} onChange={e=>setQrCodeInput(e.target.value)} />
                <Button onClick={()=>lookupQr.mutate(qrCodeInput)} className="bg-red-600 text-white font-bold">Find</Button>
              </div>
            </Card>
          ) : (
            <Card className="shadow-xl border-none overflow-hidden rounded-2xl">
              <CardHeader className="bg-red-600 text-white py-3"><CardTitle className="text-xs font-black uppercase">Activating: {selectedQr.code}</CardTitle></CardHeader>
              <CardContent className="p-5 space-y-4">
                <Input placeholder="Full Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Vehicle No" value={form.vehicle_number} onChange={e=>setForm({...form, vehicle_number:e.target.value})} />
                  <Select value={form.blood_group} onValueChange={v=>setForm({...form, blood_group:v})}>
                    <SelectTrigger><SelectValue placeholder="Blood Group" /></SelectTrigger>
                    <SelectContent>{BLOOD_GROUPS.map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <EmergencyContactsForm contacts={contacts} onChange={setContacts} />
                <Button onClick={() => registerMutation.mutate()} className="w-full bg-red-600 text-white font-black h-12 shadow-lg">ACTIVATE PROTECTION</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* REVENUE TAB SUMMARY */}
      {activeTab === "payment" && (
        <div className="animate-in fade-in"><Card className="p-10 text-center text-slate-400 italic">Revenue history details here...</Card></div>
      )}

      <Button asChild variant="ghost" className="w-full text-slate-400 text-[10px] font-bold"><Link to="/"><ArrowLeft size={12} className="mr-1" /> Back to Home</Link></Button>
    </div>
  );
};

export default AgentPanel;
