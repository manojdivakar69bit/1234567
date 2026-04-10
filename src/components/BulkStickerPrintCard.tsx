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

const openStickerPrintWindow = (codes: string[], baseUrl: string) => {
  const stickers = codes.map((code) => {
    const qr = renderToStaticMarkup(
      <QRCodeSVG
        value={`${baseUrl}/emergency/${code}`}
        size={220}
        level="H"
        includeMargin={false}
      />
    );

    return `
    <div class="sticker">
      <div class="card">

        <!-- Glow corners -->
        <div class="corner tl"></div>
        <div class="corner tr"></div>
        <div class="corner bl"></div>
        <div class="corner br"></div>

        <!-- Top section: Logo + Title -->
        <div class="top">
          <div class="logo-wrap">
            <img src="${baseUrl}/logo.png" onerror="this.style.display='none'" class="logo-img" />
          </div>
          <div class="title-wrap">
            <div class="title">Call My Family</div>
            <div class="subtitle">Scan in Emergency</div>
          </div>
        </div>

        <!-- Divider glow line -->
        <div class="glow-line"></div>

        <!-- QR Frame -->
        <div class="qr-frame">
          <div class="qr-shine"></div>
          <div class="qr-inner">${qr}</div>
        </div>

        <!-- Code -->
        <div class="code-badge">${code}</div>

        <!-- Footer -->
        <div class="footer-bar">
          <span class="shield">🛡️</span>
          <span class="footer-text">Protected by CallMyFamily</span>
          <span class="shield">🛡️</span>
        </div>

      </div>
    </div>
    `;
  }).join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
<title>Premium Stickers - Call My Family</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Rajdhani:wght@600&display=swap');

@page { margin: 0.4cm; }

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Rajdhani', Arial, sans-serif;
  background: #0a0a0a;
  text-align: center;
  padding: 10px;
}

.sticker {
  width: 6.5cm;
  height: 9cm;
  display: inline-block;
  margin: 0.3cm;
  vertical-align: top;
}

.card {
  width: 100%;
  height: 100%;
  border-radius: 18px;
  padding: 10px 8px 8px;
  position: relative;
  overflow: hidden;

  /* Deep dark premium background */
  background:
    radial-gradient(ellipse at 50% 0%, #1a237e33 0%, transparent 60%),
    radial-gradient(ellipse at 50% 100%, #b7100033 0%, transparent 60%),
    linear-gradient(160deg, #0d1b2a 0%, #0a0a1a 40%, #1a0a0a 100%);

  /* Gold border */
  border: 2.5px solid transparent;
  background-clip: padding-box;
  box-shadow:
    0 0 0 2px #b8860b,
    0 0 0 3.5px #ffd70055,
    0 0 15px #b8860b88,
    0 0 35px #1a1a6688,
    inset 0 0 30px rgba(255,255,255,0.03);

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

/* Shimmer corners */
.corner {
  position: absolute;
  width: 18px;
  height: 18px;
  background: radial-gradient(circle, #ffd700, transparent 70%);
  opacity: 0.9;
}
.tl { top: 6px; left: 6px; }
.tr { top: 6px; right: 6px; }
.bl { bottom: 6px; left: 6px; }
.br { bottom: 6px; right: 6px; }

/* TOP */
.top {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 0 6px;
}

.logo-wrap {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 6px #ffd700aa);
}

.title-wrap {
  text-align: left;
}

.title {
  font-family: 'Cinzel', serif;
  font-size: 13px;
  font-weight: 700;
  color: #ffd700;
  text-shadow:
    0 0 8px #ffd700,
    0 0 20px #ffd70088;
  letter-spacing: 0.5px;
  line-height: 1.2;
}

.subtitle {
  font-size: 9px;
  color: #60a5fa;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-shadow: 0 0 8px #3b82f6aa;
}

/* Glow divider */
.glow-line {
  width: 90%;
  height: 1.5px;
  background: linear-gradient(90deg, transparent, #b8860b, #ffd700, #b8860b, transparent);
  box-shadow: 0 0 6px #ffd700;
  border-radius: 2px;
}

/* QR Frame */
.qr-frame {
  width: 88%;
  padding: 5px;
  border-radius: 14px;
  position: relative;

  background: linear-gradient(145deg, #c0c0c0, #808080, #c0c0c0);

  box-shadow:
    0 0 0 1.5px #b8860b,
    0 0 12px #ffd70077,
    0 0 25px #1a3a8888,
    inset 0 2px 4px rgba(255,255,255,0.4),
    inset 0 -2px 4px rgba(0,0,0,0.5);
}

.qr-shine {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 40%;
  background: linear-gradient(180deg, rgba(255,255,255,0.15), transparent);
  border-radius: 14px 14px 0 0;
  pointer-events: none;
}

.qr-inner {
  background: white;
  border-radius: 10px;
  padding: 6px;
  box-shadow: inset 0 0 8px rgba(0,0,0,0.3);
}

.qr-inner svg {
  width: 100% !important;
  height: auto !important;
  display: block;
}

/* Code badge */
.code-badge {
  font-size: 9px;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 1.5px;
  background: rgba(255,255,255,0.05);
  border: 1px solid #ffd70033;
  border-radius: 20px;
  padding: 2px 10px;
}

/* Footer */
.footer-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 88%;
  padding: 4px 8px;
  border-radius: 20px;
  background: linear-gradient(90deg, #1a1a3a, #0d1b2a, #1a1a3a);
  border: 1px solid #b8860b88;
  box-shadow:
    0 0 8px #ffd70033,
    inset 0 0 8px rgba(255,255,255,0.03);
}

.shield {
  font-size: 10px;
}

.footer-text {
  font-size: 8px;
  font-weight: 600;
  color: #ffd700;
  letter-spacing: 0.5px;
  text-shadow: 0 0 6px #ffd70088;
}

@media print {
  body { background: white; }
  .card {
    box-shadow:
      0 0 0 2px #b8860b,
      0 0 0 3.5px #ffd70055;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
</head>
<body>
${stickers}
<script>
window.onload = () => setTimeout(() => window.print(), 500);
</script>
</body>
</html>
`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
};

export default function BulkStickerPrintCard({ baseUrl, printableCount }: Props) {
  const [count, setCount] = useState("10");

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("code")
        .neq("status", "activated")
        .limit(Number(count));
      if (error) throw error;
      return data.map((d: any) => d.code);
    },
    onSuccess: (codes) => {
      openStickerPrintWindow(codes, baseUrl);
      toast.success("Premium stickers ready! 🔥");
    },
    onError: (e: any) => toast.error(e.message),
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
          {mutation.isPending ? "Preparing..." : "Print Premium Stickers 🔥"}
        </Button>
        <p className="text-xs text-center text-muted-foreground">Available: {printableCount}</p>
      </CardContent>
    </Card>
  );
}
