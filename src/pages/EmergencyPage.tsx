import { useEffect, useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, AlertTriangle, User, Car, Droplets, MapPin, CheckCircle2, XCircle, Loader2, Camera, Send } from "lucide-react";
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

const getFreshLocation = (): Promise<{ lat: number; lng: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
};

const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    return data.display_name || "Tap the Maps link below to see exact location";
  } catch {
    return "";
  }
};

const EmergencyPage = () => {
  const { code } = useParams<{ code: string }>();
  const [callStatus, setCallStatus] = useState<{ status: "idle" | "connecting" | "success" | "error"; name: string }>({ status: "idle", name: "" });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  const [waMessage, setWaMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => { locationRef.current = location; }, [location]);

  const callMutation = useMutation({
    mutationFn: async ({ phone, name }: { phone: string; name: string }) => {
      setCallStatus({ status: "connecting", name });
      await new Promise((res) => setTimeout(res, 800));
      window.location.href = `tel:${phone}`;
      setCallStatus({ status: "success", name });
    },
    onError: (_: any, variables: { phone: string; name: string }) => {
      setCallStatus({ status: "error", name: variables.name });
    },
  });

  useEffect(() => {
    if (!navigator.geolocation) { setLocationError(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError(true),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["emergency", code],
    queryFn: async () => {
      const { data: qr, error: qrError } = await supabase.from("qr_codes").select("id, code, status").eq("code", code).maybeSingle();
      if (qrError) throw qrError;
      if (!qr) throw new Error("QR code not found");
      const { data: customer } = await supabase.from("customers").select("*").eq("qr_code_id", qr.id).maybeSingle();
      const { data: contacts } = await supabase.from("emergency_contacts").select("*").eq("qr_code_id", qr.id);
      return { qr, customer, contacts: contacts || [] };
    },
    enabled: !!code,
  });

  const saveScanReport = async (lat?: number, lng?: number, photo?: string) => {
    if (reportSaved) return;
    const mapsLink = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null;
    await supabase.from("call_logs").insert({
      qr_code: code || "",
      status: "scanned",
      caller_info: { latitude: lat || null, longitude: lng || null, photo_url: photo || null, maps_link: mapsLink } as any,
    });
    setReportSaved(true);
  };

  useEffect(() => {
    if (location) saveScanReport(location.lat, location.lng);
  }, [location]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    toast("Fetching location & uploading photo...");

    try {
      let currentLocation = locationRef.current;
      if (!currentLocation) {
        currentLocation = await getFreshLocation();
        if (currentLocation) setLocation(currentLocation);
      }

      let addressName = "";
      if (currentLocation) {
        addressName = await getAddressFromCoords(currentLocation.lat, currentLocation.lng);
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "accident_upload");
      const res = await fetch("https://api.cloudinary.com/v1_1/dyhgfp2kp/image/upload", { method: "POST", body: formData });
      const uploadData = await res.json();
      if (!uploadData.secure_url) throw new Error("Upload failed");

      const imageUrl = uploadData.secure_url;
      setPhotoUrl(imageUrl);
      await saveScanReport(currentLocation?.lat, currentLocation?.lng, imageUrl);

      const locationLine = currentLocation
        ? `📍 *Location:*\n${addressName}\n\n🗺️ *Google Maps:*\nhttps://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}`
        : `📍 *Location:* GPS unavailable\n🏠 *Address:* ${data?.customer?.address || "N/A"}`;

      const msg =
`🚨 *ACCIDENT ALERT FROM CALL MY FAMILY!*
 🌎 callmyfamily.in

👤 *Name:* ${data?.customer?.name || "Unknown"}
🚗 *Vehicle:* ${data?.customer?.vehicle_number || "N/A"}
🩸 *Blood Group:* ${data?.customer?.blood_group || "N/A"}

${locationLine}

🕐 *Time:* ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}

📸 *Accident Photo:*
${imageUrl}

⚠️ *Please rush immediately!*`;

      setWaMessage(msg);
      toast.success("Ready! Send alerts below 👇");
    } catch (err) {
      console.log("UPLOAD ERROR:", err);
      toast.error("Photo upload failed. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" size={48} /></div>;

  if (error || !data) return (
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

  const { customer, contacts } = data;
  const mapsLink = location ? `https://www.google.com/maps?q=${location.lat},${location.lng}` : null;
  const scanTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto space-y-4">
      <div className="text-center py-4">
        <img src="/logo.png" alt="Call My Family" style={{ width: 330, height: 250 }} className="mx-auto mb-2" />
        <h1 className="text-3xl font-bold text-primary">🚨 EMERGENCY</h1>
        <p className="text-muted-foreground">QR Code: {code}</p>
      </div>

      <Card className="card-shadow border-orange-200 bg-orange-50">
        <CardContent className="p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span>🕐</span><span className="font-medium">Scanned at: {scanTime}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={14} className="text-primary" />
            {location ? (
              <a href={mapsLink!} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">📍 View Live Location on Maps</a>
            ) : locationError ? (
              <span className="text-red-500 text-xs font-medium">⚠️ GPS is off — Please enable Location in Settings</span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Fetching GPS location...</span>
            )}
          </div>
          {locationError && (
            <Button size="sm" className="w-full mt-1 bg-orange-500 hover:bg-orange-600 text-white text-xs" onClick={() => window.location.reload()}>🔄 Reload Page</Button>
          )}
        </CardContent>
      </Card>

      <CallStatusBanner status={callStatus.status} name={callStatus.name} />

      {customer && (
        <Card className="card-shadow">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2"><User size={18} className="text-primary" /><span className="font-bold text-lg">{customer.name}</span></div>
            <div className="flex items-center gap-2"><Car size={18} className="text-muted-foreground" /><span>{customer.vehicle_number}</span></div>
            <div className="flex items-center gap-2"><Droplets size={18} className="text-destructive" /><span>Blood: {customer.blood_group}</span></div>
            {customer.address && <div className="flex items-center gap-2"><MapPin size={18} className="text-muted-foreground" /><span>{customer.address}</span></div>}
          </CardContent>
        </Card>
      )}

      <Card className="card-shadow">
        <CardContent className="p-4 space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2"><Phone size={18} className="text-primary" /> Emergency Contacts</h2>
          {contacts.map((contact: any, i: number) => (
            <div key={contact.id || i} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">{contact.name}</div>
                <div className="text-sm text-muted-foreground">{contact.relationship}</div>
              </div>
              <Button onClick={() => callMutation.mutate({ phone: contact.phone, name: contact.name })} disabled={callMutation.isPending} className="emergency-gradient hover:opacity-90 text-primary-foreground">
                <Phone size={14} className="mr-1" /> Call
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="card-shadow border-blue-200 bg-blue-50">
        <CardContent className="p-4 space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2"><Camera size={18} className="text-blue-600" /> Accident Photo & Alert</h2>
          <p className="text-sm text-muted-foreground">
            Every second counts in an emergency. 📸 Click a photo of the accident — we'll automatically attach the live location & address, so their family reaches in time.
          </p>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
          <Button onClick={() => fileInputRef.current?.click()} disabled={photoUploading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {photoUploading
              ? <><Loader2 size={16} className="animate-spin mr-2" /> Fetching location & uploading...</>
              : <><Camera size={16} className="mr-2" /> 📸 Click Accident Photo</>}
          </Button>
          {photoUrl && (
            <div className="mt-2">
              <img src={photoUrl} alt="Accident" className="w-full rounded-lg border" />
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 size={12} /> Photo saved successfully ✅</p>
            </div>
          )}
          {waMessage && contacts.length > 0 && (
            <div className="mt-3 space-y-2 border-t pt-3">
              <p className="text-sm font-bold text-green-700 text-center">👇 Send WhatsApp alert to each contact:</p>
              {contacts.map((contact: any, i: number) => {
                const phone = contact.phone.replace(/\D/g, "");
                const indiaPhone = phone.startsWith("91") ? phone : `91${phone}`;
                return (
                  <a key={i} href={`https://wa.me/${indiaPhone}?text=${encodeURIComponent(waMessage)}`} target="_blank" rel="noopener noreferrer" className="block">
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white"><Send size={14} className="mr-2" />📲 Send Alert to {contact.name}</Button>
                  </a>
                );
              })}
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

      <Button className="w-full emergency-gradient hover:opacity-90 text-primary-foreground" onClick={() => callMutation.mutate({ phone: MASKED_CALL_NUMBER, name: "Helpline" })}>
        <Phone size={18} className="mr-2" /> Call Helpline ({MASKED_CALL_NUMBER})
      </Button>

      <Card className="card-shadow">
        <CardContent className="p-4">
          <h2 className="font-bold mb-3">Quick Emergency Numbers</h2>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="flex flex-col h-16 border-red-200" onClick={() => window.location.href = "tel:108"}><span className="text-lg">🚑</span><span className="text-xs">Ambulance 108</span></Button>
            <Button variant="outline" className="flex flex-col h-16 border-blue-200" onClick={() => window.location.href = "tel:100"}><span className="text-lg">🚔</span><span className="text-xs">Police 100</span></Button>
            <Button variant="outline" className="flex flex-col h-16 border-orange-200" onClick={() => window.location.href = "tel:101"}><span className="text-lg">🚒</span><span className="text-xs">Fire 101</span></Button>
          </div>
        </CardContent>
      </Card>
      <div className="h-4" />
    </div>
  );
};

export default EmergencyPage;
