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
      agent_account_id,
      salesman_account_id,
    } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Fetch commission settings from app_settings
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: settingsRows } = await sb
      .from("app_settings")
      .select("key, value")
      .in("key", ["agent_commission", "salesman_commission"]);

    const settingsMap: Record<string, number> = {};
    (settingsRows || []).forEach((r: any) => {
      settingsMap[r.key] = Number(r.value) || 0;
    });

    const agentCommissionPaise = (settingsMap.agent_commission || 5) * 100;
    const salesmanCommissionPaise = (settingsMap.salesman_commission || 15) * 100;

    const amountInPaise = Math.round(amount * 100);
    const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    const transfers: any[] = [];

    if (agent_account_id) {
      transfers.push({
        account: agent_account_id,
        amount: agentCommissionPaise,
        currency: "INR",
        notes: { role: "agent", description: "Agent commission per QR" },
      });
    }

    if (salesman_account_id) {
      transfers.push({
        account: salesman_account_id,
        amount: salesmanCommissionPaise,
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
