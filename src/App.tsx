import SalesmanPanel from "./pages/SalesmanPanel";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import AdminPanel from "./pages/AdminPanel";
import AgentPanel from "./pages/AgentPanel";
import EmergencyPage from "./pages/EmergencyPage";
import LoginPage from "./pages/LoginPage";
import PrintStickerPage from "./pages/PrintStickerPage";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import PrivacyPolicy from "./pages/PrivacyPolicy";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/register" element={<CustomerPanel />} />
          <Route path="/salesman" element={<ProtectedRoute allowedRoles={["admin", "agent", "salesman"]}><SalesmanPanel /></ProtectedRoute>} />
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPanel /></ProtectedRoute>} />
          <Route path="/agent" element={<ProtectedRoute allowedRoles={["agent"]}><AgentPanel /></ProtectedRoute>} />
          <Route path="/emergency/:code" element={<EmergencyPage />} />
          <Route path="/print/:code" element={<PrintStickerPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
