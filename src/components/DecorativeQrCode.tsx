import { QRCodeSVG } from "qrcode.react";
import { Phone } from "lucide-react";

const DecorativeQrCode = () => {
  return (
    <div className="relative inline-block">
      <QRCodeSVG value="https://callmyfamily.in" size={80} level="M" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Phone className="text-primary" size={20} />
      </div>
    </div>
  );
};

export default DecorativeQrCode;
