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

const imageToBase64ViaFetch = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return "";
  }
};

const openStickerPrintWindow = (codes: string[], bgBase64: string, baseUrl: string) => {
  const stickers = codes.map((code) => {
    const qr = renderToStaticMarkup(
      <QRCodeSVG
        value={`${baseUrl}/emergency/${code}`}
        size={256}
        level="H"
        includeMargin={false}
      />
    );

    return `
    <div class="sticker">
      <div class="header">SCAN IN EMERGENCY</div>
      <div class="brand-section">
        <img src="${bgBase64 || ''}" class="brand-logo" alt="logo" />
      </div>
      <div class="qr-container">${qr}</div>
      <div class="code-label">${code}</div>
      <div class="footer">Protected by CallMyFamily</div>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 5mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    background: #f5f5f5;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 6mm;
    padding: 8mm;
  }
  .sticker {
    width: 6.0cm;
    height: 8.0cm;
    background: linear-gradient(180deg, #f8f8f8 0%, #fff 30%, #fff 70%, #f8f8f8 100%);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  }
  .header {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    color: white;
    width: 100%;
    text-align: center;
    padding: 0.2cm 0.2cm;
    font-family: Arial, sans-serif;
    font-weight: 900;
    font-size: 11pt;
    letter-spacing: 2px;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
  }
  .brand-section {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0 0 -25px;
  }
  .brand-logo { 
    height: 150px; 
    width: auto;
    display: block;
  }
  .qr-container {
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 0 12px rgba(66,133,244,0.15);
    margin: 0;
  }
  .qr-container svg { width: 3.3cm !important; height: 3.3cm !important; display: block; }
  .code-label {
    font-family: 'Arial Black', Arial, sans-serif;
    font-size: 13pt;
    font-weight: 900;
    color: #1a365d;
    letter-spacing: 1px;
    margin: 0.08cm 0;
  }
  .footer {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    color: white;
    width: 100%;
    text-align: center;
    padding: 0.15cm;
    font-family: Arial, sans-serif;
    font-size: 8pt;
    font-weight: 600;
    margin-top: auto;
  }
  @media print {
    body { background: white; padding: 0; gap: 4mm; }
    .sticker { box-shadow: none; page-break-inside: avoid; }
  }
</style>
</head>
<body>
${stickers}
<script>
  window.onload = () => setTimeout(() => window.print(), 1000);
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
      const bgBase64 = await imageToBase64ViaFetch(`${baseUrl}/logo.png`);

      const { data, error } = await supabase
        .from("qr_codes")
        .select("code")
        .eq("status", "available")
        .limit(Number(count));
      
      if (error) throw error;
      if (!data?.length) throw new Error("No available QR codes found!");
      return { codes: data.map((d: any) => d.code), bgBase64 };
    },
    onSuccess: ({ codes, bgBase64 }) => {
      openStickerPrintWindow(codes, bgBase64, baseUrl);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Print Premium Stickers</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Select value={count} onValueChange={setCount}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRINT_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o} Stickers</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => mutation.mutate()} className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Preparing..." : "Print Now"}
        </Button>
      </CardContent>
    </Card>
  );
}
