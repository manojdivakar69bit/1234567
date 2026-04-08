import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, AlertTriangle, User, Car, Droplets, MapPin, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MASKED_CALL_NUMBER = "09513886363";

const CallStatusBanner = ({ status, name }: { status: "idle" | "connecting" | "success" | "error"; name: string }) => {
  if (status === "idle") return null;
  const config = {
    connecting: { icon: <Loader2 className="animate-spin" size={18} />, text: `Connecting to ${name}...`, bg: "bg-muted" },
    success: { icon: <CheckCircle2 size={18} className="text-green-600" />, text: `Call to ${name} connected!`, bg: "bg-green-50" },
    error: { icon: <XCircle size={18} className="text-destructive" />, text: `Call to ${name} failed`, bg: "bg-destructive/10" },
  }[status];
  return (
    <div className={`${config.bg} p-3 rounded-lg flex items-center gap-2 mb-4`}>
      {config.icon}
      <span className="text-sm font-medium">{config.text}</span>
    </div>
  );
};

const EmergencyPage = () => {
  const { code } = useParams<{ code: string }>();
  const [callStatus, setCallStatus] = useState<{ status: "idle" | "connecting" | "success" | "error"; name: string }>({ status: "idle", name: "" });

  const callMutation = useMutation({
    mutationFn: async ({ phone, name }: { phone: string; name: string }) => {
      setCallStatus({ status: "connecting", name });
      
      // Log the call
      await supabase.from("call_logs").insert({
        qr_code: code || "",
        contact_phone: phone,
        contact_name: name,
        status: "initiated",
      });

      // Exotel SID check — jab SID mile tab yahan add karna
      const EXOTEL_SID = import.meta.env.VITE_EXOTEL_SID;
      const EXOTEL_KEY = import.meta.env.VITE_EXOTEL_API_KEY;
      const EXOTEL_TOKEN = import.meta.env.VITE_EXOTEL_API_TOKEN;

      if (EXOTEL_SID && EXOTEL_KEY && EXOTEL_TOKEN) {
        // Masked call via Exotel
        try {
          const response = await fetch(
            `https://api.exotel.com/v1/Accounts/${EXOTEL_SID}/Calls/connect`,
            {
              method: "POST",
              headers: {
                "Authorization": "Basic " + btoa(`${EXOTEL_KEY}:${EXOTEL_TOKEN}`),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                From: MASKED_CALL_NUMBER,
                To: phone,
                CallerId: MASKED_CALL_NUMBER,
              }),
            }
          );
          if (response.ok) {
            return { phone, name, method: "masked" };
          }
        } catch {
          // Exotel failed — fallback to direct
        }
      }

      // Fallback — Direct call
      window.location.href = `tel:${phone}`;
      return { phone, name, method: "direct" };
    },
    onSuccess: ({ name }) => {
      setCallStatus({ status: "success", name });
    },
    onError: (_, { name }) => {
      setCallStatus({ status: "error", name });
      toast.error("Failed to initiate call");
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["emergency", code],
    queryFn: async () => {
      const { data: qr, error: qrError } = await supabase
        .from("qr_codes")
        .select("id, code, status")
        .eq("code", code!)
        .maybeSingle();
      if (qrError) throw qrError;
      if (!qr) throw new Error("QR code not found");

      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("qr_code_id", qr.id)
        .maybeSingle();

      const { data: contacts } = await supabase
        .from("emergency_contacts")
        .select("*")
        .eq("qr_code_id", qr.id);

      return { qr, customer, contacts: contacts || [] };
    },
    enabled: !!code,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md card-shadow text-center">
          <CardContent className="p-6 space-y-4">
            <AlertTriangle className="mx-auto text-destructive" size={48} />
            <h2 className="text-xl font-bold">Not Found</h2>
            <p className="text-muted-foreground">This QR code does not exist or has not been activated.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { customer, contacts } = data;

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto space-y-4">
      <div className="text-center py-4">
        <img src="/logo.png" alt="Call My Family" style={{ width: 330, height: 250 }} className="mx-auto mb-2" />
        <h1 className="text-3xl font-bold text-primary">🚨 EMERGENCY</h1>
        <p className="text-muted-foreground">QR Code: {code}</p>
      </div>

      <CallStatusBanner status={callStatus.status} name={callStatus.name} />

      {customer && (
        <Card className="card-shadow">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User size={18} className="text-primary" />
              <span className="font-bold text-lg">{customer.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Car size={18} className="text-muted-foreground" />
              <span>{customer.vehicle_number}</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplets size={18} className="text-destructive" />
              <span>Blood: {customer.blood_group}</span>
            </div>
            {customer.address && (
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-muted-foreground" />
                <span>{customer.address}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="card-shadow">
        <CardContent className="p-4 space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Phone size={18} className="text-primary" /> Emergency Contacts
          </h2>
          {contacts.map((contact: any, i: number) => (
            <div key={contact.id || i} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">{contact.name}</div>
                <div className="text-sm text-muted-foreground">{contact.relationship}</div>
              </div>
              <Button
                onClick={() => callMutation.mutate({ phone: contact.phone, name: contact.name })}
                disabled={callMutation.isPending}
                className="emergency-gradient hover:opacity-90 text-primary-foreground"
              >
                <Phone size={14} className="mr-1" /> Call
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {contacts.length === 0 && !customer && (
        <Card className="card-shadow">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto text-warning mb-2" size={32} />
            <p className="text-muted-foreground">This QR code has not been activated yet.</p>
          </CardContent>
        </Card>
      )}

      <Button
        className="w-full emergency-gradient hover:opacity-90 text-primary-foreground"
        onClick={() => callMutation.mutate({ phone: MASKED_CALL_NUMBER, name: "Helpline" })}
      >
        <Phone size={18} className="mr-2" /> Call Helpline ({MASKED_CALL_NUMBER})
      </Button>
    </div>
  );
};

export default EmergencyPage;
