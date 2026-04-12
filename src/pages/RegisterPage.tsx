import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Printer, User, Car, Droplets, Phone, Plus, Trash2, Copy, Smartphone } from "lucide-react";
import QRCode from "qrcode";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const UPI_ID = "manojdivakar69-3@oksbi";
const UPI_NAME = "Manoj%20Divakar";

interface Contact {
  name: string;
  phone: string;
  relationship: string;
}

const generateOrderRef = () => `ORD${Date.now()}`;

const RegisterPage = () => {
  const [step, setStep] = useState<"form" | "payment" | "success">("form");
  const [form, setForm] = useState({ name: "", vehicle_number: "", blood_group: "", address: "" });
  const [contacts, setContacts] = useState<Contact[]>([{ name: "", phone: "", relationship: "" }]);
  const [activatedCode, setActivatedCode] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [upiQrUrl, setUpiQrUrl] = useState<string | null>(null);
  const [orderRef] = useState(generateOrderRef);
  const [utr, setUtr] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Fetch dynamic price
  const { data: qrPrice = 70 } = useQuery({
    queryKey: ["qr_price"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "qr_price")
        .maybeSingle();
      return data ? parseInt(data.value, 10) : 70;
    },
  });

  const addContact = () => {
    if (contacts.length < 3) setContacts([...contacts, { name: "", phone: "", relationship: "" }]);
  };
  const removeContact = (i: number) => setContacts(contacts.filter((_, idx) => idx !== i));
  const updateContact = (i: number, field: string, value: string) => {
    const updated = [...contacts];
    updated[i] = { ...updated[i], [field]: value };
    setContacts(updated);
  };

  // Generate UPI QR when moving to payment step
  const generateUpiQr = async (amount: number, ref: string) => {
    const upiString = `upi://pay?pa=${UPI_ID}&pn=${UPI_NAME}&am=${amount}&cu=INR&tn=EmergencyQR-${ref}&tr=${ref}`;
    const qrDataUrl = await QRCode.toDataURL(upiString, {
      width: 280,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
    setUpiQrUrl(qrDataUrl);
  };

  const handleGoToPayment = async () => {
    if (!form.name || !form.vehicle_number || !form.blood_group) {
      toast.error("Please fill all required fields");
      return;
    }
    const validContacts = contacts.filter((c) => c.name && c.phone);
    if (!validContacts.length) {
      toast.error("At least one emergency contact is required");
      return;
    }
    await generateUpiQr(qrPrice, orderRef);
    setStep("payment");
  };

  const handleUpiDeepLink = () => {
    const upiString = `upi://pay?pa=${UPI_ID}&pn=${UPI_NAME}&am=${qrPrice}&cu=INR&tn=EmergencyQR-${orderRef}&tr=${orderRef}`;
    window.location.href = upiString;
  };

  const handleCopyUpiId = () => {
    navigator.clipboard.writeText(UPI_ID);
    toast.success("UPI ID Copied!");
  };

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!utr || utr.length < 12) throw new Error("Please enter a valid UTR / Transaction ID (min 12 characters)");
      if (!customerPhone || customerPhone.length !== 10) throw new Error("Please enter a valid 10-digit phone number");

      const validContacts = contacts.filter((c) => c.name && c.phone);

      const { data: qr, error: qrError } = await supabase
        .from("qr_codes")
        .select("id, code")
        .eq("status", "available")
        .limit(1)
        .maybeSingle();
      if (qrError) throw qrError;
      if (!qr) throw new Error("No QR codes available right now. Please try later.");

      const { error: custError } = await supabase.from("customers").insert({
        qr_code_id: qr.id,
        name: form.name,
        vehicle_number: form.vehicle_number.toUpperCase(),
        blood_group: form.blood_group,
        address: form.address || null,
      });
      if (custError) throw custError;

      const contactRows = validContacts.map((c) => ({
        qr_code_id: qr.id,
        name: c.name,
        phone: c.phone,
        relationship: c.relationship || null,
      }));
      const { error: contactError } = await supabase.from("emergency_contacts").insert(contactRows);
      if (contactError) throw contactError;

      const { error: statusError } = await supabase
        .from("qr_codes")
        .update({ status: "activated" })
        .eq("id", qr.id);
      if (statusError) throw statusError;

      // Save payment record
      await supabase.from("payments").insert({
        amount: qrPrice,
        payment_method: "upi",
        status: "utr_submitted",
        customer_name: form.name,
        notes: `Phone: ${customerPhone} | UTR: ${utr} | Ref: ${orderRef}`,
      });

      const qrUrl = `${window.location.origin}/emergency/${qr.code}`;
      const qrImage = await QRCode.toDataURL(qrUrl, {
        width: 400,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      return { code: qr.code, qrImage };
    },
    onSuccess: ({ code, qrImage }) => {
      setActivatedCode(code);
      setQrImageUrl(qrImage);
      setStep("success");
      toast.success("QR Code activated successfully!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handlePrint = () => {
    if (!qrImageUrl || !activatedCode) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>My Emergency QR - ${activatedCode}</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: white; }
        .card { border: 3px solid #dc2626; border-radius: 16px; padding: 24px; text-align: center; max-width: 320px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .logo { font-size: 22px; font-weight: bold; color: #dc2626; margin-bottom: 4px; }
        .tagline { font-size: 12px; color: #666; margin-bottom: 16px; }
        .qr-img { width: 220px; height: 220px; margin: 0 auto 12px; display: block; }
        .code { font-size: 14px; color: #555; margin-bottom: 8px; }
        .name { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
        .vehicle { font-size: 16px; color: #dc2626; font-weight: bold; margin-bottom: 4px; }
        .blood { font-size: 14px; background: #dc2626; color: white; padding: 4px 12px; border-radius: 20px; display: inline-block; margin-bottom: 12px; }
        .footer { font-size: 11px; color: #888; margin-top: 12px; }
        .emergency { font-size: 13px; font-weight: bold; color: #dc2626; margin-top: 8px; }
        @media print { body { margin: 0; } .card { box-shadow: none; border: 3px solid #dc2626; } }
      </style></head>
      <body><div class="card">
        <div class="logo">🚨 Call My Family</div>
        <div class="tagline">Emergency QR Code</div>
        <img src="${qrImageUrl}" class="qr-img" alt="QR Code" />
        <div class="code">ID: ${activatedCode}</div>
        <div class="name">${form.name}</div>
        <div class="vehicle">${form.vehicle_number.toUpperCase()}</div>
        <div class="blood">🩸 ${form.blood_group}</div>
        <div class="emergency">Scan in emergency to contact family</div>
        <div class="footer">Stick this on your vehicle • callmyfamily.in</div>
      </div>
      <script>window.onload = () => { window.print(); }<\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  // ─── SUCCESS SCREEN ───────────────────────────────────────────
  if (step === "success" && activatedCode && qrImageUrl) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-md mx-auto space-y-4">
        <div className="text-center py-4">
          <img src="/logo.png" alt="Call My Family" className="w-40 h-40 object-contain mx-auto mb-2" />
        </div>
        <Card className="card-shadow border-green-200">
          <CardContent className="p-6 text-center space-y-4">
            <CheckCircle2 className="mx-auto text-green-500" size={64} />
            <h2 className="text-2xl font-bold text-green-700">Order Placed!</h2>
            <p className="text-muted-foreground text-sm">
              Your UTR has been submitted. Our team will verify your payment within 15–30 minutes and activate your QR code.
            </p>
            <div className="bg-muted rounded-xl p-4 space-y-1">
              <p className="text-sm text-muted-foreground">Order ID</p>
              <p className="text-xl font-bold text-primary">{orderRef}</p>
            </div>
            <div className="bg-muted rounded-xl p-4 space-y-1">
              <p className="text-sm text-muted-foreground">QR Code ID</p>
              <p className="text-xl font-bold text-primary">{activatedCode}</p>
            </div>
            <div className="flex justify-center">
              <img src={qrImageUrl} alt="Your QR Code" className="w-52 h-52 rounded-xl border-4 border-primary shadow-lg" />
            </div>
            <p className="text-sm text-muted-foreground">
              📌 Print this QR and stick it on your vehicle. In an emergency, anyone who scans it can instantly contact your family.
            </p>
            <div className="text-left bg-muted rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm"><User size={14} className="text-primary" /><span>{form.name}</span></div>
              <div className="flex items-center gap-2 text-sm"><Car size={14} className="text-muted-foreground" /><span>{form.vehicle_number.toUpperCase()}</span></div>
              <div className="flex items-center gap-2 text-sm"><Droplets size={14} className="text-destructive" /><span>Blood: {form.blood_group}</span></div>
            </div>
            <Button onClick={handlePrint} className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6">
              <Printer size={20} className="mr-2" /> Print QR Code
            </Button>
            <Button variant="outline" className="w-full" onClick={() => {
              setStep("form");
              setForm({ name: "", vehicle_number: "", blood_group: "", address: "" });
              setContacts([{ name: "", phone: "", relationship: "" }]);
              setActivatedCode(null);
              setQrImageUrl(null);
              setUtr("");
              setCustomerPhone("");
            }}>
              Register Another
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── PAYMENT SCREEN ───────────────────────────────────────────
  if (step === "payment") {
    return (
      <div className="min-h-screen bg-background p-4 max-w-md mx-auto space-y-4">
        <div className="text-center py-4">
          <img src="/logo.png" alt="Call My Family" className="w-32 h-32 object-contain mx-auto mb-2" />
          <h1 className="text-xl font-bold text-primary">Complete Payment</h1>
        </div>

        {/* Amount Banner */}
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Pay this amount</p>
            <p className="text-4xl font-black text-primary">₹{qrPrice}</p>
            <p className="text-xs text-muted-foreground mt-1">Order ID: {orderRef}</p>
          </CardContent>
        </Card>

        {/* UPI QR Code */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-base text-center">Scan & Pay with any UPI App</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-3">
            {upiQrUrl && (
              <img
                src={upiQrUrl}
                alt="UPI QR Code"
                className="w-56 h-56 rounded-xl border-4 border-primary shadow-md"
              />
            )}
            <p className="text-xs text-muted-foreground">PhonePe • GPay • Paytm • BHIM • Any UPI</p>

            {/* UPI ID Copy */}
            <div className="w-full flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
              <span className="text-sm font-mono flex-1">{UPI_ID}</span>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleCopyUpiId}>
                <Copy size={14} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* OR Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-medium">OR</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Deep Link Button */}
        <Button
          onClick={handleUpiDeepLink}
          className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Smartphone size={20} className="mr-2" /> Pay with UPI App
        </Button>

        {/* UTR Confirmation Form */}
        <Card className="card-shadow border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              ✅ Payment kar diya? UTR daalo
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              GPay / PhonePe → Transaction History → Transaction ID copy karo
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Your Phone Number *</Label>
              <Input
                placeholder="10-digit mobile number"
                type="tel"
                maxLength={10}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div>
              <Label>UTR / Transaction ID *</Label>
              <Input
                placeholder="e.g. 421836519204 (min 12 characters)"
                value={utr}
                onChange={(e) => setUtr(e.target.value.trim())}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 12 characters • Found in your UPI app's payment history
              </p>
            </div>
            <Button
              onClick={() => registerMutation.mutate()}
              disabled={registerMutation.isPending || !utr || !customerPhone}
              className="w-full py-5 bg-green-600 hover:bg-green-700 text-white text-base"
            >
              {registerMutation.isPending ? "Submitting..." : "Confirm Order"}
            </Button>
          </CardContent>
        </Card>

        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setStep("form")}>
          ← Go Back & Edit Details
        </Button>
      </div>
    );
  }

  // ─── FORM SCREEN ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto space-y-4">
      <div className="text-center py-4">
        <img src="/logo.png" alt="Call My Family" className="w-40 h-40 object-contain mx-auto mb-2" />
        <h1 className="text-2xl font-bold text-primary">Get Your Emergency QR</h1>
        <p className="text-muted-foreground text-sm mt-1">Fill your details → Pay ₹{qrPrice} → Get instant QR code</p>
      </div>

      {/* Price Banner */}
      <Card className="border-primary bg-primary/5">
        <CardContent className="p-3 text-center">
          <p className="text-sm text-muted-foreground">One-time payment</p>
          <p className="text-3xl font-bold text-primary">₹{qrPrice}</p>
          <p className="text-xs text-muted-foreground">Lifetime validity • Instant activation</p>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card className="card-shadow">
        <CardHeader><CardTitle className="flex items-center gap-2"><User size={18} className="text-primary" /> Personal Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Full Name *</Label><Input placeholder="Ramesh Kumar" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Vehicle Number *</Label><Input placeholder="MP20SM9609" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })} /></div>
          <div>
            <Label>Blood Group *</Label>
            <Select value={form.blood_group} onValueChange={(v) => setForm({ ...form, blood_group: v })}>
              <SelectTrigger><SelectValue placeholder="Select Blood Group" /></SelectTrigger>
              <SelectContent>{BLOOD_GROUPS.map((bg) => (<SelectItem key={bg} value={bg}>{bg}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div><Label>Address (Optional)</Label><Input placeholder="123, MG Road, Jabalpur" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </CardContent>
      </Card>

      {/* Emergency Contacts */}
      <Card className="card-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Phone size={18} className="text-primary" /> Emergency Contacts</CardTitle>
            {contacts.length < 3 && <Button size="sm" variant="outline" onClick={addContact}><Plus size={14} className="mr-1" /> Add</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {contacts.map((contact, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 relative">
              {contacts.length > 1 && <button onClick={() => removeContact(i)} className="absolute top-2 right-2 text-destructive"><Trash2 size={14} /></button>}
              <p className="text-xs font-medium text-muted-foreground">Contact {i + 1}</p>
              <Input placeholder="Contact Name *" value={contact.name} onChange={(e) => updateContact(i, "name", e.target.value)} />
              <Input placeholder="Phone Number *" type="tel" value={contact.phone} onChange={(e) => updateContact(i, "phone", e.target.value)} />
              <Input placeholder="Relationship (e.g. Wife, Son)" value={contact.relationship} onChange={(e) => updateContact(i, "relationship", e.target.value)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* What you get */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4 space-y-2">
          <p className="font-bold text-sm">✅ What you get:</p>
          <p className="text-sm text-muted-foreground">• Unique QR sticker for your vehicle</p>
          <p className="text-sm text-muted-foreground">• Anyone can scan & call your family in emergency</p>
          <p className="text-sm text-muted-foreground">• Accident photo + live location alert to family</p>
          <p className="text-sm text-muted-foreground">• Lifetime validity — no renewal needed</p>
        </CardContent>
      </Card>

      {/* Pay Button */}
      <Button
        onClick={handleGoToPayment}
        className="w-full emergency-gradient hover:opacity-90 text-primary-foreground text-lg py-6"
      >
        Proceed to Pay ₹{qrPrice}
      </Button>

      <p className="text-center text-xs text-muted-foreground pb-4">
        Pay via PhonePe • GPay • Paytm • Any UPI App
      </p>
    </div>
  );
};

export default RegisterPage;
