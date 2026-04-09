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
import { ScanLine, ArrowLeft, CheckCircle2, LogOut, IndianRupee, Users, Package, Trash2, Eraser, UserPlus, Database, ChevronDown, ChevronUp, History } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import QrScanner from "@/components/QrScanner";
import EmergencyContactsForm, { type EmergencyContact } from "@/components/EmergencyContactsForm";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const AgentPanel = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { initiatePayment } = useRazorpayCheckout();
  
  const [activeTab, setActiveTab] = useState<"register" | "payment" | "salesman">("register");
  const [showStockList, setShowStockList] = useState(false);
  const [success, setSuccess] = useState(false);

  // --- FORM STATES ---
  const [qrCodeInput, setQrCodeInput] = useState("");
  const [selectedQr, setSelectedQr] = useState<{ id: string; code: string } | null>(null);
  const [form, setForm] = useState({ name: "", vehicle_number: "", blood_group: "", address: "" });
  const [contacts, setContacts] = useState<EmergencyContact[]>([{ name: "", phone: "", relationship: "" }]);
  
  // --- PAYMENT STATES ---
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentCustomerName, setPaymentCustomerName] = useState("");

  // --- SALESMAN STATES ---
  const [salesmanForm, setSalesmanForm] = useState({ name: "", email: "", password: "", phone: "", bank: "", acc: "", ifsc: "" });
  const [assignFrom, setAssignFrom] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [assignSalesmanId, setAssignSalesmanId] = useState("");

  // 1. Current Agent
  const { data: currentAgent } = useQuery({
    queryKey: ["current_agent"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase.from("agents").select("*").eq("user_id", session.user.id).maybeSingle();
      return data;
    },
  });

  // 2. My QR Stock
  const { data: myQrStock = [] } = useQuery({
    queryKey: ["my_qr_stock", currentAgent?.id],
    queryFn: async () => {
      if (!currentAgent?.id) return [];
      const { data, error } = await supabase.from("qr_codes").select("*, salesmen(name)").eq("assigned_agent_id", currentAgent.id).order("code", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentAgent?.id,
  });

  // 3. My Salesmen
  const { data: mySalesmen = [] } = useQuery({
    queryKey: ["my_salesmen", currentAgent?.id],
    queryFn: async () => {
      if (!currentAgent?.id) return [];
      const { data } = await supabase.from("salesmen").select("*").eq("created_by_agent_id", currentAgent.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!currentAgent?.id,
  });

  // 4. Team Payments (Revenue)
  const { data: teamPayments = [] } = useQuery({
    queryKey: ["team_payments", currentAgent?.id],
    queryFn: async () => {
      if (!currentAgent?.id) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .or(`collected_by_id.eq.${currentAgent.id},agent_id.eq.${currentAgent.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentAgent?.id,
  });

  // --- MUTATIONS ---
  const handleCollection = async () => {
    if (!paymentAmount || !paymentCustomerName) {
      toast.error("Please fill all details");
      return;
    }

    if (paymentMethod === "razorpay") {
      initiatePayment({
        amount: parseFloat(paymentAmount),
        customerName: paymentCustomerName,
        agentAccountId: currentAgent?.razorpay_account_id,
        onSuccess: () => {
          toast.success("Online payment successful!");
          queryClient.invalidateQueries({ queryKey: ["team_payments"] });
        }
      });
    } else {
      const { error } = await supabase.from("payments").insert({
        amount: parseFloat(paymentAmount),
        customer_name: paymentCustomerName,
        payment_method: paymentMethod,
        collected_by_id: currentAgent?.id,
        collected_by_role: "agent",
        collector_name: currentAgent?.name,
        agent_id: currentAgent?.id
      });
      if (error) toast.error(error.message);
      else {
        toast.success("Payment recorded!");
        setPaymentAmount(""); setPaymentCustomerName("");
        queryClient.invalidateQueries({ queryKey: ["team_payments"] });
      }
    }
  };

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
        <h2 className="text-2xl font-black">Success!</h2>
        <Button onClick={() => {setSuccess(false); setSelectedQr(null);}} className="w-full h-12 bg-red-600 font-bold">Next Scan</Button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-lg mx-auto space-y-6 pb-20">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border-l-4 border-red-600">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg text-white"><Users size={20}/></div>
          <div><h1 className="text-lg font-black text-slate-800 tracking-tighter">AGENT PANEL</h1><p className="text-[10px] text-red-600 font-bold">{currentAgent?.name}</p></div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-red-600"><LogOut size={20}/></Button>
      </div>

      {/* STOCK OVERVIEW */}
      <div className="space-y-2">
        <Card className="bg-red-600 text-white border-none shadow-lg">
          <CardContent className="grid grid-cols-3 gap-2 py-5 text-center">
            <div><div className="text-2xl font-black">{myQrStock.length}</div><div className="text-[8px] uppercase font-bold opacity-70">Total QR</div></div>
            <div className="border-x border-white/20"><div className="text-2xl font-black">{myQrStock.filter(q => q.status === 'available').length}</div><div className="text-[8px] uppercase font-bold opacity-70">In Hand</div></div>
            <div><div className="text-2xl font-black">{myQrStock.filter(q => q.status === 'activated').length}</div><div className="text-[8px] uppercase font-bold opacity-70">Sold</div></div>
          </CardContent>
          <button onClick={() => setShowStockList(!showStockList)} className="w-full bg-red-700 p-2 text-[10px] font-black uppercase flex items-center justify-center gap-1">
            {showStockList ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} {showStockList ? "Hide List" : "View QR Numbers"}
          </button>
        </Card>
        {showStockList && (
          <Card className="border-none shadow-md max-h-48 overflow-auto bg-white animate-in slide-in-from-top-2">
            <div className="p-0">
              {myQrStock.map(qr => (
                <div key={qr.id} className="p-2 border-b flex justify-between text-xs px-4">
                  <span className="font-bold">{qr.code}</span>
                  <span className="text-slate-400 italic text-[10px]">{qr.salesmen?.name || "Self"}</span>
                  <Badge variant="outline" className="text-[8px] h-4">{qr.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border">
        <Button size="sm" variant={activeTab === "register" ? "default" : "ghost"} onClick={() => setActiveTab("register")} className={`flex-1 rounded-lg ${activeTab === "register" ? "bg-red-600 text-white shadow-md" : "text-slate-500"}`}>Register</Button>
        <Button size="sm" variant={activeTab === "payment" ? "default" : "ghost"} onClick={() => setActiveTab("payment")} className={`flex-1 rounded-lg ${activeTab === "payment" ? "bg-red-600 text-white shadow-md" : "text-slate-500"}`}>Revenue</Button>
        <Button size="sm" variant={activeTab === "salesman" ? "default" : "ghost"} onClick={() => setActiveTab("salesman")} className={`flex-1 rounded-lg ${activeTab === "salesman" ? "bg-red-600 text-white shadow-md" : "text-slate-500"}`}>Team</Button>
      </div>

      {/* REVENUE TAB (PAYMENT SYSTEM) */}
      {activeTab === "payment" && (
        <div className="space-y-4 animate-in fade-in">
          {/* TOTAL CARD */}
          <Card className="shadow-lg border-none bg-gradient-to-br from-red-600 to-red-700 text-white">
            <CardContent className="p-6 flex justify-between items-center">
              <div><p className="text-[10px] font-black uppercase opacity-70">Total Revenue</p><h2 className="text-3xl font-black">₹{teamPayments.reduce((s,p)=>s+Number(p.amount),0)}</h2></div>
              <IndianRupee size={32} className="opacity-30" />
            </CardContent>
          </Card>

          {/* NEW COLLECTION FORM */}
          <Card className="shadow-md border-none">
            <CardHeader className="pb-2 border-b"><CardTitle className="text-sm font-bold flex items-center gap-2"><IndianRupee size={16} className="text-red-600"/> Record New Payment</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <Input placeholder="Customer Name" value={paymentCustomerName} onChange={e=>setPaymentCustomerName(e.target.value)} />
              <div className="flex gap-2">
                <Input type="number" placeholder="Amount" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} />
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="razorpay">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCollection} className="w-full bg-red-600 text-white font-bold h-11">Submit Payment</Button>
            </CardContent>
          </Card>

          {/* TRANSACTION HISTORY */}
          <Card className="shadow-md border-none overflow-hidden">
            <CardHeader className="bg-slate-100 py-2 border-b"><CardTitle className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><History size={12}/> Recent Transactions</CardTitle></CardHeader>
            <div className="max-h-60 overflow-auto bg-white">
              {teamPayments.map((p: any) => (
                <div key={p.id} className="p-3 border-b flex justify-between items-center">
                  <div><div className="font-bold text-xs">{p.customer_name}</div><div className="text-[9px] text-red-500 font-bold uppercase">By {p.collector_name}</div></div>
                  <div className="text-right"><div className="font-black text-slate-800 text-sm">₹{p.amount}</div><div className="text-[8px] text-slate-400 capitalize">{p.payment_method}</div></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TEAM MANAGEMENT TAB */}
      {activeTab === "salesman" && (
        <div className="space-y-4 animate-in fade-in">
          <Card className="shadow-md border-none">
            <CardHeader className="pb-2 border-b"><CardTitle className="text-sm font-bold flex items-center gap-2"><UserPlus size={16} className="text-red-600"/> Add Salesman</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2"><Input placeholder="Name" value={salesmanForm.name} onChange={e=>setSalesmanForm({...salesmanForm, name: e.target.value})} /><Input placeholder="Phone" value={salesmanForm.phone} onChange={e=>setSalesmanForm({...salesmanForm, phone: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-2"><Input placeholder="Email" value={salesmanForm.email} onChange={e=>setSalesmanForm({...salesmanForm, email: e.target.value})} /><Input type="password" placeholder="Pass" value={salesmanForm.password} onChange={e=>setSalesmanForm({...salesmanForm, password: e.target.value})} /></div>
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl space-y-2">
                <p className="text-[9px] font-black text-red-400 uppercase">Bank Payout Info</p>
                <Input placeholder="Bank Name" className="h-8 text-xs bg-white" value={salesmanForm.bank} onChange={e=>setSalesmanForm({...salesmanForm, bank: e.target.value})} />
                <div className="grid grid-cols-2 gap-2"><Input placeholder="Acc No" className="h-8 text-xs bg-white" value={salesmanForm.acc} onChange={e=>setSalesmanForm({...salesmanForm, acc: e.target.value})} /><Input placeholder="IFSC" className="h-8 text-xs bg-white" value={salesmanForm.ifsc} onChange={e=>setSalesmanForm({...salesmanForm, ifsc: e.target.value})} /></div>
              </div>
              <Button onClick={() => addSalesmanMutation.mutate()} className="w-full bg-red-600 text-white font-bold h-12 shadow-lg">Register Member</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md border-none">
            <CardHeader className="pb-2 border-b"><CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700"><Package size={16} className="text-red-600"/> QR Distribution</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2"><Input placeholder="From (EMR-001)" value={assignFrom} onChange={e=>setAssignFrom(e.target.value)} /><Input placeholder="To (EMR-010)" value={assignTo} onChange={e=>setAssignTo(e.target.value)} /></div>
              <Select value={assignSalesmanId} onValueChange={setAssignSalesmanId}><SelectTrigger><SelectValue placeholder="Choose Salesman" /></SelectTrigger><SelectContent>{mySalesmen.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent></Select>
              <div className="grid grid-cols-2 gap-2 pt-1"><Button onClick={()=>qrRangeActionMutation.mutate("assign")} className="bg-slate-800 text-white font-bold">Assign</Button><Button onClick={()=>qrRangeActionMutation.mutate("unassign")} variant="outline" className="text-red-600 border-red-200 font-bold">Unassign</Button></div>
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
                <Input placeholder="Manual Entry" value={qrCodeInput} onChange={e=>setQrCodeInput(e.target.value)} />
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

      <Button asChild variant="ghost" className="w-full text-slate-400 text-[10px] font-bold"><Link to="/"><ArrowLeft size={12} className="mr-1" /> Return to Home</Link></Button>
    </div>
  );
};

export default AgentPanel;
