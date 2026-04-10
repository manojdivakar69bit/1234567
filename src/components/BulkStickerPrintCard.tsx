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

/* ================== 🔥 PREMIUM PRINT FUNCTION ================== */
const BG_IMAGE = "/sticker-bg.png";
const openStickerPrintWindow = (codes: string[], baseUrl: string) => {

  const stickers = codes.map((code) => {

    const qr = renderToStaticMarkup(
      <QRCodeSVG
        value={`${baseUrl}/emergency/${code}`}
        size={220}
        level="H"
        includeMargin={true}
      />
    );

    return `
    <div class="sticker">
      <div class="card">

        <div class="top">
          <div class="logo">❤️</div>
          <div class="title">Call My Family</div>
          <div class="subtitle">Scan in Emergency<br><span>for Instant Help</span></div>
        </div>

        <div class="qr-frame">
          <div class="qr-inner">${qr}</div>
        </div>

        <div class="code">${code}</div>

        <div class="footer">Protected by CallMyFamily</div>

      </div>
    </div>
    `;
  }).join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
<title>Premium Stickers</title>

<style>
@page { margin: 0.5cm; }

body {
  font-family: Arial;
  background: #111;
  text-align: center;
}

/* STICKER SIZE */
.sticker {
  width: 6cm;
  height: 8cm;
  display: inline-block;
  margin: 0.3cm;
}

/* CARD */
.card {
  width: 100%;
  height: 100%;
  border-radius: 20px;
  padding: 8px;

  background: radial-gradient(circle at top, #1e293b, #020617);

  border: 2px solid gold;

  box-shadow:
    0 0 10px gold,
    0 0 25px #2563eb,
    inset 0 0 20px rgba(255,255,255,0.05);

  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
}

/* TOP */
.logo {
  font-size: 18px;
}

.title {
  color: #facc15;
  font-weight: bold;
  font-size: 14px;
}

.subtitle {
  color: #e2e8f0;
  font-size: 10px;
}

.subtitle span {
  color: #38bdf8;
}

/* QR FRAME */
.qr-frame {
  width: 90%;
  padding: 6px;
  border-radius: 15px;

  background: linear-gradient(145deg, #d4d4d8, #71717a);

  box-shadow:
    inset 0 0 10px rgba(0,0,0,0.6),
    0 0 10px gold,
    0 0 20px #2563eb;
}

.qr-inner {
  background: white;
  border-radius: 10px;
  padding: 5px;
}

.qr-inner svg {
  width: 100% !important;
}

/* CODE */
.code {
  font-weight: bold;
  color: white;
}

/* FOOTER */
.footer {
  font-size: 9px;
  color: #facc15;
}

@media print {
  body { background: white; }
}
</style>

</head>

<body>

${stickers}

<script>
window.onload = () => setTimeout(() => window.print(), 300);
</script>

</body>
</html>
`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
};

/* ================== UI ================== */

export default function BulkStickerPrintCard({ baseUrl, printableCount }: Props) {
  const [count, setCount] = useState("10");

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("code")
        .limit(Number(count));

      if (error) throw error;

      return data.map((d: any) => d.code);
    },

    onSuccess: (codes) => {
      openStickerPrintWindow(codes, baseUrl);
      toast.success("Ready to print 🔥");
    },

    onError: (e: any) => {
      toast.error(e.message);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex gap-2 items-center">
          <Printer size={18}/> Print Stickers
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">

        <div>
          <Label>Select Count</Label>
          <Select value={count} onValueChange={setCount}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRINT_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full"
        >
          <Printer size={14} className="mr-2"/>
          {mutation.isPending ? "Preparing..." : "Print Premium Stickers"}
        </Button>

        <p className="text-xs text-center">
          Available: {printableCount}
        </p>

      </CardContent>
    </Card>
  );
}
