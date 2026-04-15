import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Car,
  Plus,
  Receipt,
  History,
  Settings,
  LogOut,
  Calculator,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/vehicles', icon: Car, label: 'Véhicules' },
  { to: '/vehicles/new', icon: Plus, label: 'Ajouter véhicule' },
  { to: '/receipts', icon: Receipt, label: 'Reçus' },
  { to: '/comptability', icon: Calculator, label: 'Comptabilité' },
  { to: '/voitures-louees', icon: Car, label: 'Voitures louées' },
  { to: '/history', icon: History, label: 'Historique' },
];

export default function AppSidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <Car className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-foreground tracking-tight">AutoParc</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
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
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        <div className="px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-sidebar-foreground/70">Connecte</p>
          <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{user?.name}</p>
        </div>
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <Settings className="w-5 h-5" />
          Paramètres
        </NavLink>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
