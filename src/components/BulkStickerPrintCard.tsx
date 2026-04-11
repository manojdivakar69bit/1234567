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

// Image fetch function
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
<style>
  @page { margin: 5mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #f5f5f5;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 8mm;
    padding: 10mm;
    -webkit-print-color-adjust: exact;
  }
  .sticker {
    position: relative;
    width: 6.0cm;
    height: 7.8cm;
    background: white;
    border-radius: 4px;
    overflow: hidden;
  }
  .bg-img {
    width: 100%;
    height: 100%;
    object-fit: fill;
    display: block;
  }
  .qr-overlay {
    position: absolute;
    top: 42.8%; /* QR ke dabbe ka center */
    left: 50%;
    transform: translate(-50%, -50%);
    width: 55%; /* QR ki width */
    aspect-ratio: 1/1;
    background: white;
    padding: 6px;
    border-radius: 8px;
    box-shadow: 0 0 12px rgba(66, 133, 244, 0.5); /* Blue glow */
  }
  .qr-wrap svg {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }
  .code-label {
    position: absolute;
    bottom: 12.5%; /* ID number ki sahi jagah */
    left: 0;
    right: 0;
    text-align: center;
    font-family: Arial, sans-serif;
    font-size: 22px;
    font-weight: 900;
    color: #1a365d;
    letter-spacing: 0.5px;
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
      // ✅ 1. Background image (sticker-bg.png) uthao
      // Make sure aapke public folder me sticker-bg.png wahi ho jo aapne screenshot me dikhayi hai
      const bgBase64 = await imageToBase64ViaFetch(`${baseUrl}/sticker-bg.png`);
      
      if (!bgBase64) throw new Error("sticker-bg.png not found in public folder!");

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
