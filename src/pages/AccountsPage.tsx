import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_MANAGER_PERMISSIONS, PermissionMap, getCurrentUserAccessProfile } from "@/lib/access-control";
import {
  MANAGER_DEFAULT_INITIAL_PASSWORD,
  MANAGER_PERMISSION_LABELS,
  createManagerAccessRequest,
  listManagerAccessRequest,
  managerAccessQueryKey,
  updateManagerAccessPermissionsRequest,
  updateManagerAccessStatusRequest,
} from "@/lib/manager-access-api";

const MANAGED_PERMISSION_KEYS: (keyof PermissionMap)[] = [
  "dashboard",
  "vehicles",
  "receipts",
  "comptability",
  "rentals",
  "reservations",
  "history",
  "trash",
];

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [permissions, setPermissions] = useState<PermissionMap>(DEFAULT_MANAGER_PERMISSIONS);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: accessProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["access-profile"],
    queryFn: getCurrentUserAccessProfile,
  });

  const { data: managers = [], isLoading } = useQuery({
    queryKey: managerAccessQueryKey,
    queryFn: listManagerAccessRequest,
    enabled: accessProfile?.role === "ADMIN",
  });

  const canManageAccounts = useMemo(
    () => Boolean(accessProfile && accessProfile.role === "ADMIN" && accessProfile.permissions.accounts),
    [accessProfile],
  );

  const toggleDraftPermission = (key: keyof PermissionMap) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCreateManager = async () => {
    if (!managerName.trim() || !managerEmail.trim()) {
      toast.error("Nom et email du gestionnaire sont obligatoires.");
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      await createManagerAccessRequest({
        managerName: managerName.trim(),
        managerEmail: managerEmail.trim().toLowerCase(),
        permissions,
      });
      await queryClient.invalidateQueries({ queryKey: managerAccessQueryKey });
      toast.success(
        `Gestionnaire ajouté. Connexion : e-mail du gestionnaire, mot de passe ${MANAGER_DEFAULT_INITIAL_PASSWORD}.`,
      );
      setManagerName("");
      setManagerEmail("");
      setPermissions(DEFAULT_MANAGER_PERMISSIONS);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'ajouter le gestionnaire.");
    } finally {
      setCreating(false);
    }
  };

  const toggleManagerPermission = async (managerId: string, current: PermissionMap, key: keyof PermissionMap) => {
    if (updatingId) return;
    setUpdatingId(managerId);
    try {
      await updateManagerAccessPermissionsRequest(managerId, { [key]: !current[key] });
      await queryClient.invalidateQueries({ queryKey: managerAccessQueryKey });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour des permissions impossible.");
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleManagerStatus = async (managerId: string, status: "active" | "inactive") => {
    if (updatingId) return;
    setUpdatingId(managerId);
    try {
      await updateManagerAccessStatusRequest(managerId, status === "active" ? "inactive" : "active");
      await queryClient.invalidateQueries({ queryKey: managerAccessQueryKey });
      toast.success(status === "active" ? "Gestionnaire désactivé." : "Gestionnaire réactivé.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour du statut impossible.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (profileLoading) {
    return (
      <div className="glass-card p-8 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">Chargement des accès...</p>
      </div>
    );
  }

  if (!canManageAccounts) {
    return (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Comptes</h1>
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Accès réservé aux administrateurs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comptes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Créez des gestionnaires et attribuez des permissions pour aider à gérer votre entreprise. Chaque gestionnaire
          reçoit un compte Firebase Authentication avec le mot de passe initial{" "}
          <span className="font-mono text-foreground">{MANAGER_DEFAULT_INITIAL_PASSWORD}</span>.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Ajouter un gestionnaire</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            placeholder="Nom du gestionnaire"
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm"
          />
          <input
            type="email"
            value={managerEmail}
            onChange={(e) => setManagerEmail(e.target.value)}
            placeholder="Email du gestionnaire"
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {MANAGED_PERMISSION_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-2 text-xs">
              <input type="checkbox" checked={permissions[key]} onChange={() => toggleDraftPermission(key)} className="accent-primary" />
              {MANAGER_PERMISSION_LABELS[key]}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCreateManager}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {creating ? "Ajout..." : "Ajouter le gestionnaire"}
        </button>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Gestionnaires de l&apos;entreprise</h2>
        {isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Chargement...</p>
          </div>
        ) : managers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun gestionnaire pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {managers.map((manager) => (
              <div key={manager.id} className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{manager.managerName}</p>
                    <p className="text-xs text-muted-foreground">{manager.managerEmail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleManagerStatus(manager.id, manager.status)}
                    disabled={updatingId === manager.id}
                    className={`rounded-lg px-3 py-2 text-xs font-medium ${
                      manager.status === "active"
                        ? "border border-destructive/40 text-destructive hover:bg-destructive/10"
                        : "border border-success/40 text-success hover:bg-success/10"
                    } disabled:opacity-60`}
                  >
                    {manager.status === "active" ? "Désactiver" : "Réactiver"}
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {MANAGED_PERMISSION_KEYS.map((key) => (
                    <label key={`${manager.id}-${key}`} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-2 text-xs">
                      <input
                        type="checkbox"
                        checked={manager.permissions[key]}
                        disabled={updatingId === manager.id || manager.status !== "active"}
                        onChange={() => toggleManagerPermission(manager.id, manager.permissions, key)}
                        className="accent-primary"
                      />
                      {MANAGER_PERMISSION_LABELS[key]}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

