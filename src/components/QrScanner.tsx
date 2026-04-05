import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface QrScannerProps {
  onScan: (code: string) => void;
}

const QrScanner = ({ onScan }: QrScannerProps) => {
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const stopScanning = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch (e) {
      console.warn("Scanner stop error:", e);
    }
    scannerRef.current = null;
    if (mountedRef.current) {
      setScanning(false);
    }
  }, []);

  const startScanning = async () => {
    setScanning(true);
    const { Html5Qrcode } = await import("html5-qrcode");
    await new Promise((resolve) => setTimeout(resolve, 100));
    const readerEl = document.getElementById("qr-reader");
    if (!readerEl) { setScanning(false); return; }

    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText: string) => {
          const match = decodedText.match(/emergency\/(EMR-\d+)/);
          const code = match ? match[1] : decodedText;
          onScan(code);
          stopScanning();
        },
        () => {}
      );
    } catch (err) {
      console.error("Camera error:", err);
      if (mountedRef.current) setScanning(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      {!scanning ? (
        <Button variant="outline" className="w-full" onClick={startScanning}>
          <Camera className="mr-2" size={18} /> Scan QR with Camera
        </Button>
      ) : (
        <div className="space-y-2">
          <div id="qr-reader" className="rounded-lg overflow-hidden" />
          <Button variant="outline" className="w-full" onClick={stopScanning}>
            <X className="mr-2" size={18} /> Stop Scanner
          </Button>
        </div>
      )}
    </div>
  );
};

export default QrScanner;
