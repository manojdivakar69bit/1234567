import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const PRINT_OPTIONS = ["10", "20", "50", "100", "500", "1000"] as const;

// ✅ Optimized Positions: Top value kam karne se QR upar jayega
const STICKER_SIZES = {
  small: { 
    w: "5cm", h: "7cm", 
    qrParentSize: "2.8cm",
    qrWidth: "4.7cm",
    qrHeight: "3.7cm",
    top: "50%",       // Pehle 90% tha (Bahut niche), ab upar hai
    labelBottom: "0.8cm"
  },
  medium: { 
    w: "6.5cm", h: "9cm",
    qrWidth: "5.3cm",
    qrHeight: "3.7cm",
    qrInternalSize: 110, 
    top: "65%",       // Pehle 43% tha
    labelBottom: "1.0cm"
  },
  large: { 
    w: "8cm", h: "11cm",
    qrWidth: "4.7cm",
    qrHeight: "3.7cm",
    qrInternalSize: 140, 
    top: "40%",       // Pehle 45% tha
    labelBottom: "1.2cm"
  }
};

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

const openStickerPrintWindow = (codes: string[], bgBase64: string, baseUrl: string, sizeKey: keyof typeof STICKER_SIZES) => {
  const config = STICKER_SIZES[sizeKey];

  const stickers = codes.map((code) => {
    const qr = renderToStaticMarkup(
      <QRCodeSVG
        value={`${baseUrl}/emergency/${code}`}
        size={config.qrInternalSize}
        level="H"
        includeMargin={false}
      />
    );

    return `
    <div class="sticker">
      <div class="qr-area">${qr}</div>
      <div class="code-label">${code}</div>
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
    gap: 4mm;
    padding: 5mm;
  }
  .sticker {
    width: ${config.w};
    height: ${config.h};
    background-image: url('${bgBase64}');
    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-position: center;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    overflow: hidden;
    background-color: white;
    border: 0.1px solid #eee;
  }
  .qr-area {
    position: absolute;
    top: ${config.top};
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 8px;
    padding: 6px;
    width: ${config.qrParentSize};
    height: ${config.qrParentSize};
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  .qr-area svg {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }
  .code-label {
    position: absolute;
    bottom: ${config.labelBottom};
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Arial Black', Gadget, sans-serif;
    font-size: 10pt;
    font-weight: 900;
    color: #1a365d;
    letter-spacing: 1px;
    background: rgba(255,255,255,0.8);
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;
  }
  @media print {
    body { background: white; padding: 0; gap: 2mm; }
    .sticker { box-shadow: none; page-break-inside: avoid; border: none; }
  }
</style>
</head>
<body>
${stickers}
<script>
  window.onload = () => {
    setTimeout(() => {
      window.print();
    }, 1000);
  };
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    toast.error("Please allow popups to print stickers");
  }
};

export default function BulkStickerPrintCard({ baseUrl, printableCount }: Props) {
  const [count, setCount] = useState("10");
  const [selectedSize, setSelectedSize] = useState<keyof typeof STICKER_SIZES>("medium"); 

  const mutation = useMutation({
    mutationFn: async () => {
      const bgBase64 = await imageToBase64ViaFetch(`${baseUrl}/sticker-bg.png`);
      
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
      openStickerPrintWindow(codes, bgBase64, baseUrl, selectedSize);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-bold text-slate-700">Print Bulk Stickers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Quantity</label>
          <Select value={count} onValueChange={setCount}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRINT_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o} Stickers</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Sticker Size</label>
          <Select value={selectedSize} onValueChange={(val: any) => setSelectedSize(val)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small (5x7 cm)</SelectItem>
              <SelectItem value="medium">Medium (6.5x9 cm)</SelectItem>
              <SelectItem value="large">Large (8x11 cm)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={() => mutation.mutate()} 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold" 
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Preparing PDF..." : "Generate & Print"}
        </Button>
      </CardContent>
    </Card>
  );
}
