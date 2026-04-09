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
import { ScanLine, ArrowLeft, CheckCircle2, LogOut, IndianRupee, Users, Package } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import QrScanner from "@/components/QrScanner";
import EmergencyContactsForm, { type EmergencyContact } from "@/components/EmergencyContactsForm";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const AgentPanel = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [qrCodeInput, setQrCodeInput] = useState("");
  const [selectedQr, setSelectedQr] = useState<{ id: string; code: string } | null>(null);
  const [form, setForm] = useState({ name: "", vehicle_number: "", blood_group: "", address: "" });
  const [contacts, setContacts] = useState<EmergencyContact[]>([{ name: "", phone: "", relationship: "" }]);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"register" | "payment" | "salesman">("register");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentCustomerName, setPaymentCustomerName] = useState("");
  const [assignSalesmanId, setAssignSalesmanId] = useState("");
  const [assignFrom, setAssignFrom] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [salesmanForm, setSalesmanForm] = useState({ name: "", email: "", password: "", phone: "" });

  const { data: currentAgent } = useQuery({
    queryKey: ["current_agent"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase.from("agents").select("*").eq("user_id", session.user.id).maybeSingle();
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

  const { data: payments = [] } = useQuery({
    queryKey: ["agent_payments", currentAgent?.id],
    queryFn: async () => {
      if (!currentAgent?.id) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("collected_by_id", currentAgent.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentAgent?.id,
  });

  const addSalesmanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-salesman", {
        body: { ...salesmanForm, created_by_agent_id: currentAgent?.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Salesman created successfully!");
      setSalesmanForm({ name: "", email: "", password: "", phone: "" });
      queryClient.invalidateQueries({ queryKey: ["salesmen"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const lookupQr = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("id, code, status")
        .eq("code", code.trim().toUpperCase())
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("QR code not found");
      if (data.status === "activated") throw new Error("QR code already activated");
      return data;
    },
    onSuccess: (data) => {
      setSelectedQr(data);
      toast.success(`QR code ${data.code} found`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedQr) throw new Error("No QR selected");
      const validContacts = contacts.filter((c) => c.name && c.phone);
      if (!validContacts.length) throw new Error("At least one emergency contact is required");

      const { error: custError } = await supabase.from("customers").insert({
        qr_code_id: selectedQr.id,
        name: form.name,
        vehicle_number: form.vehicle_number,
        blood_group: form.blood_group,
        address: form.address || null,
      });
      if (custError) throw custError;

      const contactRows = validContacts.map((c) => ({
        qr_code_id: selectedQr.id,
        name: c.name,
        phone: c.phone,
        relationship: c.relationship || null,
      }));
      const { error: contactError } = await supabase.from("emergency_contacts").insert(contactRows);
      if (contactError) throw contactError;

      const { error: statusError } = await supabase.from("qr_codes").update({ status: "activated" }).eq("id", selectedQr.id);
      if (statusError) throw statusError;
    },
    onSuccess: () => {
      setSuccess(true);
      toast.success("Customer registered!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const collectPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!paymentAmount || !paymentCustomerName) throw new Error("Amount and customer name required");
      const { error } = await supabase.from("payments").insert({
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        status: "completed",
        collected_by_role: "agent",
        collected_by_id: currentAgent?.id,
        customer_name: paymentCustomerName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_payments"] });
      setPaymentAmount("");
      setPaymentCustomerName("");
      setPaymentMethod("cash");
      toast.success("Payment collected!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignQrToSalesmanMutation = useMutation({
    mutationFn: async () => {
      if (!assignSalesmanId || !assignFrom || !assignTo) throw new Error("Missing fields");
      const from = assignFrom.toUpperCase();
      const to = assignTo.toUpperCase();
      const { data: rangeCodes, error: fetchError } = await supabase
        .from("qr_codes")
        .select("id, code")
        .gte("code", from)
        .lte("code", to)
        .in("status", ["available", "assigned"]);
      if (fetchError) throw fetchError;
      if (!rangeCodes || rangeCodes.length === 0) throw new Error("No QR codes in this range");

      const ids = rangeCodes.map(q => q.id);
      const { error } = await supabase
        .from("qr_codes")
        .update({ assigned_salesman_id: assignSalesmanId, status: "assigned" })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qr_codes"] });
      setAssignFrom(""); setAssignTo(""); setAssignSalesmanId("");
      toast.success("QR codes assigned to salesman!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("cmf_role");
    localStorage.removeItem("cmf_email");
    navigate("/login");
  };

  if (success && selectedQr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md card-shadow text-center">
          <CardContent className="p-6 space-y-4">
            <CheckCircle2 className="mx-auto text-green-500" size={64} />
            <h2 className="text-xl font-bold">Registration Complete!</h2>
            <p className="text-muted-foreground">QR code {selectedQr.code} has been activated.</p>
            <Button onClick={() => { setSuccess(false); setSelectedQr(null); setForm({ name: "", vehicle_number: "", blood_group: "", address: "" }); setContacts([{ name: "", phone: "", relationship: "" }]); setQrCodeInput(""); }} className="emergency-gradient hover:opacity-90 text-primary-foreground">
              Register Another
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agent Panel</h1>
        <Button variant="ghost" onClick={handleLogout}><LogOut size={18} className="mr-1" /> Logout</Button>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={activeTab === "register" ? "default" : "outline"} onClick={() => setActiveTab("register")} className={activeTab === "register" ? "emergency-gradient text-primary-foreground" : ""}>
          <ScanLine size={16} className="mr-1" /> Register
        </Button>
        <Button variant={activeTab === "payment" ? "default" : "outline"} onClick={() => setActiveTab("payment")} className={activeTab === "payment" ? "emergency-gradient text-primary-foreground" : ""}>
          <IndianRupee size={16} className="mr-1" /> Payment
        </Button>
        <Button variant={activeTab === "salesman" ? "default" : "outline"} onClick={() => setActiveTab("salesman")} className={activeTab === "salesman" ? "emergency-gradient text-primary-foreground" : ""}>
          <Users size={16} className="mr-1" /> Salesman
        </Button>
      </div>

      {/* Payment Tab */}
      {activeTab === "payment" && (
        <>
          <Card className="card-shadow">
            <CardHeader><CardTitle className="flex items-center gap-2"><IndianRupee size={18} /> Collect Payment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Customer Name *</Label><Input value={paymentCustomerName} onChange={(e) => setPaymentCustomerName(e.target.value)} /></div>
              <div><Label>Amount (₹) *</Label><Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></div>
              <div>
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="razorpay">Razorpay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => collectPaymentMutation.mutate()} disabled={!paymentAmount || !paymentCustomerName || collectPaymentMutation.isPending} className="w-full emergency-gradient hover:opacity-90 text-primary-foreground">
                {collectPaymentMutation.isPending ? "Processing..." : "Collect Payment"}
              </Button>
            </CardContent>
          </Card>
          {payments.length > 0 && (
            <Card className="card-shadow">
              <CardHeader><CardTitle>Payment History ({payments.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{p.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">₹{p.amount}</div>
                      <Badge variant="secondary">{p.payment_method}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Salesman Tab */}
      {activeTab === "salesman" && (
        <>
          <Card className="card-shadow mb-6">
            <CardHeader><CardTitle>Create New Salesman</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Salesman Name" value={salesmanForm.name} onChange={(e) => setSalesmanForm({...salesmanForm, name: e.target.value})} />
              <Input placeholder="Email" value={salesmanForm.email} onChange={(e) => setSalesmanForm({...salesmanForm, email: e.target.value})} />
              <Input type="password" placeholder="Password" value={salesmanForm.password} onChange={(e) => setSalesmanForm({...salesmanForm, password: e.target.value})} />
              <Button onClick={() => addSalesmanMutation.mutate()} className="w-full emergency-gradient hover:opacity-90 text-primary-foreground" disabled={addSalesmanMutation.isPending}>
                {addSalesmanMutation.isPending ? "Creating..." : "Add Salesman"}
              </Button>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardHeader><CardTitle className="flex items-center gap-2"><Package size={18} /> Assign QR to Salesman</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="EMR-00001" value={assignFrom} onChange={(e) => setAssignFrom(e.target.value)} />
                <Input placeholder="EMR-00010" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} />
              </div>
              <Select value={assignSalesmanId} onValueChange={setAssignSalesmanId}>
                <SelectTrigger><SelectValue placeholder="Select Salesman" /></SelectTrigger>
                <SelectContent>
                  {salesmen.filter((s: any) => s.status === "active").map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => assignQrToSalesmanMutation.mutate()} disabled={!assignFrom || !assignTo || !assignSalesmanId} className="emergency-gradient hover:opacity-90 text-primary-foreground">Assign</Button>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardHeader><CardTitle>Salesmen ({salesmen.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-60 overflow-y-auto">
              {salesmen.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.email} • {s.phone || "No phone"}</div>
                  </div>
                  <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                </div>
              ))}
              {salesmen.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No salesmen yet</p>}
            </CardContent>
          </Card>
        </>
      )}

      {/* Register Tab */}
      {activeTab === "register" && (
        <>
          {!selectedQr ? (
            <Card className="card-shadow">
              <CardHeader><CardTitle className="flex items-center gap-2"><ScanLine size={18} /> Scan or Enter QR Code</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <QrScanner onScan={(code) => lookupQr.mutate(code)} />
                <div className="flex gap-2">
                  <Input placeholder="EMR-00001" value={qrCodeInput} onChange={(e) => setQrCodeInput(e.target.value)} />
                  <Button onClick={() => lookupQr.mutate(qrCodeInput)} disabled={!qrCodeInput} className="emergency-gradient hover:opacity-90 text-primary-foreground">Lookup</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="card-shadow">
              <CardHeader><CardTitle>Register Customer — {selectedQr.code}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Full Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Vehicle Number *</Label><Input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} /></div>
                <div>
                  <Label>Blood Group *</Label>
                  <Select value={form.blood_group} onValueChange={(v) => setForm({ ...form, blood_group: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{BLOOD_GROUPS.map((bg) => (<SelectItem key={bg} value={bg}>{bg}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <EmergencyContactsForm contacts={contacts} onChange={setContacts} />
                <Button onClick={() => registerMutation.mutate()} disabled={!form.name || !form.vehicle_number || !form.blood_group || registerMutation.isPending} className="w-full emergency-gradient hover:opacity-90 text-primary-foreground">
                  {registerMutation.isPending ? "Registering..." : "Register & Activate"}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Button asChild variant="ghost" className="w-full"><Link to="/"><ArrowLeft className="mr-2" size={16} />Back</Link></Button>
    </div>
  );
};

export default AgentPanel;
