import { LayoutDashboard, Server, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function SuperAdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-8 max-w-4xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <LayoutDashboard className="h-7 w-7 text-amber-600" />
          Back-office plateforme
        </h1>
        <p className="text-muted-foreground mt-1">
          Espace réservé au super administrateur. Gestion globale et outils d’exploitation (évolutif).
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Connecté en tant que <span className="font-medium text-foreground">{user?.email}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-foreground mb-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Comptes & accès</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Gestion des administrateurs locataires et des gestionnaires (réservé au super administrateur).
          </p>
          <Link to="/admin/comptes" className="text-sm font-medium text-primary hover:underline">
            Ouvrir Comptes & gestionnaires →
          </Link>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Server className="h-5 w-5" />
            <h2 className="font-semibold text-foreground">Modules à venir</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Statistiques multi-tenant, journaux d’audit, configuration système : branches futures de ce back-office.
          </p>
        </div>
      </div>
    </div>
  );
}
