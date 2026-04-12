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
import { ScanLine, CheckCircle2, LogOut, IndianRupee, KeyRound, Lock, QrCode } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import QrScanner from "@/components/QrScanner";
import EmergencyContactsForm, { type EmergencyContact } from "@/components/EmergencyContactsForm";
import UpiPaymentScreen from "@/components/UpiPaymentScreen";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const SalesmanPanel = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [qrCodeInput, setQrCodeInput] = useState("");
  const [selectedQr, setSelectedQr] = useState<{ id: string; code: string } | null>(null);
  const [form, setForm] = useState({ name: "", vehicle_number: "", blood_group: "", address: "" });
  const [contacts, setContacts] = useState<EmergencyContact[]>([{ name: "", phone: "", relationship: "" }]);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"register" | "payment" | "password" | "upi">("register");
  const [pwdForm, setPwdForm] = useState({ newPwd: "", confirm: "" });
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCustomerName, setPaymentCustomerName] = useState("");

  // Current salesman data
  const { data: currentSalesman } = useQuery({
    queryKey: ["current_salesman"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase
        .from("salesmen")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      return data;
    },
  });

  // Payment history
  const { data: payments = [] } = useQuery({
    queryKey: ["salesman_payments", currentSalesman?.id],
    queryFn: async () => {
      if (!currentSalesman?.id) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("collected_by_id", currentSalesman.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentSalesman?.id,
  });

  // QR lookup
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

  // Register customer
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
      const { error: contactError } = await supabase
        .from("emergency_contacts")
        .insert(contactRows);
      if (contactError) throw contactError;

      const { error: statusError } = await supabase
        .from("qr_codes")
        .update({ status: "activated" })
        .eq("id", selectedQr.id);
      if (statusError) throw statusError;
    },
    onSuccess: () => {
      setSuccess(true);
      toast.success("Customer registered!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Cash payment collect
  const collectCashMutation = useMutation({
    mutationFn: async () => {
      if (!paymentAmount || !paymentCustomerName)
        throw new Error("Amount and customer name required");

      const { error } = await supabase.from("payments").insert({
        amount: parseFloat(paymentAmount),
        payment_method: "cash",
        status: "completed",
        collected_by_role: "salesman",
        collected_by_id: currentSalesman?.id,
        collector_name: currentSalesman?.name,
        customer_name: paymentCustomerName,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["salesman_payments"] });
      setPaymentAmount("");
      setPaymentCustomerName("");
      toast.success("Cash payment recorded!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Change password
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (pwdForm.newPwd !== pwdForm.confirm) throw new Error("Passwords do not match");
      if (pwdForm.newPwd.length < 6) throw new Error("Password must be at least 6 characters");
      const { error } = await supabase.auth.updateUser({ password: pwdForm.newPwd });
      if (error) throw error;
    },
    onSuccess: () => {
      setPwdForm({ newPwd: "", confirm: "" });
      toast.success("Password changed successfully!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("cmf_role");
    localStorage.removeItem("cmf_email");
    navigate("/login");
  };

  // ─── SUCCESS SCREEN ──────────────────────────────────────────
  if (success && selectedQr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md card-shadow text-center">
          <CardContent className="p-6 space-y-4">
            <CheckCircle2 className="mx-auto text-green-500" size={64} />
            <h2 className="text-xl font-bold">Registration Complete!</h2>
            <p className="text-muted-foreground">
              QR code {selectedQr.code} has been activated.
            </p>
            <Button
              onClick={() => {
                setSuccess(false);
                setSelectedQr(null);
                setForm({ name: "", vehicle_number: "", blood_group: "", address: "" });
                setContacts([{ name: "", phone: "", relationship: "" }]);
                setQrCodeInput("");
              }}
              className="emergency-gradient hover:opacity-90 text-primary-foreground"
            >
              Register Another
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── MAIN PANEL ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto space-y-6">

      <div className="w-full">
        <img src="/logo.png" alt="Call My Family" className="w-full object-contain" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Salesman Panel</h1>
          {currentSalesman && (
            <p className="text-sm text-muted-foreground">{currentSalesman.name}</p>
          )}
        </div>
        <Button variant="ghost" onClick={handleLogout}>
          <LogOut size={18} className="mr-1" /> Logout
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "register", label: "Register", icon: <ScanLine size={16} /> },
          { key: "payment",  label: "Cash",     icon: <IndianRupee size={16} /> },
          { key: "upi",      label: "UPI",      icon: <QrCode size={16} /> },
          { key: "password", label: "Password", icon: <KeyRound size={16} /> },
        ].map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "outline"}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={activeTab === tab.key ? "emergency-gradient text-primary-foreground" : ""}
          >
            {tab.icon}
            <span className="ml-1">{tab.label}</span>
          </Button>
        ))}
      </div>

      {/* ── UPI TAB ─────────────────────────────────────────── */}
      {activeTab === "upi" && (
        <UpiPaymentScreen
          onPaymentSubmit={async (data) => {
            const { error } = await supabase.from("payments").insert({
              amount: data.amount,
              payment_method: "upi",
              status: "utr_submitted",
              collected_by_role: "salesman",
              collected_by_id: currentSalesman?.id,
              collector_name: currentSalesman?.name,
              customer_name: data.customerName,
              notes: `Phone: ${data.customerPhone} | UTR: ${data.utr} | Ref: ${data.orderRef}`,
            });
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ["salesman_payments"] });
          }}
        />
      )}

      {/* ── CASH PAYMENT TAB ────────────────────────────────── */}
      {activeTab === "payment" && (
        <>
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee size={18} /> Collect Cash Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Customer Name *</Label>
                <Input
                  value={paymentCustomerName}
                  onChange={(e) => setPaymentCustomerName(e.target.value)}
                  placeholder="Customer name"
                />
              </div>
              <div>
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>
              <Button
                onClick={() => collectCashMutation.mutate()}
                disabled={!paymentAmount || !paymentCustomerName || collectCashMutation.isPending}
                className="w-full emergency-gradient hover:opacity-90 text-primary-foreground"
              >
                {collectCashMutation.isPending ? "Saving..." : "Record Cash Payment"}
              </Button>
            </CardContent>
          </Card>

          {/* Payment History */}
          {payments.length > 0 && (
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle>Payment History ({payments.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{p.customer_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </div>
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

      {/* ── PASSWORD TAB ────────────────────────────────────── */}
      {activeTab === "password" && (
        <Card className="card-shadow border-red-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound size={18} className="text-red-600" /> Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>New Password *</Label>
              <Input
                type="password"
                placeholder="Enter new password"
                value={pwdForm.newPwd}
                onChange={(e) => setPwdForm({ ...pwdForm, newPwd: e.target.value })}
              />
            </div>
            <div>
              <Label>Confirm Password *</Label>
              <Input
                type="password"
                placeholder="Confirm new password"
                value={pwdForm.confirm}
                onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
              />
            </div>
            <Button
              onClick={() => changePasswordMutation.mutate()}
              disabled={!pwdForm.newPwd || !pwdForm.confirm || changePasswordMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              <Lock size={14} className="mr-2" />
              {changePasswordMutation.isPending ? "Changing..." : "Update Password"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── REGISTER TAB ────────────────────────────────────── */}
      {activeTab === "register" && (
        <>
          {!selectedQr ? (
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScanLine size={18} /> Scan or Enter QR Code
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <QrScanner onScan={(code) => lookupQr.mutate(code)} />
                <div className="flex gap-2">
                  <Input
                    placeholder="EMR-00001"
                    value={qrCodeInput}
                    onChange={(e) => setQrCodeInput(e.target.value)}
                  />
                  <Button
                    onClick={() => lookupQr.mutate(qrCodeInput)}
                    disabled={!qrCodeInput}
                    className="emergency-gradient hover:opacity-90 text-primary-foreground"
                  >
                    Lookup
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle>Register Customer — {selectedQr.code}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Full Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Vehicle Number *</Label>
                  <Input
                    value={form.vehicle_number}
                    onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <Label>Blood Group *</Label>
                  <Select
                    value={form.blood_group}
                    onValueChange={(v) => setForm({ ...form, blood_group: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {BLOOD_GROUPS.map((bg) => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <EmergencyContactsForm contacts={contacts} onChange={setContacts} />
                <Button
                  onClick={() => registerMutation.mutate()}
                  disabled={
                    !form.name ||
                    !form.vehicle_number ||
                    !form.blood_group ||
                    registerMutation.isPending
                  }
                  className="w-full emergency-gradient hover:opacity-90 text-primary-foreground"
                >
                  {registerMutation.isPending ? "Registering..." : "Register & Activate"}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Button asChild variant="ghost" className="w-full">
        <Link to="/"><span>← Back</span></Link>
      </Button>
    </div>
  );
};

export default SalesmanPanel;
