import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Loader2, Link as LinkIcon, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  buildEcommerceUrl,
  createEcommerceLinkForAdminRequest,
  deleteEcommerceLinkForAdminRequest,
  listSuperAdminEcommerceLinksRequest,
  superAdminEcommerceLinksQueryKey,
} from "@/lib/ecommerce-api";

export default function SuperAdminEcommerceLinksPage() {
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey: superAdminEcommerceLinksQueryKey,
    queryFn: listSuperAdminEcommerceLinksRequest,
  });

  const createMutation = useMutation({
    mutationFn: createEcommerceLinkForAdminRequest,
    onSuccess: async () => {
      toast.success("Lien e-commerce créé.");
      await queryClient.invalidateQueries({ queryKey: superAdminEcommerceLinksQueryKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Impossible de créer le lien.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEcommerceLinkForAdminRequest,
    onSuccess: async () => {
      toast.success("Lien e-commerce supprimé.");
      await queryClient.invalidateQueries({ queryKey: superAdminEcommerceLinksQueryKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Impossible de supprimer le lien.");
    },
  });

  const copyLink = async (token: string) => {
    const url = buildEcommerceUrl(token);
    await navigator.clipboard.writeText(url);
    toast.success("Lien copié.");
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Store className="h-7 w-7 text-amber-600" />
          Lien E-commerce
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Créez un lien public pour un administrateur afin que ses clients consultent son parc et demandent une location
          ou une réservation.
        </p>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement des liens...</p>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "Impossible de charger les liens."}
        </div>
      )}

      {!isLoading && !isError && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Administrateur</th>
                  <th className="px-4 py-3">Lien</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const url = row.token ? buildEcommerceUrl(row.token) : "";
                  return (
                    <tr key={row.adminUid}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{row.adminName}</p>
                        <p className="text-xs text-muted-foreground">{row.adminEmail || "E-mail non renseigné"}</p>
                      </td>
                      <td className="px-4 py-3">
                        {row.token ? (
                          <div className="flex items-center gap-2 min-w-[18rem]">
                            <LinkIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                            <span className="truncate text-muted-foreground">{url}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Aucun lien créé</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                          {row.status === "active" ? "Actif" : "Non créé"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {row.token ? (
                            <>
                              <button
                                type="button"
                                onClick={() => copyLink(row.token!)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copier
                              </button>
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Ouvrir
                              </a>
                              <button
                                type="button"
                                onClick={() => deleteMutation.mutate(row.adminUid)}
                                disabled={deleteMutation.isPending}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
                              >
                                {deleteMutation.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Supprimer
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => createMutation.mutate(row.adminUid)}
                              disabled={createMutation.isPending}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
                            >
                              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5" />}
                              Créer le lien
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
