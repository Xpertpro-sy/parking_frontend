import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
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
import RentalForm from "./pages/RentalForm";
import FinalizeReservationRentalForm from "./pages/FinalizeReservationRentalForm";
import Receipts from "./pages/Receipts";
import HistoryPage from "./pages/HistoryPage";
import RentedVehicles from "./pages/RentedVehicles";
import ReservedVehicles from "./pages/ReservedVehicles";
import ComptabilityPage from "./pages/ComptabilityPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: ONE_DAY_MS,
      retry: 1,
      networkMode: "offlineFirst",
      refetchOnWindowFocus: false,
    },
    mutations: {
      networkMode: "offlineFirst",
      retry: 0,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "gestion-parking-react-query-cache-v1",
  throttleTime: 1000,
});

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: ONE_DAY_MS,
    }}
  >
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
                <Route path="/rentals/new" element={<RentalForm />} />
                <Route path="/rentals/finalize-from-reservation" element={<FinalizeReservationRentalForm />} />
                <Route path="/vehicles/:id" element={<VehicleDetail />} />
                <Route path="/receipts" element={<Receipts />} />
                <Route path="/voitures-louees" element={<RentedVehicles />} />
                <Route path="/voitures-reservees" element={<ReservedVehicles />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/comptability" element={<ComptabilityPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </PersistQueryClientProvider>
);

export default App;
