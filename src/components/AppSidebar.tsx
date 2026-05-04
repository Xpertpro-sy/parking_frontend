import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Car,
  Receipt,
  History,
  MailQuestion,
  Settings,
  LogOut,
  Calculator,
  Trash2,
  User,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AppPermission, getCurrentUserAccessProfile } from '@/lib/access-control';
import { brandingSettingsQueryKey, getBrandingSettingsRequest } from '@/lib/branding-api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord', permission: 'dashboard' as AppPermission },
  { to: '/vehicles', icon: Car, label: 'Véhicules', permission: 'vehicles' as AppPermission },
  // { to: '/vehicles/new', icon: Plus, label: 'Ajouter véhicule' },
  { to: '/receipts', icon: Receipt, label: 'Reçus', permission: 'receipts' as AppPermission },
  { to: '/comptability', icon: Calculator, label: 'Comptabilité', permission: 'comptability' as AppPermission },
  { to: '/voitures-louees', icon: Car, label: 'Voitures louées', permission: 'rentals' as AppPermission },
  { to: '/voitures-reservees', icon: Car, label: 'Voitures réservées', permission: 'reservations' as AppPermission },
  { to: '/demandes', icon: MailQuestion, label: 'Demandes', permission: 'ecommerceRequests' as AppPermission },
  { to: '/history', icon: History, label: 'Historique', permission: 'history' as AppPermission },
  { to: '/comptes', icon: User, label: 'Comptes', permission: 'accounts' as AppPermission },
];

export default function AppSidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const { data: accessProfile } = useQuery({
    queryKey: ['access-profile'],
    queryFn: getCurrentUserAccessProfile,
    enabled: Boolean(user?.email),
  });
  const { data: branding, isLoading: brandingLoading } = useQuery({
    queryKey: [...brandingSettingsQueryKey, user?.email ?? 'anonymous'],
    queryFn: getBrandingSettingsRequest,
    enabled: Boolean(user?.email),
  });

  const handleLogout = () => {
    logout();
    setShowLogoutPopup(false);
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar overflow-hidden md:flex">
      {/* Logo */}
      {brandingLoading ? (
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-sidebar-accent animate-pulse shrink-0" />
          <div className="h-5 w-28 rounded bg-sidebar-accent animate-pulse" />
        </div>
      ) : branding?.mode === 'image' && branding.imageDataUrl ? (
        <div className="px-4 py-[5px] border-b border-sidebar-border">
          <div className="h-16 w-full rounded-lg bg-card/60 overflow-hidden flex items-center justify-center">
            <img
              src={branding.imageDataUrl}
              alt="Logo"
              className="h-full w-full object-contain"
              style={{ transform: `scale(${branding.imageScale / 100})` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-primary/20 border border-sidebar-border overflow-hidden flex items-center justify-center shrink-0">
            <Car className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight truncate">{branding?.text ?? 'AutoParc'}</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (accessProfile && !accessProfile.permissions[item.permission]) return null;
          const isActive = location.pathname === item.to || 
            (item.to !== '/' && location.pathname.startsWith(item.to));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1 shrink-0 bg-sidebar sticky bottom-0 z-10">
        <NavLink
          to="/profil"
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
        {(!accessProfile || accessProfile.permissions.settings) && (
          <NavLink
            to="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <Settings className="w-5 h-5" />
            Paramètres
          </NavLink>
        )}
        {(!accessProfile || accessProfile.permissions.trash) && (
          <NavLink
            to="/corbeille"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            Corbeille
          </NavLink>
        )}
        <button
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
              Voulez-vous vraiment vous deconnecter de votre session ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:opacity-90">
              Se deconnecter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
