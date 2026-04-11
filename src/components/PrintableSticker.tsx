import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

interface PrintableStickerProps {
  code: string;
  orgName?: string;
  vehicleNumber?: string;
  bloodGroup?: string;
  baseUrl: string;
  stickerWidth?: number;
  stickerHeight?: number;
  logoUrl?: string;
}

const PrintableSticker = ({
  code,
  baseUrl,
  stickerWidth = 6,
  stickerHeight = 8,
  logoUrl,
}: PrintableStickerProps) => {
  const handlePrint = () => {
    const url = `${baseUrl}/emergency/${code}`;
    const wCm = stickerWidth;
    const hCm = stickerHeight;

    const qrMarkup = renderToStaticMarkup(
      <QRCodeSVG
        value={url}
        size={Math.min(wCm, hCm) * 30}
        level="H"
        includeMargin={false}
        imageSettings={{
          src: `${window.location.origin}/logo.png`,
          x: undefined,
          y: undefined,
          height: 75,
          width: 80,
          excavate: true,
        }}
      />
    );

    const stickerHtml = `<!DOCTYPE html>
<html><head><title>QR Sticker - ${code}</title>
<style>
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
    margin: 0; padding: 0; box-sizing: border-box;
  }
  @page { size: ${wCm}cm ${hCm}cm; margin: 0; }
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
    background: linear-gradient(180deg, #f8f8f8 0%, #ffffff 30%, #ffffff 70%, #f8f8f8 100%);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
    box-shadow: 0 2px 15px rgba(0,0,0,0.1);
    position: relative;
  }
  .header {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    color: white;
    width: 100%;
    text-align: center;
    padding: 0.3cm 0.2cm;
    font-weight: 900;
    font-size: ${Math.max(11, wCm * 2.5)}pt;
    letter-spacing: 2px;
    text-transform: uppercase;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
  }
  .brand-section {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0.25cm 0;
  }
  .brand-logo {
    height: 80px;
    width: auto;
  }
  .brand-name {
    font-size: ${Math.max(14, wCm * 3.2)}pt;
    font-weight: 900;
    color: #1a365d;
    line-height: 1.1;
  }
  .qr-container {
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    padding: 8px;
    box-shadow: 0 0 15px rgba(66, 133, 244, 0.15);
    margin: 0.15cm 0;
  }
  .qr-container svg {
    display: block;
  }
  .code-label {
    font-family: 'Arial Black', Arial, sans-serif;
    font-size: ${Math.max(12, wCm * 2.8)}pt;
    font-weight: 900;
    color: #1a365d;
    letter-spacing: 1px;
    margin: 0.15cm 0;
  }
  .footer {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    color: white;
    width: 100%;
    text-align: center;
    padding: 0.2cm;
    font-size: ${Math.max(7, wCm * 1.3)}pt;
    font-weight: 600;
    letter-spacing: 0.5px;
    margin-top: auto;
  }
  @media print { body { margin: 0; } .sticker { box-shadow: none; } }
</style></head><body>
<div class="sticker">
  <div class="header">Scan in Emergency</div>
  <div class="brand-section">
    <img src="${window.location.origin}/logo.png" class="brand-logo" alt="logo" />
  </div>
  <div class="qr-container">${qrMarkup}</div>
  <div class="code-label">${code}</div>
  <div class="footer">Protected by CallMyFamily</div>
</div>
<script>window.onload = function() { window.print(); }</script>
</body></html>`;

    const blob = new Blob([stickerHtml], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, "_blank");
    if (!printWindow) {
      const fw = window.open("", "_blank");
      if (fw) {
        fw.document.write(stickerHtml);
        fw.document.close();
      } else {
        alert("Please allow popups to print stickers");
      }
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  };

  return (
    <div className="space-y-3">
      <div className="border rounded-xl overflow-hidden shadow-lg max-w-[240px] mx-auto">
        {/* Header */}
        <div className="emergency-gradient text-primary-foreground px-3 py-2 font-black text-sm text-center tracking-widest uppercase">
          Scan in Emergency
        </div>
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 py-2 bg-card">
          <img
            src={logoUrl || "/logo.png"}
            alt="logo"
            className="h-20 w-auto"
          />
        </div>
        {/* QR */}
        <div className="flex justify-center pb-2 bg-card">
          <div className="border-2 border-border rounded-lg p-2 shadow-sm">
            <QRCodeSVG
              value={`${baseUrl}/emergency/${code}`}
              size={140}
              level="H"
              imageSettings={{
                src: logoUrl || "/logo.png",
                x: undefined,
                y: undefined,
                height: 24,
                width: 24,
                excavate: true,
              }}
            />
          </div>
        </div>
        {/* Code */}
        <div className="text-center font-black text-lg tracking-wider pb-2 bg-card" style={{ color: 'hsl(var(--navy))' }}>
          {code}
        </div>
        {/* Footer */}
        <div className="emergency-gradient text-primary-foreground px-3 py-1.5 text-center text-xs font-semibold tracking-wide">
          Protected by CallMyFamily
        </div>
      </div>
      <Button variant="outline" className="w-full" onClick={handlePrint}>
        <Printer size={14} className="mr-1" /> Print Sticker
      </Button>
    </div>
  );
};

export default PrintableSticker;
