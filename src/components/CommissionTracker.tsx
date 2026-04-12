import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { IndianRupee, CheckCircle, Clock } from "lucide-react";

const CommissionTracker = () => {
  const queryClient = useQueryClient();
  const [markPaidData, setMarkPaidData] = useState<Record<string, { utr: string; note: string }>>({});
  const [commissionAmounts, setCommissionAmounts] = useState<Record<string, string>>({});

  const { data: commissions = [] } = useQuery({
    queryKey: ["commissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["all_payments_for_commission"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addCommissionMutation = useMutation({
    mutationFn: async (payment: any) => {
      const amount = commissionAmounts[payment.id];
      if (!amount || parseFloat(amount) <= 0) throw new Error("Enter commission amount");
      const { error } = await supabase.from("commissions").insert({
        payment_id: payment.id,
        order_ref: payment.razorpay_order_id || `ORD-${payment.id.slice(0, 8).toUpperCase()}`,
        collector_name: payment.collector_name || payment.customer_name || "Unknown",
        collector_role: payment.collected_by_role || "salesman",
        order_amount: payment.amount,
        commission_amount: parseFloat(amount),
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: (_, payment) => {
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
      setCommissionAmounts((prev) => ({ ...prev, [payment.id]: "" }));
      toast.success("Commission added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (commissionId: string) => {
      const data = markPaidData[commissionId];
      if (!data?.utr) throw new Error("Enter UTR/note");
      const { error } = await supabase
        .from("commissions")
        .update({ status: "paid", paid_utr: data.utr, paid_at: new Date().toISOString() })
        .eq("id", commissionId);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
      setMarkPaidData((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success("Commission marked paid!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const totalRevenue = commissions.reduce((s: number, c: any) => s + Number(c.order_amount), 0);
  const totalPaid = commissions.filter((c: any) => c.status === "paid").reduce((s: number, c: any) => s + Number(c.commission_amount), 0);
  const totalPending = commissions.filter((c: any) => c.status === "pending").reduce((s: number, c: any) => s + Number(c.commission_amount), 0);

  // Payments that don't have a commission entry yet
  const commissionPaymentIds = new Set(commissions.map((c: any) => c.payment_id));
  const uncommissionedPayments = payments.filter((p: any) => !commissionPaymentIds.has(p.id) && p.collected_by_role);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 border-l-4 border-l-blue-600">
          <div className="text-lg font-black text-blue-700">₹{totalRevenue}</div>
          <div className="text-[9px] uppercase font-bold text-muted-foreground">Total Revenue</div>
        </Card>
        <Card className="p-3 border-l-4 border-l-green-600">
          <div className="text-lg font-black text-green-700">₹{totalPaid}</div>
          <div className="text-[9px] uppercase font-bold text-muted-foreground">Commission Paid</div>
        </Card>
        <Card className="p-3 border-l-4 border-l-orange-500">
          <div className="text-lg font-black text-orange-700">₹{totalPending}</div>
          <div className="text-[9px] uppercase font-bold text-muted-foreground">Comm. Pending</div>
        </Card>
      </div>

      {/* Uncommissioned Payments - Add commission */}
      {uncommissionedPayments.length > 0 && (
        <Card className="shadow-sm border-orange-100 overflow-hidden">
          <CardHeader className="bg-orange-50/50 py-3 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock size={16} className="text-orange-500" /> Payments Without Commission ({uncommissionedPayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-60 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase sticky top-0">
                <tr>
                  <th className="p-2">Collector</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Commission ₹</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {uncommissionedPayments.map((p: any) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-2">
                      <div className="font-bold">{p.collector_name || p.customer_name}</div>
                      <Badge className="text-[8px]">{p.collected_by_role}</Badge>
                    </td>
                    <td className="p-2 font-mono font-bold">₹{p.amount}</td>
                    <td className="p-2">
                      <Input
                        type="number"
                        placeholder="₹"
                        className="h-7 w-20 text-xs"
                        value={commissionAmounts[p.id] || ""}
                        onChange={(e) => setCommissionAmounts({ ...commissionAmounts, [p.id]: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        className="h-7 text-[10px] bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => addCommissionMutation.mutate(p)}
                      >
                        Add
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Commission Table */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-100/50 py-3 border-b">
          <CardTitle className="text-sm flex items-center gap-2">
            <IndianRupee size={16} className="text-green-600" /> Commission Ledger
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 max-h-80 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase sticky top-0">
              <tr>
                <th className="p-2">Order Ref</th>
                <th className="p-2">Name</th>
                <th className="p-2">Order ₹</th>
                <th className="p-2">Comm ₹</th>
                <th className="p-2">Status</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c: any) => (
                <tr key={c.id} className="border-b hover:bg-slate-50">
                  <td className="p-2 font-mono text-[10px]">{c.order_ref}</td>
                  <td className="p-2">
                    <div className="font-bold">{c.collector_name}</div>
                    <span className="text-[9px] text-muted-foreground">{c.collector_role}</span>
                  </td>
                  <td className="p-2 font-mono">₹{c.order_amount}</td>
                  <td className="p-2 font-mono font-bold text-green-600">₹{c.commission_amount}</td>
                  <td className="p-2">
                    <Badge variant={c.status === "paid" ? "default" : "secondary"} className={c.status === "paid" ? "bg-green-600 text-[9px]" : "text-[9px]"}>
                      {c.status === "paid" ? "✅ Paid" : "⏳ Pending"}
                    </Badge>
                  </td>
                  <td className="p-2">
                    {c.status === "pending" ? (
                      <div className="space-y-1">
                        <Input
                          placeholder="UTR/Note"
                          className="h-6 text-[10px] w-24"
                          value={markPaidData[c.id]?.utr || ""}
                          onChange={(e) =>
                            setMarkPaidData({ ...markPaidData, [c.id]: { ...markPaidData[c.id], utr: e.target.value, note: "" } })
                          }
                        />
                        <Button
                          size="sm"
                          className="h-6 text-[9px] bg-green-600 hover:bg-green-700 text-white w-full"
                          onClick={() => markPaidMutation.mutate(c.id)}
                        >
                          <CheckCircle size={10} className="mr-1" /> Mark Paid
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[9px] text-muted-foreground">{c.paid_utr}</span>
                    )}
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">No commissions yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommissionTracker;
