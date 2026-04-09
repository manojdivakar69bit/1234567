import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return new Response(JSON.stringify({ error: "Razorpay keys not configured" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const {
      amount,
      currency,
      customer_name,
      notes,
      agent_account_id,    // ✅ Agent ka Razorpay Linked Account ID
      salesman_account_id, // ✅ Salesman ka Razorpay Linked Account ID
    } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const amountInPaise = Math.round(amount * 100);
    const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    // ✅ Split: ₹5 agent, ₹15 salesman, baaki tera
    const transfers: any[] = [];

    if (agent_account_id) {
      transfers.push({
        account: agent_account_id,
        amount: 500, // ₹5 in paise
        currency: "INR",
        notes: { role: "agent", description: "Agent commission per QR" },
      });
    }

    if (salesman_account_id) {
      transfers.push({
        account: salesman_account_id,
        amount: 1500, // ₹15 in paise
        currency: "INR",
        notes: { role: "salesman", description: "Salesman commission per QR" },
      });
    }

    const orderBody: any = {
      amount: amountInPaise,
      currency: currency || "INR",
      notes: {
        customer_name: customer_name || "",
        ...notes,
      },
    };

    // ✅ Transfers sirf tab add karo jab accounts available hon
    if (transfers.length > 0) {
      orderBody.transfers = transfers;
    }

    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderBody),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.text();
      console.error("Razorpay order creation failed:", errorData);
      return new Response(JSON.stringify({ error: "Failed to create Razorpay order" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const order = await orderResponse.json();

    return new Response(JSON.stringify({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: RAZORPAY_KEY_ID,
    }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating order:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
