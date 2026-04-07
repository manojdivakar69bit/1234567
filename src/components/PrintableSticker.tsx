import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

interface PrintableStickerProps {
  code: string;
  vehicleNumber?: string;
  bloodGroup?: string;
  baseUrl: string;
  stickerWidth?: number;
  stickerHeight?: number;
}

const PrintableSticker = ({ code, baseUrl, stickerWidth = 6, stickerHeight = 8 }: PrintableStickerProps) => {
  const handlePrint = () => {
    const url = `${baseUrl}/emergency/${code}`;
    const wCm = stickerWidth;
    const hCm = stickerHeight;

    const qrMarkup = renderToStaticMarkup(
      <QRCodeSVG 
        value={url} 
        size={Math.min(wCm, hCm) * 27} 
        level="H" 
        includeMargin={true} 
      />
    );

    const stickerHtml = `<!DOCTYPE html>
<html><head><title>QR Sticker - ${code}</title>
<<style>
/* ==================== COLOR PRINT FIX ==================== */
  * { 
    -webkit-print-color-adjust: exact !important; 
    print-color-adjust: exact !important; 
    color-adjust: exact !important; 
  }
  /* ======================================================= */

  @page { size: ${wCm}cm ${hCm}cm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { 
    font-family: Arial, sans-serif; 
    display: flex; 
    justify-content: center; 
    align-items: center; 
    min-height: 100vh; 
    background: white;
  }
  .sticker { 
    width: ${wCm}cm; 
    height: ${hCm}cm; 
    border: 1px solid #ddd; 
    display: flex; 
    flex-direction: column; 
    align-items: center; 
    padding: 0.35cm; 
    background: white;
  }
  .header { 
    background: #dc2626; 
    color: white; 
    width: 100%; 
    text-align: center; 
    padding: 0.25cm 0.2cm; 
    font-weight: bold; 
    font-size: ${Math.max(9.5, wCm * 2.3)}pt; 
    border-radius: 6px;
    display: flex; 
    align-items: center; 
    justify-content: center; 
    gap: 8px;
    margin-bottom: 0.35cm;
  }
  .header img { 
    height: 26px; 
    width: auto; 
    background: white; 
    border-radius: 4px; 
    padding: 3px; 
  }
  .scan-text { 
    font-size: ${Math.max(7.5, wCm * 1.35)}pt; 
    color: #444; 
    text-transform: uppercase; 
    letter-spacing: 1.3px; 
    margin-bottom: 0.4cm;
    font-weight: 500;
  }
  .qr { 
    flex: 1; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    margin: 0.1cm 0;
  }
  .code { 
    font-family: monospace; 
    font-size: ${Math.max(9.5, wCm * 2.1)}pt; 
    font-weight: bold; 
    color: #222; 
    margin: 0.25cm 0 0.15cm 0;
  }
  .footer { 
    background: #dc2626; 
    color: white; 
    width: 100%; 
    text-align: center; 
    padding: 0.18cm; 
    font-size: ${Math.max(6, wCm * 1.15)}pt; 
    border-radius: 6px;
    margin-top: 0.2cm;
  }
  @media print { 
    body { margin: 0; } 
  }
</style></head><body>
<div class="sticker">
  <div class="header"><img src="${window.location.origin}/logo.png" alt="logo" /><span>Call My Family 👍</span></div>
  <div class="scan-text">SCAN IN EMERGENCY</div>
  <div class="qr">${qrMarkup}</div>
  <div class="code">${code}</div>
  <div class="footer">Protected by CallMyFamily</div>
</div>
<script>window.onload = function() { window.print(); }</script>
</body></html>`;

    const blob = new Blob([stickerHtml], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, "_blank");
    if (!printWindow) {
      // Fallback: try with document.write
      const fw = window.open("", "_blank");
      if (fw) {
        fw.document.write(stickerHtml);
        fw.document.close();
      } else {
        alert("Please allow popups to print stickers");
      }
    }
    // Clean up blob URL after a delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  };

  return (
    <div className="space-y-3">
      <div className="border rounded-lg p-4 text-center space-y-2">
        <div className="bg-primary text-primary-foreground px-3 py-1 rounded font-bold text-sm flex items-center justify-center gap-2"><img src="/logo.png" alt="logo" className="h-5 w-auto bg-white rounded p-0.5" /><span>Call My Family 👍</span></div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">SCAN IN EMERGENCY</div>
        <div className="flex justify-center">
          <QRCodeSVG value={`${baseUrl}/emergency/${code}`} size={120} level="H" />
        </div>
        <div className="font-mono font-bold">{code}</div>
        <div className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs">Protected by CallMyFamily</div>
      </div>
      <Button variant="outline" className="w-full" onClick={handlePrint}>
        <Printer size={14} className="mr-1" /> Print Sticker
      </Button>
    </div>
  );
};

export default PrintableSticker;
