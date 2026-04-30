import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, LogOut } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import { useAuth } from "@/context/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdminLayout() {
  const location = useLocation();
  const { logout } = useAuth();
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden overflow-x-hidden bg-background">
      <AdminSidebar />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-x-hidden">
        <header className="md:hidden border-b border-border bg-sidebar shrink-0">
          <div className="flex items-center justify-between px-4 py-3">
            <Link to="/admin" className="flex items-center gap-2 font-semibold text-foreground">
              <LayoutDashboard className="h-5 w-5 text-amber-600" />
              Back-office
            </Link>
            <button
              type="button"
              onClick={() => setShowLogoutPopup(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-destructive"
              aria-label="Se déconnecter"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex gap-1 px-2 pb-2 overflow-x-auto text-xs font-medium">
            <Link
              to="/admin"
              className={`shrink-0 rounded-md px-2.5 py-1.5 ${location.pathname === "/admin" ? "bg-sidebar-accent text-sidebar-primary" : "text-muted-foreground"}`}
            >
              Accueil
            </Link>
            <Link
              to="/admin/comptes"
              className={`shrink-0 rounded-md px-2.5 py-1.5 ${location.pathname.startsWith("/admin/comptes") ? "bg-sidebar-accent text-sidebar-primary" : "text-muted-foreground"}`}
            >
              Admins locataires
            </Link>
            <Link
              to="/admin/abonnements"
              className={`shrink-0 rounded-md px-2.5 py-1.5 ${location.pathname.startsWith("/admin/abonnements") ? "bg-sidebar-accent text-sidebar-primary" : "text-muted-foreground"}`}
            >
              Abonnements
            </Link>
            <Link
              to="/admin/e-commerce"
              className={`shrink-0 rounded-md px-2.5 py-1.5 ${location.pathname.startsWith("/admin/e-commerce") ? "bg-sidebar-accent text-sidebar-primary" : "text-muted-foreground"}`}
            >
              E-commerce
            </Link>
            <Link
              to="/admin/profil"
              className={`shrink-0 rounded-md px-2.5 py-1.5 ${location.pathname.startsWith("/admin/profil") ? "bg-sidebar-accent text-sidebar-primary" : "text-muted-foreground"}`}
            >
              Profil
            </Link>
          </nav>
        </header>
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-8">
          <Outlet />
        </main>
      </div>
      <AlertDialog open={showLogoutPopup} onOpenChange={setShowLogoutPopup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la déconnexion</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment vous déconnecter du back-office ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                logout();
                setShowLogoutPopup(false);
              }}
              className="bg-destructive text-destructive-foreground hover:opacity-90"
            >
              Se déconnecter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
