import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, useLocation } from 'react-router-dom';
import { Car, LayoutDashboard, Receipt, History, Menu, X, LogOut, Calculator, Settings, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
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
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/vehicles', icon: Car, label: 'Véhicules' },
  { to: '/receipts', icon: Receipt, label: 'Reçus' },
  { to: '/comptability', icon: Calculator, label: 'Comptabilité' },
  { to: '/voitures-louees', icon: Car, label: 'Voitures louées' },
  { to: '/voitures-reservees', icon: Car, label: 'Voitures réservées' },
  { to: '/history', icon: History, label: 'Historique' },
  { to: '/settings', icon: Settings, label: 'Paramètres' },
  { to: '/corbeille', icon: Trash2, label: 'Corbeille' },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const location = useLocation();
  const { logout, user } = useAuth();
  const { data: branding } = useQuery({
    queryKey: [...brandingSettingsQueryKey, user?.email ?? 'anonymous'],
    queryFn: getBrandingSettingsRequest,
    enabled: Boolean(user?.email),
    staleTime: 60 * 1000,
  });

  const handleLogout = () => {
    logout();
    setOpen(false);
    setShowLogoutPopup(false);
  };

  return (
    <>
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar border-b border-sidebar-border">
        {branding?.mode === 'image' && branding.imageDataUrl ? (
          <div className="h-9 w-[170px] max-w-[65vw] rounded-lg border border-sidebar-border bg-card/60 overflow-hidden flex items-center justify-center">
            <img
              src={branding.imageDataUrl}
              alt="Logo"
              className="h-full w-full object-contain"
              style={{ transform: `scale(${branding.imageScale / 100})` }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-sidebar-border overflow-hidden flex items-center justify-center shrink-0">
              <Car className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-foreground truncate">{branding?.text ?? 'AutoParc'}</span>
          </div>
        )}
        <button onClick={() => setOpen(!open)} className="text-foreground">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 top-14 z-50 bg-background/95 backdrop-blur-sm">
          <nav className="flex flex-col p-4 gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              );
            })}
            <button
              onClick={() => setShowLogoutPopup(true)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-destructive transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </nav>
        </div>
      )}

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
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground hover:opacity-90"
            >
              Se deconnecter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
