import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Printer } from "lucide-react";

const PRINT_OPTIONS = ["10", "20", "50", "100", "500", "1000"] as const;

const SIZE_PRESETS = [
  { label: "3×4 cm", w: 3, h: 4 },
  { label: "4×6 cm", w: 4, h: 6 },
  { label: "6×8 cm", w: 6, h: 8 },
  { label: "8×10 cm", w: 8, h: 10 },
  { label: "Custom", w: 0, h: 0 },
];

interface BulkStickerPrintCardProps {
  baseUrl: string;
  printableCount: number;
}

/* 🔥 PREMIUM PRINT WINDOW */
const openStickerPrintWindow = (codes: string[], baseUrl: string, wCm: number, hCm: number) => {
  const qrSize = Math.min(wCm, hCm) * 0.65;

  const stickersMarkup = codes
    .map((code) => {
      const qrMarkup = renderToStaticMarkup(
        <QRCodeSVG value={`${baseUrl}/emergency/${code}`} size={qrSize * 28} level="H" />
      );

      return `
        <div class="sticker">
          
          <div class="header">
            <div class="logo">🚨</div>
            <div class="title">Call My Family</div>
          </div>

          <div class="scan-text">SCAN IN EMERGENCY</div>

          <div class="qr-box">${qrMarkup}</div>

          <div class="code">${code}</div>

          <div class="footer">Instant Help • Secure</div>

        </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<title>Premium QR Stickers</title>

<style>
@page { margin: 0.5cm; }

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: Arial;
  background: #ffffff;
}

/* GRID */
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5cm;
  justify-content: center;
}

/* 🔥 PREMIUM STICKER */
.sticker {
  width: ${wCm}cm;
  height: ${hCm}cm;
  border-radius: 14px;
  background: linear-gradient(145deg, #0f172a, #020617);
  color: white;
  padding: 0.3cm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  page-break-inside: avoid;

  box-shadow:
    0 0 10px #1e3a8a,
    0 0 20px #2563eb;
}

/* GOLD BORDER */
.sticker::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 14px;
  background: linear-gradient(45deg, gold, orange, gold);
  z-index: -1;
}

/* HEADER */
.header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.logo {
  font-size: ${Math.max(10, wCm * 3)}px;
}

.title {
  font-size: ${Math.max(7, wCm * 1.8)}pt;
  font-weight: bold;
}

/* SCAN TEXT */
.scan-text {
  text-align: center;
  font-size: ${Math.max(5, wCm * 1.2)}pt;
  color: #38bdf8;
  letter-spacing: 1px;
}

/* QR BOX */
.qr-box {
  background: white;
  padding: 0.2cm;
  border-radius: 10px;

  box-shadow:
    0 0 10px #0ea5e9,
    0 0 20px #2563eb;
}

/* CODE */
.code {
  text-align: center;
  font-size: ${Math.max(7, wCm * 1.6)}pt;
  font-weight: bold;
  letter-spacing: 1px;
}

/* FOOTER */
.footer {
  text-align: center;
  font-size: ${Math.max(4, wCm * 1)}pt;
  opacity: 0.8;
}

/* PRINT BTN */
.no-print {
  text-align: center;
  margin: 10px;
}

button {
  padding: 10px 25px;
  font-size: 16px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

@media print {
  .no-print { display: none; }
}
</style>

</head>

<body>

<div class="no-print">
  <button onclick="window.print()">🖨️ Print Stickers</button>
</div>

<div class="grid">
${stickersMarkup}
</div>

<script>
setTimeout(() => { window.print(); }, 500);
</script>

</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
};

/* COMPONENT */
const BulkStickerPrintCard = ({ baseUrl, printableCount }: BulkStickerPrintCardProps) => {
  const [selectedCount, setSelectedCount] = useState("10");
  const [sizePreset, setSizePreset] = useState("6×8 cm");
  const [customW, setCustomW] = useState("6");
  const [customH, setCustomH] = useState("8");

  const isCustom = sizePreset === "Custom";
  const currentSize = isCustom
    ? { w: parseFloat(customW) || 6, h: parseFloat(customH) || 8 }
    : SIZE_PRESETS.find((s) => s.label === sizePreset) || { w: 6, h: 8 };

  const printMutation = useMutation({
    mutationFn: async (count: string) => {
      const limit = Number(count);

      const { data, error } = await supabase
        .from("qr_codes")
        .select("code")
        .in("status", ["available", "assigned"])
        .order("code")
        .limit(limit);

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("No QR codes available");

      return { requested: limit, codes: data.map((d: any) => d.code) };
    },

    onSuccess: async ({ requested, codes }) => {
      openStickerPrintWindow(codes, baseUrl, currentSize.w, currentSize.h);

      await supabase.from("print_history").insert({
        printed_by: localStorage.getItem("cmf_email") || "unknown",
        count: codes.length,
        code_from: codes[0],
        code_to: codes[codes.length - 1],
      });

      toast.success(`${codes.length} stickers ready`);
    },

    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex gap-2 items-center">
          <Printer size={18} /> Print Premium Stickers
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">

        <Select value={selectedCount} onValueChange={setSelectedCount}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRINT_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          className="w-full"
          onClick={() => printMutation.mutate(selectedCount)}
        >
          Print Stickers
        </Button>

      </CardContent>
    </Card>
  );
};

export default BulkStickerPrintCard;
