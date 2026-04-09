import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface RazorpayPaymentOptions {
  amount: number;
  customerName: string;
  onSuccess: (paymentId: string, orderId: string) => void;
  onError?: (error: string) => void;
}

export function useRazorpayCheckout() {
  const initiatePayment = useCallback(async (options: RazorpayPaymentOptions) => {
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      toast.error("Failed to load Razorpay SDK");
      options.onError?.("Failed to load Razorpay SDK");
      return;
    }

    try {
      // Create order via edge function
      const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
        body: {
          amount: options.amount,
          customer_name: options.customerName,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.order_id) throw new Error("Failed to create order");

      const rzpOptions = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "Call My Family",
        description: `Payment by ${options.customerName}`,
        order_id: data.order_id,
        handler: (response: any) => {
          options.onSuccess(response.razorpay_payment_id, response.razorpay_order_id);
        },
        prefill: {
          name: options.customerName,
        },
        theme: {
          color: "#dc2626",
        },
        modal: {
          ondismiss: () => {
            toast.info("Payment cancelled");
          },
        },
      };

      const rzp = new window.Razorpay(rzpOptions);
      rzp.on("payment.failed", (response: any) => {
        const msg = response.error?.description || "Payment failed";
        toast.error(msg);
        options.onError?.(msg);
      });
      rzp.open();
    } catch (err: any) {
      const msg = err.message || "Payment initiation failed";
      toast.error(msg);
      options.onError?.(msg);
    }
  }, []);

  return { initiatePayment };
}
