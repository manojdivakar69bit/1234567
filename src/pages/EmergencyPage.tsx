import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, AlertTriangle, User, Car, Droplets, MapPin, CheckCircle2, XCircle, Loader2, Camera } from "lucide-react";
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
   console.log("CODE:", code);
  const [callStatus, setCallStatus] = useState<{ status: "idle" | "connecting" | "success" | "error"; name: string }>({ status: "idle", name: "" });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-capture location on page load
    useEffect(() => {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    },
    () => setLocationError(true)
  );
}, []); 
  // Save scan report to Supabase 
  const saveScanReport = async (lat?: number, lng?: number, photo?: string) => {
    if (reportSaved) return;
    const mapsLink = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null;
    await supabase.from("call_logs").insert({
      qr_code: code || "",
      status: "scanned",
      caller_info: { latitude: lat || null, longitude: lng || null, photo_url: photo || null, maps_link: mapsLink } as any,
    });
    setReportSaved(true);
  };

  // Auto save report when location is captured
  useEffect(() => {
  if (location) {
    saveScanReport(location.lat, location.lng);
  }
}, [location]);

  // Photo upload handler
 const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setPhotoUploading(true);

  try {
    // 👉 Cloudinary upload
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "accident_upload"); // 👈 yaha tera preset name

    const res = await fetch(
      "https://api.cloudinary.com/v1_1/dyhgfp2kp/image/upload", // 👈 yaha tera cloud name
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await res.json();

    if (!data.secure_url) {
      throw new Error("Upload failed");
    }

    const imageUrl = data.secure_url;

    // 👉 UI me photo dikhegi
    setPhotoUrl(imageUrl);

    // 👉 DB save (optional but recommended)
    await saveScanReport(location?.lat, location?.lng, imageUrl);

    // 👉 success message
    toast.success("Photo uploaded successfully!");

    // 👉 WhatsApp message
    const message = `🚨 ACCIDENT ALERT!

📍 Location:
https://maps.google.com/?q=${location?.lat},${location?.lng}

🕐 Time:
${new Date().toLocaleString("en-IN")}

📸 Photo:
${imageUrl}
`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);

  } catch (err) {
    console.log("UPLOAD ERROR:", err);
    toast.error("Photo upload failed");
  } finally {
    setPhotoUploading(false);
  }
};
    const { data, isLoading, error } = useQuery({
    queryKey: ["emergency", code],
    queryFn: async () => {
      const { data: qr, error: qrError } = await supabase
        .from("qr_codes")
        .select("id, code, status")
        .eq("code", code)
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
  const mapsLink = location ? `https://maps.google.com/?q=${location.lat},${location.lng}` : null;
  const scanTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto space-y-4">
      {/* Header */}
      <div className="text-center py-4">
        <img src="/logo.png" alt="Call My Family" style={{ width: 330, height: 250 }} className="mx-auto mb-2" />
        <h1 className="text-3xl font-bold text-primary">🚨 EMERGENCY</h1>
        <p className="text-muted-foreground">QR Code: {code}</p>
      </div>

      {/* Timestamp + Location Bar */}
      <Card className="card-shadow border-orange-200 bg-orange-50">
        <CardContent className="p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span>🕐</span>
            <span className="font-medium">Scanned at: {scanTime}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={14} className="text-primary" />
            {location ? (
              <a href={mapsLink!} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">
                View Live Location on Maps
              </a>
            ) : locationError ? (
              <span className="text-muted-foreground">Location not available</span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Getting location...
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <CallStatusBanner status={callStatus.status} name={callStatus.name} />

      {/* Customer Info */}
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

      {/* Emergency Contacts */}
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

      {/* Accident Photo */}
      <Card className="card-shadow border-blue-200 bg-blue-50">
        <CardContent className="p-4 space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Camera size={18} className="text-blue-600" /> Accident Photo
          </h2>
          <p className="text-sm text-muted-foreground">
            Photo lene se owner ki family ko immediately alert milega
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={photoUploading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {photoUploading ? (
              <><Loader2 size={16} className="animate-spin mr-2" /> Uploading...</>
            ) : (
              <><Camera size={16} className="mr-2" /> 📸 Take Accident Photo</>
            )}
          </Button>
          {photoUrl && (
            <div className="mt-2">
              <img src={photoUrl} alt="Accident" className="w-full rounded-lg border" />
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle2 size={12} /> Photo saved successfully
              </p>
            </div>
          )}
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

      {/* Helpline */}
      <Button
        className="w-full emergency-gradient hover:opacity-90 text-primary-foreground"
        onClick={() => callMutation.mutate({ phone: MASKED_CALL_NUMBER, name: "Helpline" })}
      >
        <Phone size={18} className="mr-2" /> Call Helpline ({MASKED_CALL_NUMBER})
      </Button>

      {/* Quick Emergency Numbers */}
      <Card className="card-shadow">
        <CardContent className="p-4">
          <h2 className="font-bold mb-3">Quick Emergency Numbers</h2>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="flex flex-col h-16 border-red-200"
              onClick={() => window.location.href = "tel:108"}>
              <span className="text-lg">🚑</span>
              <span className="text-xs">Ambulance 108</span>
            </Button>
            <Button variant="outline" className="flex flex-col h-16 border-blue-200"
              onClick={() => window.location.href = "tel:100"}>
              <span className="text-lg">🚔</span>
              <span className="text-xs">Police 100</span>
            </Button>
            <Button variant="outline" className="flex flex-col h-16 border-orange-200"
              onClick={() => window.location.href = "tel:101"}>
              <span className="text-lg">🚒</span>
              <span className="text-xs">Fire 101</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="h-4" />
    </div>
  );
};

export default EmergencyPage;
