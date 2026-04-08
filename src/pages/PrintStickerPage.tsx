import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PrintableSticker from "@/components/PrintableSticker";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const PrintStickerPage = () => {
  const { code } = useParams<{ code: string }>();
  const baseUrl = window.location.origin;

  const { data, isLoading, error } = useQuery({
    queryKey: ["print-sticker", code],
    queryFn: async () => {
      const { data: qr, error: qrError } = await supabase
        .from("qr_codes")
        .select("id, code, status, user_id")
        .eq("code", code!)
        .maybeSingle();
      if (qrError) throw qrError;
      if (!qr) throw new Error("QR code not found");

      const { data: customer } = await supabase
        .from("customers")
        .select("vehicle_number, blood_group")
        .eq("qr_code_id", qr.id)
        .maybeSingle();

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name"logo_url")
        .eq("id", qr.user_id)
        .maybeSingle();

      return { qr, customer, profile };
    },
    enabled: !!code,
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  console.log("PROFILE DATA:", data?.profile);

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="mx-auto text-destructive" size={48} />
            <h2 className="text-xl font-bold">Sticker Not Found</h2>
            <p className="text-muted-foreground">This QR code does not exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <PrintableSticker
        code={data.qr.code}
        baseUrl={baseUrl}
        orgName={data.profile?.full_name || "Call My Family 👍"}
        logoUrl={data.profile?.logo_url}   //
      />
    </div>
  );
};

export default PrintStickerPage;
