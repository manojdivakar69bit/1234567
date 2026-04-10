import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Printer } from "lucide-react";

const PRINT_OPTIONS = ["10", "20", "50", "100", "500", "1000"] as const;

interface Props {
  baseUrl: string;
  printableCount: number;
}

// ✅ Fetch API se Base64 — CORS safe
const imageToBase64ViaFetch = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const openStickerPrintWindow = (codes: string[], bgBase64: string, baseUrl: string) => {
  const stickers = codes.map((code) => {
    const qr = renderToStaticMarkup(
      <QRCodeSVG
        value={`${baseUrl}/emergency/${code}`}
        size={200}
        level="H"
        includeMargin={false}
      />
    );

    return `
    <div class="sticker">
      <img src="${bgBase64}" class="bg-img" />
      <div class="qr-overlay">
        <div class="qr-wrap">${qr}</div>
      </div>
      <div class="code-label">${code}</div>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Premium Stickers - Call My Family</title>
<style>
@page { margin: 0.3cm; size: A4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #111;
  padding: 6px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.sticker {
  position: relative;
  width: 5.8cm;
  height: 7.5cm;
  display: inline-block;
  flex-shrink: 0;
}
.bg-img {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  border-radius: 5px;
  display: block;
}
.qr-overlay {
  position: absolute;
  top: 33%;
  left: 11%;
  width: 82%;
  height: 49%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-wrap {
  width: 90%;
  height: 90%;
  background: white;
  border-radius: 5px;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-wrap svg {
  width: 100% !important;
  height: 100% !important;
  display: block;
}
.code-label {
  position: absolute;
  bottom: 9%;
  left: 0;
  right: 0;
  text-align: center;
  font-family: Arial, sans-serif;
  font-size: 9px;
  font-weight: 900;
  color: #2a1500;
  letter-spacing: 2px;
  text-shadow: 0 1px 1px rgba(255,255,255,0.4);
}
@media print {
  body { background: silver; }
}
</style>
</head>
<body>
${stickers}
<script>
window.onload = () => setTimeout(() => window.print(), 600);
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
};

export default function BulkStickerPrintCard({ baseUrl, printableCount }: Props) {
  const [count, setCount] = useState("10");

  const mutation = useMutation({
    mutationFn: async () => {
      // ✅ Fetch API se Base64
      const bgBase64 = await imageToBase64ViaFetch(`${baseUrl}/sticker-bg.png`);

      const { data, error } = await supabase
        .from("qr_codes")
        .select("code")
        .neq("status", "activated")
        .limit(Number(count));
      if (error) throw error;

      return { codes: data.map((d: any) => d.code), bgBase64 };
    },
    onSuccess: ({ codes, bgBase64 }) => {
      openStickerPrintWindow(codes, bgBase64, baseUrl);
      toast.success("Premium stickers ready!");
    },
    onError: (e: any) => toast.error(`Error: ${e.message}`),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex gap-2 items-center">
          <Printer size={18}/> Print Premium Stickers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Select Count</Label>
          <Select value={count} onValueChange={setCount}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRINT_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o} Stickers</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
          <Printer size={14} className="mr-2"/>
          {mutation.isPending ? "Preparing..." : "Print Premium Stickers"}
        </Button>
        <p className="text-xs text-center text-muted-foreground">Available: {printableCount}</p>
      </CardContent>
    </Card>
  );
}
