import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { GuestRoute, ProtectedRoute } from "@/components/AuthRoute";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import VehicleList from "./pages/VehicleList";
import VehicleDetail from "./pages/VehicleDetail";
import VehicleForm from "./pages/VehicleForm";
import VehicleEditForm from "./pages/VehicleEditForm";
import SaleForm from "./pages/SaleForm";
import Receipts from "./pages/Receipts";
import HistoryPage from "./pages/HistoryPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<GuestRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/vehicles" element={<VehicleList />} />
                <Route path="/vehicles/new" element={<VehicleForm />} />
                <Route path="/vehicles/:id/edit" element={<VehicleEditForm />} />
                <Route path="/sales/new" element={<SaleForm />} />
                <Route path="/vehicles/:id" element={<VehicleDetail />} />
                <Route path="/receipts" element={<Receipts />} />
                <Route path="/history" element={<HistoryPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
