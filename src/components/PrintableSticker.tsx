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
      <QRCodeSVG value={url} size={Math.min(wCm, hCm) * 25} level="H" />
    );

    const stickerHtml = `<!DOCTYPE html>
<html><head><title>QR Sticker - ${code}</title>
<style>
  @page { size: ${wCm}cm ${hCm}cm; margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .sticker { width: ${wCm}cm; height: ${hCm}cm; border: 1px solid #ddd; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 0.3cm; }
  .header { background: #dc2626; color: white; width: 100%; text-align: center; padding: 0.2cm; font-weight: bold; font-size: ${Math.max(8, wCm * 2)}pt; border-radius: 4px;display: flex; align-items: center; justify-content: center; gap: 6px; }
  .header img { height: 20px; width: auto; background: white; border-radius: 3px; padding: 2px; }
  .scan-text { font-size: ${Math.max(6, wCm * 1.2)}pt; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .qr { flex: 1; display: flex; align-items: center; justify-content: center; }
  .code { font-family: monospace; font-size: ${Math.max(8, wCm * 1.8)}pt; font-weight: bold; color: #333; }
  .footer { background: #dc2626; color: white; width: 100%; text-align: center; padding: 0.15cm; font-size: ${Math.max(5, wCm * 1)}pt; border-radius: 4px; }
  @media print { body { margin: 0; } .no-print { display: none; } }
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
