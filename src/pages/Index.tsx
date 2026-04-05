import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, ScanLine, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import DecorativeQrCode from "@/components/DecorativeQrCode";

const TAGLINE_LINE1 = "Every Life Matters. Every Second Counts.";
const TAGLINE_LINE2 = "Just Scan and Call.";

const useTypewriter = (text: string, speed = 50, startDelay = 0) => {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const delayTimer = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(delayTimer);
  }, [startDelay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, started]);

  return { displayed, done, started };
};

const Index = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  const line1 = useTypewriter(TAGLINE_LINE1, 45, 800);
  const line2 = useTypewriter(TAGLINE_LINE2, 45, 800 + TAGLINE_LINE1.length * 45 + 300);
  const allTyped = line1.done && line2.done;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      {/* Logo */}
      <div className={`transition-all duration-700 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <img src="/logo.png" alt="Call My Family" </ className="w-32 h-32 object-contain mx-auto mb-2" />
      </div>

      {/* Tagline */}
      <div className="text-center mb-6 min-h-[3.5rem]">
        <div className="text-lg font-semibold text-foreground">
          {line1.started && line1.displayed}
          {line1.started && !line1.done && <span className="animate-blink">|</span>}
        </div>
        <div className="text-lg font-semibold text-primary">
          {line2.started && line2.displayed}
          {line2.started && !allTyped && <span className="animate-blink">|</span>}
        </div>
      </div>

      {/* Content area */}
      <div className={`w-full max-w-md space-y-6 transition-all duration-700 delay-300 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        {/* QR Code - small */}
        <div className="flex justify-center">
          <DecorativeQrCode />
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center card-shadow"><CardContent className="p-3"><Shield className="mx-auto mb-1 text-primary" size={28} /><span className="text-xs font-medium">Secure</span></CardContent></Card>
          <Card className="text-center card-shadow"><CardContent className="p-3"><ScanLine className="mx-auto mb-1 text-primary" size={28} /><span className="text-xs font-medium">Quick Scan</span></CardContent></Card>
          <Card className="text-center card-shadow"><CardContent className="p-3"><Phone className="mx-auto mb-1 text-primary" size={28} /><span className="text-xs font-medium">Call Family</span></CardContent></Card>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <Button asChild className="flex-1 emergency-gradient hover:opacity-90 text-primary-foreground"><Link to="/login?role=admin">Admin Panel</Link></Button>
          <Button asChild variant="outline" className="flex-1"><Link to="/login?role=agent">Agent Panel</Link></Button>
        </div>

        {/* Privacy */}
        <div className="text-center">
          <Link to="/privacy" className="text-xs text-muted-foreground underline">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
