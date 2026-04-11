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
const STICKER_SIZES = {
  small: { w: "5cm", h: "7cm", qrSize: "2.5cm", top: "60%" },
  medium: { w: "6.5cm", h: "9cm", qrSize: "3.2cm", top: "65%" }, // Default
  large: { w: "8cm", h: "11cm", qrSize: "4.5cm", top: "68%" }
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

const openStickerPrintWindow = (codes: string[], bgBase64: string, baseUrl: string) => {
  const stickers = codes.map((code) => {
    const qr = renderToStaticMarkup(
      <QRCodeSVG
        value={`${baseUrl}/emergency/${code}`}
        size={300}
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
    gap: 2mm;
    padding: 3mm;
  }
  .sticker {
    width: 6.5cm;
    height: 9cm;
    background-image: url('${bgBase64}');
    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-position: center;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    position: relative;
    overflow: hidden;
  }
  .qr-area {
    position: absolute;
    top: 65%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 8px;
    padding: 4px;
    width: 4cm;
    height: 3.7cm;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .qr-area svg {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }
  .code-label {
    position: absolute;
    bottom: 0.78cm;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Arial Black', Arial, sans-serif;
    font-size: 13pt;
    font-weight: 900;
    color: #1a365d;
    letter-spacing: 1px;
    white-space: nowrap;
  }
  @media print {
    body { background: white; padding: 0; gap: 3mm; }
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
