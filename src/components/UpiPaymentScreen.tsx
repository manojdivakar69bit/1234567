import { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Smartphone, CheckCircle2, IndianRupee } from "lucide-react";

const UPI_ID = "manojdivakar69-3@oksbi";
const UPI_NAME = "Manoj Divakar";

interface UpiPaymentScreenProps {
  onPaymentSubmit: (data: {
    customerName: string;
    customerPhone: string;
    utr: string;
    amount: number;
    orderRef: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

const UpiPaymentScreen = ({ onPaymentSubmit, isSubmitting }: UpiPaymentScreenProps) => {
  const [amount, setAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [utr, setUtr] = useState("");
  const [success, setSuccess] = useState(false);
  const [orderRef, setOrderRef] = useState("");

  const generatedOrderRef = useMemo(() => {
    return `CMF-${Date.now().toString(36).toUpperCase()}`;
  }, []);

  const upiUrl = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) return "";
    return `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=EmergencyQR-${generatedOrderRef}&tr=${generatedOrderRef}`;
  }, [amount, generatedOrderRef]);

  const copyUpiId = () => {
    navigator.clipboard.writeText(UPI_ID);
    toast.success("UPI ID copied!");
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) { toast.error("Customer name required"); return; }
    if (!customerPhone || customerPhone.length !== 10) { toast.error("Valid 10-digit phone required"); return; }
    if (!utr || utr.length < 12) { toast.error("UTR must be at least 12 characters"); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error("Valid amount required"); return; }

    try {
      await onPaymentSubmit({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        utr: utr.trim(),
        amount: parseFloat(amount),
        orderRef: generatedOrderRef,
      });
      setOrderRef(generatedOrderRef);
      setSuccess(true);
    } catch {
      toast.error("Payment submission failed");
    }
  };

  if (success) {
    return (
      <Card className="border-green-200 shadow-lg text-center">
        <CardContent className="p-8 space-y-4">
          <CheckCircle2 className="mx-auto text-green-500" size={64} />
          <h2 className="text-xl font-black text-green-700">Order Placed!</h2>
          <p className="text-sm text-muted-foreground">Order ID: <span className="font-mono font-bold">{orderRef}</span></p>
          <Button
            onClick={() => {
              setSuccess(false);
              setAmount("");
              setCustomerName("");
              setCustomerPhone("");
              setUtr("");
            }}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            New Payment
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Amount Input */}
      <Card className="shadow-md border-none">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <IndianRupee size={16} className="text-green-600" /> UPI Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label className="text-xs font-bold">Amount (₹) *</Label>
            <Input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg font-bold"
            />
          </div>

          {/* QR Code */}
          {upiUrl && (
            <div className="flex flex-col items-center space-y-3 p-4 bg-slate-50 rounded-xl border">
              <p className="text-[10px] uppercase font-bold text-slate-500">Scan to Pay ₹{amount}</p>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <QRCodeSVG value={upiUrl} size={200} level="M" />
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">{UPI_ID}</code>
                <Button variant="ghost" size="sm" onClick={copyUpiId} className="h-7 px-2">
                  <Copy size={12} />
                </Button>
              </div>
              <p className="text-[10px] text-slate-400">{UPI_NAME}</p>
            </div>
          )}

          {/* Deep Link Buttons */}
          {upiUrl && (
            <div className="space-y-2">
              <a href={upiUrl} className="block">
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-11">
                  <Smartphone size={16} className="mr-2" /> 📱 Pay with UPI App
                </Button>
              </a>
              <div className="flex gap-2">
                <a href={upiUrl.replace("upi://", "phonepe://")} className="flex-1">
                  <Button variant="outline" className="w-full text-xs h-9 border-purple-200">PhonePe</Button>
                </a>
                <a href={upiUrl.replace("upi://", "gpay://")} className="flex-1">
                  <Button variant="outline" className="w-full text-xs h-9 border-blue-200">GPay</Button>
                </a>
                <a href={upiUrl.replace("upi://", "paytmmp://")} className="flex-1">
                  <Button variant="outline" className="w-full text-xs h-9 border-sky-200">Paytm</Button>
                </a>
              </div>
            </div>
          )}

          {/* UTR Submission Form */}
          {upiUrl && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-[10px] uppercase font-bold text-slate-500">After Payment — Submit UTR</p>
              <div>
                <Label className="text-xs font-bold">Customer Name *</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <Label className="text-xs font-bold">Phone (10 digits) *</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="9876543210"
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label className="text-xs font-bold">UTR / Transaction ID *</Label>
                <Input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="Min 12 characters" />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !amount || !customerName || !utr}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-11"
              >
                {isSubmitting ? "Submitting..." : "Submit Payment"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UpiPaymentScreen;
