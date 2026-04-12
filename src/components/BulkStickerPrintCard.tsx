import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STICKER_SIZES = {
  small: { 
    w: "5cm", h: "7cm", 
    qrWidth: "4.7cm",
    qrHeight: "3.7cm",
    top: "50%",
    labelBottom: "0.8cm"
  },
  medium: { 
    w: "6.5cm", h: "9cm",
    qrWidth: "4cm",
    qrHeight: "3.7cm",
    qrInternalSize: 110, 
    top: "65%",
    labelBottom: "1.0cm"
  },
  large: { 
    w: "8cm", h: "11cm",
    qrWidth: "4.7cm",
    qrHeight: "3.7cm",
    qrInternalSize: 140, 
    top: "40%",
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

const fetchCodesInRange = async (fromSerial: number, toSerial: number): Promise<string[]> => {
  const BATCH_SIZE = 1000;
  let allCodes: string[] = [];
  let start = fromSerial - 1;
  const end = toSerial - 1;

  while (start <= end) {
    const batchEnd = Math.min(start + BATCH_SIZE - 1, end);
    const { data, error } = await supabase
      .from("qr_codes")
      .select("code")
      .eq("status", "available")
      .order("code", { ascending: true })
      .range(start, batchEnd);

    if (error) throw error;
    if (!data?.length) break;

    allCodes = allCodes.concat(data.map((d: any) => d.code));
    start += BATCH_SIZE;
  }

  return allCodes;
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
    width: ${config.qrWidth};
    height: ${config.qrHeight};
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
    font-size: 8pt;
    font-weight: 800;
    color: #1a365d;
    letter-spacing: 1px;
    background: rgba(255,255,255,0.8);
    padding: 2px 8px;
    border-radius: 3px;
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
  const [fromSerial, setFromSerial] = useState("1");
  const [toSerial, setToSerial] = useState("50");
  const [selectedSize, setSelectedSize] = useState<keyof typeof STICKER_SIZES>("medium");

  const totalRequested = Math.max(0, Number(toSerial) - Number(fromSerial) + 1);

  const mutation = useMutation({
    mutationFn: async () => {
      const from = Number(fromSerial);
      const to = Number(toSerial);

      if (isNaN(from) || isNaN(to) || from < 1 || to < from) {
        throw new Error("Invalid range: 'From' must be less than or equal to 'To'.");
      }

      const bgBase64 = await imageToBase64ViaFetch(`${baseUrl}/sticker-bg.png`);
      const codes = await fetchCodesInRange(from, to);

      if (!codes.length) throw new Error("No available QR codes found in this range!");

      return { codes, bgBase64 };
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
          <label className="text-[10px] font-bold text-slate-500 uppercase">Serial Range</label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[9px] text-slate-400 mb-0.5 block">From #</label>
              <Input
                type="number"
                min="1"
                value={fromSerial}
                onChange={(e) => setFromSerial(e.target.value)}
                className="h-9 text-sm"
                placeholder="1"
              />
            </div>
            <span className="text-slate-400 mt-5">—</span>
            <div className="flex-1">
              <label className="text-[9px] text-slate-400 mb-0.5 block">To #</label>
              <Input
                type="number"
                min="1"
                value={toSerial}
                onChange={(e) => setToSerial(e.target.value)}
                className="h-9 text-sm"
                placeholder="50"
              />
            </div>
          </div>
          {totalRequested > 0 && (
            <p className="text-[10px] text-slate-400">{totalRequested} stickers requested</p>
          )}
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
          disabled={mutation.isPending || totalRequested < 1}
        >
          {mutation.isPending ? "Preparing PDF..." : "Generate & Print"}
        </Button>
      </CardContent>
    </Card>
  );
}
