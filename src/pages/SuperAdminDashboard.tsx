import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Shield, UserCog } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getSuperAdminPlatformStatsRequest,
  superAdminPlatformStatsQueryKey,
} from "@/lib/super-admin-platform-api";

function StatCard(props: {
  title: string;
  value: number | string;
  icon: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{props.title}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{props.value}</p>
          {props.hint ? <p className="mt-1 text-xs text-muted-foreground">{props.hint}</p> : null}
        </div>
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{props.icon}</div>
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading, isError, error } = useQuery({
    queryKey: superAdminPlatformStatsQueryKey,
    queryFn: getSuperAdminPlatformStatsRequest,
  });

  return (
    <div className="space-y-8 max-w-5xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <LayoutDashboard className="h-7 w-7 text-amber-600" />
          Back-office plateforme
        </h1>
        <p className="text-muted-foreground mt-1">
          Espace réservé au super administrateur.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Connecté en tant que <span className="font-medium text-foreground">{user?.email}</span>
        </p>
      </div>

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Impossible de charger les statistiques."}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Statistiques plateforme</h2>
        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
          <StatCard
            title="Super administrateurs"
            value={isLoading ? "…" : stats?.superAdminCount ?? "—"}
            hint="Accès back-office global"
            icon={<Shield className="h-5 w-5" />}
          />
          <StatCard
            title="Gestionnaires"
            value={isLoading ? "…" : stats?.managerCount ?? "—"}
            hint="Utilisateurs rattachés à une entreprise"
            icon={<UserCog className="h-5 w-5" />}
          />
        </div>
      </div>
    </div>
  );
}
