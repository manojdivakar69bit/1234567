import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { QrCode, Users, Package, Plus, Trash2, LogOut, CheckCircle2, XCircle, Clock, Settings, IndianRupee, UserCheck, PowerOff, Eraser, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BulkStickerPrintCard from "@/components/BulkStickerPrintCard";
import PrintHistoryCard from "@/components/PrintHistoryCard";

const AdminPanel = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // State for Agent
  const [agentName, setAgentName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPassword, setAgentPassword] = useState("");
  const [agentBank, setAgentBank] = useState("");
  const [agentAccNo, setAgentAccNo] = useState("");
  const [agentIfsc, setAgentIfsc] = useState("");

  // State for Salesman
  const [salesmanName, setSalesmanName] = useState("");
  const [salesmanPhone, setSalesmanPhone] = useState("");
  const [salesmanEmail, setSalesmanEmail] = useState("");
  const [salesmanPassword, setSalesmanPassword] = useState("");
  const [salesmanBank, setSalesmanBank] = useState("");
  const [salesmanAccNo, setSalesmanAccNo] = useState("");
  const [salesmanIfsc, setSalesmanIfsc] = useState("");

  const [qrCount, setQrCount] = useState(10);
  const [assignFrom, setAssignFrom] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [assignAgentId, setAssignAgentId] = useState("");

  // Queries
  const { data: qrCodes = [] } = useQuery({
    queryKey: ["qr_codes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("qr_codes").select("*, agents(name)").order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: salesmen = [] } = useQuery({
    queryKey: ["salesmen"],
    queryFn: async () => {
      const { data, error } = await supabase.from("salesmen").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const approvedAgents = agents.filter((a: any) => a.approval_status === "approved");

  // Mutations for Creating (Modified to include bank info)
  const addAgentMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-agent", {
        body: { 
          email: agentEmail, password: agentPassword, name: agentName, phone: agentPhone,
          bank_name: agentBank, account_number: agentAccNo, ifsc_code: agentIfsc 
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setAgentName(""); setAgentPhone(""); setAgentEmail(""); setAgentPassword("");
      setAgentBank(""); setAgentAccNo(""); setAgentIfsc("");
      toast.success("Agent added with Bank details!");
    },
  });

  const addSalesmanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-salesman", {
        body: { 
          email: salesmanEmail, password: salesmanPassword, name: salesmanName, phone: salesmanPhone,
          bank_name: salesmanBank, account_number: salesmanAccNo, ifsc_code: salesmanIfsc
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesmen"] });
      setSalesmanName(""); setSalesmanPhone(""); setSalesmanEmail(""); setSalesmanPassword("");
      setSalesmanBank(""); setSalesmanAccNo(""); setSalesmanIfsc("");
      toast.success("Salesman added with Bank details!");
    },
  });

  // ... (Baaki saari Mutations: clearPrintHistory, rangeAction, etc. pichle code wali hi rahengi)

  return (
    <div className="min-h-screen bg-background p-4 max-w-4xl mx-auto space-y-6 text-sm">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      {/* AGENT REGISTRATION WITH BANK DETAILS */}
      <Card className="card-shadow">
        <CardHeader><CardTitle className="flex items-center gap-2"><Users size={18} /> Add New Agent</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Full Name" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
            <Input placeholder="Email" value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)} />
            <Input placeholder="Phone" value={agentPhone} onChange={(e) => setAgentPhone(e.target.value)} />
            <Input placeholder="Password" type="password" value={agentPassword} onChange={(e) => setAgentPassword(e.target.value)} />
          </div>
          <div className="p-3 border rounded-lg bg-blue-50/50 space-y-3">
            <Label className="text-blue-700 flex items-center gap-1"><Building2 size={14}/> Bank Details (For Commission)</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Bank Name" value={agentBank} onChange={(e) => setAgentBank(e.target.value)} className="bg-white"/>
              <Input placeholder="Account Number" value={agentAccNo} onChange={(e) => setAgentAccNo(e.target.value)} className="bg-white"/>
              <Input placeholder="IFSC Code" value={agentIfsc} onChange={(e) => setAgentIfsc(e.target.value)} className="bg-white"/>
            </div>
          </div>
          <Button onClick={() => addAgentMutation.mutate()} className="w-full">Register Agent</Button>
        </CardContent>
      </Card>

      {/* SALESMAN REGISTRATION WITH BANK DETAILS */}
      <Card className="card-shadow">
        <CardHeader><CardTitle className="flex items-center gap-2"><UserCheck size={18} /> Add New Salesman</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Full Name" value={salesmanName} onChange={(e) => setSalesmanName(e.target.value)} />
            <Input placeholder="Email" value={salesmanEmail} onChange={(e) => setSalesmanEmail(e.target.value)} />
            <Input placeholder="Phone" value={salesmanPhone} onChange={(e) => setSalesmanPhone(e.target.value)} />
            <Input placeholder="Password" type="password" value={salesmanPassword} onChange={(e) => setSalesmanPassword(e.target.value)} />
          </div>
          <div className="p-3 border rounded-lg bg-orange-50/50 space-y-3">
            <Label className="text-orange-700 flex items-center gap-1"><Building2 size={14}/> Bank Details</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Bank Name" value={salesmanBank} onChange={(e) => setSalesmanBank(e.target.value)} className="bg-white"/>
              <Input placeholder="Account No" value={salesmanAccNo} onChange={(e) => setSalesmanAccNo(e.target.value)} className="bg-white"/>
              <Input placeholder="IFSC" value={salesmanIfsc} onChange={(e) => setSalesmanIfsc(e.target.value)} className="bg-white"/>
            </div>
          </div>
          <Button onClick={() => addSalesmanMutation.mutate()} className="w-full" variant="secondary">Register Salesman</Button>
        </CardContent>
      </Card>

      {/* ... (Range Management, History, etc. same as pichla code) */}
      
    </div>
  );
};

export default AdminPanel;
