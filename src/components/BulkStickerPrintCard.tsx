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
  } catch (error) {
    console.error("Image fetch error:", error);
    return "";
  }
};

const openStickerPrintWindow = (codes: string[], bgBase64: string, baseUrl: string) => {
  const stickers = codes.map((code) => {
    const qr = renderToStaticMarkup(
      <QRCodeSVG
        value={`${baseUrl}/emergency/${code}`}
        size={250}
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
<title>Print Stickers - Call My Family</title>
<style>
  @page { margin: 0.5cm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #f0f0f0;
    padding: 10px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 15px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sticker {
    position: relative;
    width: 6.5cm;  /* Standard Sticker Size */
    height: 8.5cm;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  }
  .bg-img {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
  }
  .qr-overlay {
    position: absolute;
    top: 43.5%; /* Adjust based on your background image's white box */
    left: 50%;
    transform: translate(-50%, -50%);
    width: 62%;
    aspect-ratio: 1/1;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    padding: 6px;
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.3); /* Soft blue glow like image */
  }
  .qr-wrap {
    width: 100%;
    height: 100%;
  }
  .qr-wrap svg {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }
  .code-label {
    position: absolute;
    bottom: 12.8%; /* Matches the "EMR-XXXX" position */
    left: 0;
    right: 0;
    text-align: center;
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 20px;
    font-weight: 800;
    color: #1e3a8a; /* Dark Blue */
    letter-spacing: 1px;
  }
  @media print {
    body { background: none; padding: 0; }
    .sticker { box-shadow: none; border: 0.1px solid #eee; }
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
      // 1. Image ko base64 mein convert karein taaki print window mein dikhe
      const bgBase64 = await imageToBase64ViaFetch(`${baseUrl}/sticker-bg.png`);
      
      if (!bgBase64) {
        throw new Error("Background image (sticker-bg.png) not found in public folder");
      }

      // 2. Database se non-activated codes lein
      const { data, error } = await supabase
        .from("qr_codes")
        .select("code")
        .neq("status", "activated")
        .limit(Number(count));
      
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("No available QR codes found");

      return { codes: data.map((d: any) => d.code), bgBase64 };
    },
    onSuccess: ({ codes, bgBase64 }) => {
      openStickerPrintWindow(codes, bgBase64, baseUrl);
      toast.success(`${codes.length} Stickers ready for printing!`);
    },
    onError: (e: any) => toast.error(`Error: ${e.message}`),
  });

  return (
    <Card className="border-2 border-primary/10 shadow-lg">
      <CardHeader>
        <CardTitle className="flex gap-2 items-center text-xl">
          <Printer className="text-primary" size={24}/> 
          Print Premium Stickers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sticker-count">How many stickers to print?</Label>
          <Select value={count} onValueChange={setCount}>
            <SelectTrigger id="sticker-count">
              <SelectValue placeholder="Select count" />
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
            "Generating Files..."
          ) : (
            <>
              <Printer size={20} className="mr-2"/>
              Generate Print Layout
            </>
          )}
        </Button>

        <div className="flex justify-between items-center px-2 py-1 bg-muted rounded-md">
          <span className="text-sm font-medium">Ready in Database:</span>
          <span className="text-sm font-bold text-primary">{printableCount}</span>
        </div>
      </CardContent>
    </Card>
  );
}
