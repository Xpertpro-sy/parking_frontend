import { useQuery } from "@tanstack/react-query";
import { Building2, Loader2, Mail, Phone, User } from "lucide-react";
import {
  listPlatformTenantAdminsRequest,
  superAdminTenantAdminsQueryKey,
} from "@/lib/super-admin-platform-api";

export default function SuperAdminPlatformAccountsPage() {
  const { data: admins = [], isLoading, isError, error } = useQuery({
    queryKey: superAdminTenantAdminsQueryKey,
    queryFn: listPlatformTenantAdminsRequest,
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-7 w-7 text-amber-600" />
          Administrateurs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Liste des comptes entreprise inscrits sur la plateforme (rôle administrateur, hors super administrateurs et
          gestionnaires).
        </p>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement des comptes…</p>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "Impossible de charger la liste."}
        </div>
      )}

      {!isLoading && !isError && admins.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucun administrateur locataire enregistré pour le moment.
        </div>
      )}

      {!isLoading && !isError && admins.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Identité</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3 hidden md:table-cell">Téléphone</th>
                  <th className="px-4 py-3 hidden sm:table-cell">UID</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Inscription</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {admins.map((row) => (
                  <tr key={row.uid} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="font-medium text-foreground truncate">{row.displayName || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 min-w-0 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                        <span className="truncate">{row.email || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Phone className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                        <span className="truncate">{row.telephone || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground/90 break-all">{row.uid}</code>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{row.createdAtLabel ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
