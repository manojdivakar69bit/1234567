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
import { ScanLine, ArrowLeft, CheckCircle2, LogOut, IndianRupee, Users, Package, Trash2, Eraser, UserPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import QrScanner from "@/components/QrScanner";
import EmergencyContactsForm, { type EmergencyContact } from "@/components/EmergencyContactsForm";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const AgentPanel = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // --- UI STATES ---
  const [activeTab, setActiveTab] = useState<"register" | "payment" | "salesman">("register");
  const [success, setSuccess] = useState(false);

  // --- REGISTRATION STATES ---
  const [qrCodeInput, setQrCodeInput] = useState("");
  const [selectedQr, setSelectedQr] = useState<{ id: string; code: string } | null>(null);
  const [form, setForm] = useState({ name: "", vehicle_number: "", blood_group: "", address: "" });
  const [contacts, setContacts] = useState<EmergencyContact[]>([{ name: "", phone: "", relationship: "" }]);

  // --- PAYMENT STATES ---
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentCustomerName, setPaymentCustomerName] = useState("");

  // --- SALESMAN & QR STATES ---
  const [assignFrom, setAssignFrom] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [assignSalesmanId, setAssignSalesmanId] = useState("");
  const [salesmanForm, setSalesmanForm] = useState({ name: "", email: "", password: "", phone: "" });

  // 1. Get Current Agent
  const { data: currentAgent } = useQuery({
    queryKey: ["current_agent"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase.from("agents").select("*").eq("user_id", session.user.id).maybeSingle();
      return data;
    },
  });

  // 2. Fetch ONLY My Salesmen (Admin wale nahi dikhenge)
  const { data: mySalesmen = [] } = useQuery({
    queryKey: ["my_salesmen", currentAgent?.id],
    queryFn: async () => {
      if (!currentAgent?.id) return [];
      const { data, error } = await supabase
        .from("salesmen")
        .select("*")
        .eq("created_by_agent_id", currentAgent.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentAgent?.id,
  });

  // 3. Fetch Team Payments (For collection history)
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

  const addSalesmanMutation = useMutation({
    mutationFn: async () => {
      await supabase.functions.invoke("create-salesman", {
        body: { ...salesmanForm, created_by_agent_id: currentAgent?.id },
      });
    },
    onSuccess: () => {
      toast.success("Salesman added!");
      setSalesmanForm({ name: "", email: "", password: "", phone: "" });
      queryClient.invalidateQueries({ queryKey: ["my_salesmen"] });
    }
  });

  const deleteSalesmanMutation = useMutation({
    mutationFn: async (id: string) => await supabase.from("salesmen").delete().eq("id", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_salesmen"] });
      toast.success("Salesman deleted");
    }
  });

  const qrRangeActionMutation = useMutation({
    mutationFn: async (action: "assign" | "unassign") => {
      const from = assignFrom.toUpperCase();
      const to = assignTo.toUpperCase();
      const { data: rangeCodes } = await supabase.from("qr_codes").select("id").gte("code", from).lte("code", to).eq("assigned_agent_id", currentAgent?.id);
      if (!rangeCodes?.length) throw new Error("No QR codes in your stock found for this range");
      const ids = rangeCodes.map(q => q.id);
      const update = action === "assign" ? { assigned_salesman_id: assignSalesmanId, status: "assigned" } : { assigned_salesman_id: null, status: "available" };
      await supabase.from("qr_codes").update(update).in("id", ids);
    },
    onSuccess: () => {
      toast.success("Stock updated!");
      setAssignFrom(""); setAssignTo("");
    },
    onError: (e: any) => toast.error(e.message)
  });

  const lookupQr = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.from("qr_codes").select("*").eq("code", code.trim().toUpperCase()).maybeSingle();
      if (error || !data) throw new Error("QR Not Found");
      if (data.assigned_agent_id !== currentAgent?.id) throw new Error("Not in your stock");
      if (data.status === "activated") throw new Error("Already active");
      return data;
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
    onSuccess: () => setSuccess(true)
  });

  const { initiatePayment } = useRazorpayCheckout();

  const handleCollection = async () => {
    if (paymentMethod === "razorpay") {
      initiatePayment({
        amount: parseFloat(paymentAmount),
        customerName: paymentCustomerName,
        agentAccountId: currentAgent?.razorpay_account_id,
        onSuccess: () => toast.success("Online payment successful!")
      });
    } else {
      await supabase.from("payments").insert({
        amount: parseFloat(paymentAmount),
        customer_name: paymentCustomerName,
        payment_method: paymentMethod,
        collected_by_id: currentAgent?.id,
        collected_by_role: "agent",
        collector_name: currentAgent?.name
      });
      toast.success("Cash/UPI recorded!");
      setPaymentAmount(""); setPaymentCustomerName("");
      queryClient.invalidateQueries({ queryKey: ["team_payments"] });
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/login"); };

  // --- RENDER ---

  if (success) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center p-8 space-y-4">
        <CheckCircle2 className="mx-auto text-green-500" size={64} />
        <h2 className="text-2xl font-bold">Activated!</h2>
        <Button onClick={() => {setSuccess(false); setSelectedQr(null);}} className="w-full bg-blue-600 text-white">Next Registration</Button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-lg mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tighter">AGENT PANEL</h1>
          <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700">{currentAgent?.name}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-500"><LogOut size={20}/></Button>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-slate-200 p-1 rounded-xl">
        <Button size="sm" variant={activeTab === "register" ? "default" : "ghost"} onClick={() => setActiveTab("register")} className={`flex-1 ${activeTab === "register" ? "bg-white text-blue-700 shadow-sm" : ""}`}><ScanLine size={16} className="mr-1"/> Scan</Button>
        <Button size="sm" variant={activeTab === "payment" ? "default" : "ghost"} onClick={() => setActiveTab("payment")} className={`flex-1 ${activeTab === "payment" ? "bg-white text-blue-700 shadow-sm" : ""}`}><IndianRupee size={16} className="mr-1"/> Cash</Button>
        <Button size="sm" variant={activeTab === "salesman" ? "default" : "ghost"} onClick={() => setActiveTab("salesman")} className={`flex-1 ${activeTab === "salesman" ? "bg-white text-blue-700 shadow-sm" : ""}`}><Users size={16} className="mr-1"/> Team</Button>
      </div>

      {/* TEAM MANAGEMENT TAB */}
      {activeTab === "salesman" && (
        <div className="space-y-4 animate-in fade-in">
          <Card className="shadow-md border-none">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><UserPlus size={16}/> Register Salesman</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Salesman Name" value={salesmanForm.name} onChange={e=>setSalesmanForm({...salesmanForm, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Email" value={salesmanForm.email} onChange={e=>setSalesmanForm({...salesmanForm, email: e.target.value})} />
                <Input type="password" placeholder="Password" value={salesmanForm.password} onChange={e=>setSalesmanForm({...salesmanForm, password: e.target.value})} />
              </div>
              <Button onClick={() => addSalesmanMutation.mutate()} className="w-full bg-blue-600 text-white font-bold">Create Team Member</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md border-none overflow-hidden">
            <CardHeader className="bg-slate-800 text-white py-2"><CardTitle className="text-xs uppercase font-black">My Team ({mySalesmen.length})</CardTitle></CardHeader>
            <div className="max-h-48 overflow-auto bg-white">
              {mySalesmen.map((s: any) => (
                <div key={s.id} className="p-3 border-b flex justify-between items-center">
                  <div><div className="font-bold text-sm">{s.name}</div><div className="text-[10px] text-muted-foreground">{s.email}</div></div>
                  <Button variant="ghost" size="sm" onClick={() => {if(confirm("Delete?")) deleteSalesmanMutation.mutate(s.id)}} className="text-red-400"><Trash2 size={16}/></Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="shadow-md border-none">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Package size={16}/> Assign QR Stock</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="From EMR-001" value={assignFrom} onChange={e=>setAssignFrom(e.target.value)} />
                <Input placeholder="To EMR-010" value={assignTo} onChange={e=>setAssignTo(e.target.value)} />
              </div>
              <Select value={assignSalesmanId} onValueChange={setAssignSalesmanId}>
                <SelectTrigger><SelectValue placeholder="Select Salesman" /></SelectTrigger>
                <SelectContent>{mySalesmen.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={()=>qrRangeActionMutation.mutate("assign")} className="bg-green-600 text-white">Assign</Button>
                <Button onClick={()=>qrRangeActionMutation.mutate("unassign")} variant="outline" className="text-red-500 border-red-200"><Eraser size={14} className="mr-1"/> Unassign</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* COLLECTION TAB */}
      {activeTab === "payment" && (
        <div className="space-y-4 animate-in fade-in">
          <Card className="shadow-md border-none">
            <CardHeader><CardTitle className="text-sm font-bold">New Payment</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Customer Name" value={paymentCustomerName} onChange={e=>setPaymentCustomerName(e.target.value)} />
              <div className="flex gap-2">
                <Input type="number" placeholder="Amount" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} />
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="razorpay">Online</SelectItem></SelectContent>
                </Select>
              </div>
              <Button onClick={handleCollection} className="w-full bg-green-600 text-white font-bold">Submit Collection</Button>
            </CardContent>
          </Card>

          <Card className="shadow-md border-none overflow-hidden">
            <CardHeader className="bg-green-700 text-white py-2 flex flex-row justify-between items-center">
              <CardTitle className="text-xs uppercase font-bold">Team Revenue</CardTitle>
              <span className="font-black">₹{teamPayments.reduce((s,p)=>s+Number(p.amount),0)}</span>
            </CardHeader>
            <div className="max-h-60 overflow-auto bg-white">
              {teamPayments.map((p: any) => (
                <div key={p.id} className="p-3 border-b flex justify-between items-center">
                  <div><div className="font-bold text-xs">{p.customer_name}</div><div className="text-[9px] text-muted-foreground">By {p.collector_name} ({p.collected_by_role})</div></div>
                  <div className="font-black text-blue-600">₹{p.amount}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* REGISTRATION TAB */}
      {activeTab === "register" && (
        <div className="space-y-4 animate-in fade-in">
          {!selectedQr ? (
            <Card className="p-4 shadow-md border-none space-y-4">
              <QrScanner onScan={(code) => lookupQr.mutate(code)} />
              <div className="flex gap-2">
                <Input placeholder="EMR-00001" value={qrCodeInput} onChange={e=>setQrCodeInput(e.target.value)} />
                <Button onClick={()=>lookupQr.mutate(qrCodeInput)} className="bg-blue-600 text-white">Find</Button>
              </div>
            </Card>
          ) : (
            <Card className="shadow-md border-none">
              <CardHeader className="bg-blue-600 text-white py-2"><CardTitle className="text-sm">Register: {selectedQr.code}</CardTitle></CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label>Customer Details</Label>
                  <Input placeholder="Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Vehicle No" value={form.vehicle_number} onChange={e=>setForm({...form, vehicle_number:e.target.value})} />
                    <Select value={form.blood_group} onValueChange={v=>setForm({...form, blood_group:v})}>
                      <SelectTrigger><SelectValue placeholder="Blood" /></SelectTrigger>
                      <SelectContent>{BLOOD_GROUPS.map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <EmergencyContactsForm contacts={contacts} onChange={setContacts} />
                <Button onClick={()=>registerMutation.mutate()} className="w-full bg-blue-600 text-white font-bold h-12 shadow-lg">ACTIVATE QR</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Button asChild variant="ghost" className="w-full text-slate-400 text-xs"><Link to="/"><ArrowLeft size={14} className="mr-1" /> Back to Home</Link></Button>
    </div>
  );
};

export default AgentPanel;
