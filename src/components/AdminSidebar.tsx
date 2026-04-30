import { NavLink } from "react-router-dom";
import { CreditCard, LayoutDashboard, LogOut, Store, Users, ChevronRight } from "lucide-react";
import { useState } from "react";
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

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-sidebar border-r border-sidebar-border shrink-0">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-sidebar-border flex items-center justify-center shrink-0">
          <LayoutDashboard className="w-5 h-5 text-amber-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wide">Back-office</p>
          <p className="text-sm font-semibold text-sidebar-accent-foreground truncate">Super administrateur</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavLink
          to="/admin"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5" />
          Tableau de bord
        </NavLink>
        <NavLink
          to="/admin/comptes"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`
          }
        >
          <Users className="w-5 h-5" />
          Administrateurs locataires
        </NavLink>
        <NavLink
          to="/admin/abonnements"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`
          }
        >
          <CreditCard className="w-5 h-5" />
          Abonnements
        </NavLink>
        <NavLink
          to="/admin/e-commerce"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`
          }
        >
          <Store className="w-5 h-5" />
          Lien E-commerce
        </NavLink>
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border space-y-1 shrink-0">
        <NavLink
          to="/admin/profil"
          className={({ isActive }) =>
            `flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${
              isActive
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`
          }
        >
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-sidebar-foreground/70">Connecté</p>
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{user?.name}</p>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0 opacity-70" aria-hidden />
        </NavLink>
        <button
          type="button"
          onClick={() => setShowLogoutPopup(true)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          Déconnexion
        </button>
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
    </aside>
  );
}
