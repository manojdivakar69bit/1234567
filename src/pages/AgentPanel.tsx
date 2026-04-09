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
import { ScanLine, ArrowLeft, CheckCircle2, LogOut, IndianRupee, Users, Package, Trash2, Eraser, UserPlus, Database } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import QrScanner from "@/components/QrScanner";
import EmergencyContactsForm, { type EmergencyContact } from "@/components/EmergencyContactsForm";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const AgentPanel = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<"register" | "payment" | "salesman">("register");
  const [success, setSuccess] = useState(false);

  // --- REGISTRATION & PAYMENT STATES ---
  const [qrCodeInput, setQrCodeInput] = useState("");
  const [selectedQr, setSelectedQr] = useState<{ id: string; code: string } | null>(null);
  const [form, setForm] = useState({ name: "", vehicle_number: "", blood_group: "", address: "" });
  const [contacts, setContacts] = useState<EmergencyContact[]>([{ name: "", phone: "", relationship: "" }]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentCustomerName, setPaymentCustomerName] = useState("");

  // --- SALESMAN STATES ---
  const [assignFrom, setAssignFrom] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [assignSalesmanId, setAssignSalesmanId] = useState("");
  const [salesmanForm, setSalesmanForm] = useState({ 
    name: "", email: "", password: "", phone: "",
    bank: "", acc: "", ifsc: "" 
  });

  const { data: currentAgent } = useQuery({
    queryKey: ["current_agent"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase.from("agents").select("*").eq("user_id", session.user.id).maybeSingle();
      return data;
    },
  });

  const { data: myQrStock = [] } = useQuery({
    queryKey: ["my_qr_stock", currentAgent?.id],
    queryFn: async () => {
      if (!currentAgent?.id) return [];
      const { data, error } = await supabase.from("qr_codes").select("*").eq("assigned_agent_id", currentAgent.id).order("code", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentAgent?.id,
  });

  const { data: mySalesmen = [] } = useQuery({
    queryKey: ["my_salesmen", currentAgent?.id],
    queryFn: async () => {
      if (!currentAgent?.id) return [];
      const { data, error } = await supabase.from("salesmen").select("*").eq("created_by_agent_id", currentAgent.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentAgent?.id,
  });

  const { data: teamPayments = [] } = useQuery({
    queryKey: ["team_payments", currentAgent?.id],
    queryFn: async () => {
      if (!currentAgent?.id) return [];
      const { data } = await supabase.from("payments").select("*").or(`collected_by_id.eq.${currentAgent.id},agent_id.eq.${currentAgent.id}`).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!currentAgent?.id,
  });

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
      if (!codesInRange.length) throw new Error("Range not in your stock");
      const ids = codesInRange.map(q => q.id);
      const update = action === "assign" ? { assigned_salesman_id: assignSalesmanId, status: "assigned" } : { assigned_salesman_id: null, status: "available" };
      await supabase.from("qr_codes").update(update).in("id", ids);
    },
    onSuccess: () => { toast.success("Stock updated!"); queryClient.invalidateQueries({ queryKey: ["my_qr_stock"] }); },
    onError: (e: any) => toast.error(e.message)
  });

  const lookupQr = useMutation({
    mutationFn: async (code: string) => {
      const qr = myQrStock.find(q => q.code === code.trim().toUpperCase());
      if (!qr) throw new Error("QR not in your stock");
      if (qr.status === "activated") throw new Error("Already activated");
      return qr;
    },
    onSuccess: (data) => setSelectedQr(data),
    onError: (e: any) => toast.error(e.message)
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedQr) return;
      await supabase.from("customers").insert({ qr_code_id: selectedQr.id, ...form });
      const contactRows = contacts.filter(c => c.name && c.phone).map(c => ({ qr_code_id: selectedQr.id, ...c }));
      await supabase.from("emergency_contacts").insert(contactRows);
      await supabase.from("qr_codes").update({ status: "activated" }).eq("id", selectedQr.id);
    },
    onSuccess: () => { setSuccess(true); queryClient.invalidateQueries({ queryKey: ["my_qr_stock"] }); }
  });

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/login"); };

  if (success) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="w-full max-w-md text-center p-8 space-y-4 shadow-xl border-t-4 border-red-600">
        <CheckCircle2 className="mx-auto text-green-500" size={64} />
        <h2 className="text-2xl font-black text-slate-800">Registration Done!</h2>
        <Button onClick={() => {setSuccess(false); setSelectedQr(null);}} className="w-full h-12 bg-red-600 hover:bg-red-700 font-bold">Register Next</Button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-lg mx-auto space-y-6 pb-20">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border-l-4 border-red-600">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg text-white"><Users size={20}/></div>
          <div><h1 className="text-lg font-black text-slate-800 tracking-tighter uppercase leading-none">Agent Dashboard</h1><p className="text-[10px] text-red-600 font-bold mt-1 tracking-widest">{currentAgent?.name}</p></div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-red-600"><LogOut size={20}/></Button>
      </div>

      {/* STOCK OVERVIEW - RED THEME */}
      <Card className="bg-red-600 text-white border-none shadow-lg shadow-red-100 overflow-hidden">
        <CardHeader className="pb-0 flex flex-row items-center justify-between opacity-80">
          <CardTitle className="text-[10px] uppercase font-black tracking-[0.2em]">My Inventory</CardTitle>
          <Database size={14}/>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 py-5">
          <div className="text-center"><div className="text-2xl font-black">{myQrStock.length}</div><div className="text-[8px] uppercase font-bold opacity-70">Total QR</div></div>
          <div className="text-center border-x border-white/20"><div className="text-2xl font-black">{myQrStock.filter(q => q.status === 'available').length}</div><div className="text-[8px] uppercase font-bold opacity-70">In Hand</div></div>
          <div className="text-center"><div className="text-2xl font-black text-red-100">{myQrStock.filter(q => q.status === 'activated').length}</div><div className="text-[8px] uppercase font-bold opacity-70">Sold</div></div>
        </CardContent>
      </Card>

      {/* TABS - RED STYLE */}
      <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
        <Button size="sm" variant={activeTab === "register" ? "default" : "ghost"} onClick={() => setActiveTab("register")} className={`flex-1 rounded-lg transition-all ${activeTab === "register" ? "bg-red-600 text-white shadow-md" : "text-slate-500"}`}>Register</Button>
        <Button size="sm" variant={activeTab === "payment" ? "default" : "ghost"} onClick={() => setActiveTab("payment")} className={`flex-1 rounded-lg transition-all ${activeTab === "payment" ? "bg-red-600 text-white shadow-md" : "text-slate-500"}`}>Revenue</Button>
        <Button size="sm" variant={activeTab === "salesman" ? "default" : "ghost"} onClick={() => setActiveTab("salesman")} className={`flex-1 rounded-lg transition-all ${activeTab === "salesman" ? "bg-red-600 text-white shadow-md" : "text-slate-500"}`}>Team</Button>
      </div>

      {/* SALESMAN MANAGEMENT */}
      {activeTab === "salesman" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <Card className="shadow-md border-none">
            <CardHeader className="pb-2 border-b"><CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2"><UserPlus size={16} className="text-red-600"/> Add Team Member</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2"><Input placeholder="Name" value={salesmanForm.name} onChange={e=>setSalesmanForm({...salesmanForm, name: e.target.value})} /><Input placeholder="Phone" value={salesmanForm.phone} onChange={e=>setSalesmanForm({...salesmanForm, phone: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-2"><Input placeholder="Email" value={salesmanForm.email} onChange={e=>setSalesmanForm({...salesmanForm, email: e.target.value})} /><Input type="password" placeholder="Pass" value={salesmanForm.password} onChange={e=>setSalesmanForm({...salesmanForm, password: e.target.value})} /></div>
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl space-y-2">
                <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Payout Info</p>
                <Input placeholder="Bank Name" className="h-8 text-xs bg-white" value={salesmanForm.bank} onChange={e=>setSalesmanForm({...salesmanForm, bank: e.target.value})} />
                <div className="grid grid-cols-2 gap-2"><Input placeholder="Acc No" className="h-8 text-xs bg-white" value={salesmanForm.acc} onChange={e=>setSalesmanForm({...salesmanForm, acc: e.target.value})} /><Input placeholder="IFSC" className="h-8 text-xs bg-white" value={salesmanForm.ifsc} onChange={e=>setSalesmanForm({...salesmanForm, ifsc: e.target.value})} /></div>
              </div>
              <Button onClick={() => addSalesmanMutation.mutate()} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-5">Register Salesman</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md border-none overflow-hidden">
            <CardHeader className="bg-slate-800 text-white py-2 flex justify-between items-center"><CardTitle className="text-[10px] uppercase font-black tracking-widest">Active Team</CardTitle><Badge className="bg-red-600">{mySalesmen.length}</Badge></CardHeader>
            <div className="max-h-48 overflow-auto bg-white">
              {mySalesmen.map((s: any) => (
                <div key={s.id} className="p-3 border-b flex justify-between items-center transition-colors hover:bg-slate-50">
                  <div><div className="font-bold text-sm text-slate-800">{s.name}</div><div className="text-[9px] text-slate-400 font-medium">{s.bank_name || 'No Bank'} • {s.account_number || 'N/A'}</div></div>
                  <Button variant="ghost" size="sm" onClick={() => {if(confirm("Delete member?")) deleteSalesmanMutation.mutate(s.id)}} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="shadow-md border-none">
            <CardHeader className="pb-2 border-b"><CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700"><Package size={16} className="text-red-600"/> QR Distribution</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2"><Input placeholder="From (EMR-001)" value={assignFrom} onChange={e=>setAssignFrom(e.target.value)} /><Input placeholder="To (EMR-010)" value={assignTo} onChange={e=>setAssignTo(e.target.value)} /></div>
              <Select value={assignSalesmanId} onValueChange={setAssignSalesmanId}><SelectTrigger className="bg-slate-50"><SelectValue placeholder="Select Salesman" /></SelectTrigger><SelectContent>{mySalesmen.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent></Select>
              <div className="grid grid-cols-2 gap-2 pt-1"><Button onClick={()=>qrRangeActionMutation.mutate("assign")} className="bg-slate-800 text-white font-bold h-11">Assign</Button><Button onClick={()=>qrRangeActionMutation.mutate("unassign")} variant="outline" className="text-red-600 border-red-200 font-bold h-11">Unassign</Button></div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* REVENUE TAB */}
      {activeTab === "payment" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <Card className="shadow-lg border-none bg-gradient-to-br from-red-600 to-red-700 text-white">
            <CardContent className="p-6 flex justify-between items-center">
              <div><p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Total Collected</p><h2 className="text-3xl font-black">₹{teamPayments.reduce((s,p)=>s+Number(p.amount),0)}</h2></div>
              <div className="bg-white/20 p-3 rounded-2xl shadow-inner"><IndianRupee size={24} /></div>
            </CardContent>
          </Card>
          <Card className="shadow-md border-none overflow-hidden">
            <CardHeader className="bg-slate-100 py-2 border-b"><CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recent Collections</CardTitle></CardHeader>
            <div className="max-h-80 overflow-auto bg-white">
              {teamPayments.map((p: any) => (
                <div key={p.id} className="p-4 border-b flex justify-between items-center hover:bg-slate-50">
                  <div><div className="font-bold text-sm text-slate-800">{p.customer_name}</div><div className="text-[9px] text-red-500 font-bold uppercase tracking-tighter">By {p.collector_name}</div></div>
                  <div className="text-right"><div className="font-black text-slate-900 text-sm">₹{p.amount}</div><div className="text-[8px] text-slate-400">{new Date(p.created_at).toLocaleDateString()}</div></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* REGISTER TAB */}
      {activeTab === "register" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {!selectedQr ? (
            <Card className="p-6 shadow-md border-none bg-white space-y-4 rounded-2xl">
              <QrScanner onScan={(code) => lookupQr.mutate(code)} />
              <div className="flex gap-2">
                <Input placeholder="Manual Code Entry" className="bg-slate-50 h-12" value={qrCodeInput} onChange={e=>setQrCodeInput(e.target.value)} />
                <Button onClick={()=>lookupQr.mutate(qrCodeInput)} className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 h-12">FIND</Button>
              </div>
            </Card>
          ) : (
            <Card className="shadow-xl border-none overflow-hidden rounded-2xl">
              <CardHeader className="bg-red-600 text-white py-3 flex flex-row justify-between items-center"><CardTitle className="text-xs font-black tracking-widest uppercase">Activating: {selectedQr.code}</CardTitle><Badge className="bg-red-400 border-none shadow-sm">IN STOCK</Badge></CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1"><Label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Customer Full Name</Label><Input placeholder="Ex: John Doe" className="h-11 bg-slate-50 border-slate-100" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Vehicle No.</Label><Input placeholder="MH 12 AB 1234" className="h-11 bg-slate-50 border-slate-100" value={form.vehicle_number} onChange={e=>setForm({...form, vehicle_number:e.target.value})} /></div>
                    <div className="space-y-1"><Label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Blood Group</Label><Select value={form.blood_group} onValueChange={v=>setForm({...form, blood_group:v})}><SelectTrigger className="h-11 bg-slate-50 border-slate-100"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{BLOOD_GROUPS.map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                </div>
                <EmergencyContactsForm contacts={contacts} onChange={setContacts} />
                <Button onClick={()=>registerMutation.mutate()} className="w-full bg-red-600 hover:bg-red-700 text-white font-black h-14 shadow-lg shadow-red-200 mt-4 uppercase tracking-widest">Activate Protection</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Button asChild variant="ghost" className="w-full text-slate-400 text-[10px] uppercase font-bold tracking-widest pt-4"><Link to="/"><ArrowLeft size={12} className="mr-1" /> Return to Home</Link></Button>
    </div>
  );
};

export default AgentPanel;
