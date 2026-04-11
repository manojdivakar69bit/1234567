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
    // 1. Logo SVG ko as markup define karein
    const familyLogoSvg = `
      <svg viewBox="0 0 100 100" class="logo-svg">
        <circle cx="50" cy="50" r="48" fill="#e32626"/>
        <path d="M50,15 A15,15 0 0,1 65,30 A15,15 0 0,1 50,45 A15,15 0 0,1 35,30 A15,15 0 0,1 50,15 Z" fill="white"/>
        <path d="M50,48 A22,22 0 0,1 72,70 L28,70 A22,22 0 0,1 50,48 Z" fill="white"/>
        <path d="M22,50 A10,10 0 0,1 32,60 L12,60 A10,10 0 0,1 22,50 Z" fill="white"/>
        <path d="M78,50 A10,10 0 0,1 88,60 L68,60 A10,10 0 0,1 78,50 Z" fill="white"/>
        <path d="M50,5 A5,5 0 0,1 55,10 L45,10 A5,5 0 0,1 50,5 Z" fill="white"/>
      </svg>
    `;

    // 2. Logo and text with heart inline markup
    const logoAndText = `
      <div class="logo-area">
        <div class="logo-pin">
          ${familyLogoSvg}
          <div class="pin-shadow"></div>
        </div>
        <div class="title-text">
          <span class="call-text">Call My</span>
          <span class="family-text">Family<span class="heart-text">❤</span></span>
        </div>
      </div>
    `;

    // 3. QR code with its glow wrap
    const qrMarkup = renderToStaticMarkup(
      <QRCodeSVG
        value={`${baseUrl}/emergency/${code}`}
        size={250}
        level="M"
        includeMargin={false}
      />
    );

    const qrWithGlow = `<div class="qr-container-glow">${qrMarkup}</div>`;

    // 4. Return the full HTML structure for one sticker
    return `
    <div class="sticker-card">
      <div class="top-emergency-bar">SCAN IN EMERGENCY</div>
      ${logoAndText}
      ${qrWithGlow}
      <div class="emr-id-text">${code}</div>
      <div class="protected-bar">Protected by CallMyFamily</div>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Print Call My Family Stickers</title>
<style>
  @page { margin: 0.3cm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #e0e0e0;
    padding: 10px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-family: 'Inter', 'Roboto', Helvetica, Arial, sans-serif;
  }
  .sticker-card {
    position: relative;
    width: 6.8cm;
    height: 8.8cm;
    background: white;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }
  
  /* Emergency Bar */
  .top-emergency-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 14%;
    background: #e32626; /* Specific red */
    color: white;
    text-align: center;
    font-size: 20px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0.5px;
  }

  /* Logo Area */
  .logo-area {
    position: absolute;
    top: 17.5%;
    left: 10%;
    right: 10%;
    display: flex;
    align-items: center;
    gap: 15px;
  }
  .logo-pin {
    width: 60px;
    height: 60px;
    position: relative;
  }
  .logo-svg {
    width: 100%;
    height: 100%;
  }
  .pin-shadow {
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: 8px;
    background: rgba(3, 102, 214, 0.4);
    border-radius: 50%;
  }
  .title-text {
    color: #1a1a1a;
    display: flex;
    flex-direction: column;
    font-weight: 800;
  }
  .call-text {
    font-size: 32px;
    margin-bottom: -5px;
  }
  .family-text {
    font-size: 36px;
    color: #1a1a1a;
    position: relative;
  }
  .heart-text {
    color: #e32626;
    margin-left: 3px;
    font-size: 0.8em;
  }

  /* QR Area */
  .qr-container-glow {
    position: absolute;
    top: 55%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 62%;
    aspect-ratio: 1/1;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border-radius: 8px;
    box-shadow: 0 0 15px 3px rgba(59, 130, 246, 0.4); /* Blueish glow matching image */
  }
  .qr-container-glow svg {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }

  /* EMR ID */
  .emr-id-text {
    position: absolute;
    bottom: 12%;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 22px;
    font-weight: 800;
    color: #1a1a1a;
    letter-spacing: 1px;
  }

  /* Protected Bar */
  .protected-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 10%;
    background: #fdf2f2; /* Pale red matching image */
    color: #cc2525;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 13px;
  }

  @media print {
    body { background: none; padding: 0; }
    .sticker-card { box-shadow: none; border: 0.1px solid #eee; }
  }
</style>
</head>
<body>
${stickers}
<script>
  window.onload = () => {
    setTimeout(() => {
      window.print();
    }, 800);
  };
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const printWin = window.open(url, "_blank");
  if (!printWin) {
    toast.error("Please allow popups to print stickers");
  }
};

export default function BulkStickerPrintCard({ baseUrl, printableCount }: Props) {
  const [count, setCount] = useState("10");

  const mutation = useMutation({
    mutationFn: async () => {
      // 1. Database se non-activated codes lein
      const { data, error } = await supabase
        .from("qr_codes")
        .select("code")
        .neq("status", "activated")
        .limit(Number(count));
      
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("No available QR codes found");

      return { codes: data.map((d: any) => d.code) };
    },
    onSuccess: ({ codes }) => {
      openStickerPrintWindow(codes, baseUrl);
      toast.success(`${codes.length} Stickers are ready for printing!`);
    },
    onError: (e: any) => toast.error(`Error: ${e.message}`),
  });

  return (
    <Card className="border-2 border-primary/10 shadow-md">
      <CardHeader>
        <CardTitle className="flex gap-2 items-center text-xl">
          <Printer className="text-primary" size={24}/> 
          Generate Print-Ready Stickers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sticker-count">How many stickers do you need to print?</Label>
          <Select value={count} onValueChange={setCount}>
            <SelectTrigger id="sticker-count">
              <SelectValue placeholder="Select quantity" />
            </SelectTrigger>
            <SelectContent>
              {PRINT_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o} Stickers</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={() => mutation.mutate()} 
          disabled={mutation.isPending} 
          className="w-full py-6 text-lg font-bold"
        >
          {mutation.isPending ? (
            "Creating Print Layout..."
          ) : (
            <>
              <Printer size={20} className="mr-2"/>
              Generate Print Layout
            </>
          )}
        </Button>

        <div className="flex justify-between items-center px-2 py-1 bg-muted rounded-md mt-2">
          <span className="text-sm font-medium">Ready in Database:</span>
          <span className="text-sm font-bold text-primary">{printableCount}</span>
        </div>
      </CardContent>
    </Card>
  );
}
