import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { GuestRoute, ProtectedRoute, SuperAdminRoute, TenantAppRoute } from "@/components/AuthRoute";
import AppLayout from "./components/AppLayout";
import AdminLayout from "./components/AdminLayout";
import Dashboard from "./pages/Dashboard";
import VehicleList from "./pages/VehicleList";
import VehicleDetail from "./pages/VehicleDetail";
import VehicleForm from "./pages/VehicleForm";
import VehicleEditForm from "./pages/VehicleEditForm";
import SaleForm from "./pages/SaleForm";
import RentalForm from "./pages/RentalForm";
import ReservationForm from "./pages/ReservationForm";
import RepairForm from "./pages/RepairForm";
import FinalizeReservationRentalForm from "./pages/FinalizeReservationRentalForm";
import Receipts from "./pages/Receipts";
import HistoryPage from "./pages/HistoryPage";
import RentedVehicles from "./pages/RentedVehicles";
import ReservedVehicles from "./pages/ReservedVehicles";
import ComptabilityPage from "./pages/ComptabilityPage";
import EcommerceRequestsPage from "./pages/EcommerceRequestsPage";
import SettingsPage from "./pages/SettingsPage";
import CorbeillePage from "./pages/CorbeillePage";
import AccountsPage from "./pages/AccountsPage";
import ProfilePage from "./pages/ProfilePage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminPlatformAccountsPage from "./pages/SuperAdminPlatformAccountsPage";
import SuperAdminTenantAdminDetailPage from "./pages/SuperAdminTenantAdminDetailPage";
import SuperAdminSubscriptionsPage from "./pages/SuperAdminSubscriptionsPage";
import SuperAdminEcommerceLinksPage from "./pages/SuperAdminEcommerceLinksPage";
import PublicEcommerceStorePage from "./pages/PublicEcommerceStorePage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

const LEGACY_REACT_QUERY_PERSIST_KEY = "gestion-parking-react-query-cache-v1";

if (typeof window !== "undefined") {
  window.localStorage.removeItem(LEGACY_REACT_QUERY_PERSIST_KEY);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
      retry: 1,
      networkMode: "online",
      refetchOnWindowFocus: true,
    },
    mutations: {
      networkMode: "online",
      retry: 0,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/shop/:token" element={<PublicEcommerceStorePage />} />

            <Route element={<GuestRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/admin" element={<SuperAdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<SuperAdminDashboard />} />
                  <Route path="comptes/:adminUid" element={<SuperAdminTenantAdminDetailPage />} />
                  <Route path="comptes" element={<SuperAdminPlatformAccountsPage />} />
                  <Route path="abonnements" element={<SuperAdminSubscriptionsPage />} />
                  <Route path="e-commerce" element={<SuperAdminEcommerceLinksPage />} />
                  <Route path="profil" element={<ProfilePage />} />
                </Route>
              </Route>
              <Route element={<TenantAppRoute />}>
                <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/vehicles" element={<VehicleList />} />
                <Route path="/vehicles/new" element={<VehicleForm />} />
                <Route path="/vehicles/:id/edit" element={<VehicleEditForm />} />
                <Route path="/sales/new" element={<SaleForm />} />
                <Route path="/rentals/new" element={<RentalForm />} />
                <Route path="/reservations/new" element={<ReservationForm />} />
                <Route path="/repairs/new" element={<RepairForm />} />
                <Route path="/rentals/finalize-from-reservation" element={<FinalizeReservationRentalForm />} />
                <Route path="/vehicles/:id" element={<VehicleDetail />} />
                <Route path="/receipts" element={<Receipts />} />
                <Route path="/voitures-louees" element={<RentedVehicles />} />
                <Route path="/voitures-reservees" element={<ReservedVehicles />} />
                <Route path="/demandes" element={<EcommerceRequestsPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/comptability" element={<ComptabilityPage />} />
                <Route path="/profil" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/corbeille" element={<CorbeillePage />} />
                <Route path="/comptes" element={<AccountsPage />} />
                </Route>
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
