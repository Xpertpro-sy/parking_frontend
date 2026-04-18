import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEFAULT_MANAGER_PERMISSIONS, PermissionMap, getCurrentUserAccessProfile } from "@/lib/access-control";
import {
  MANAGER_DEFAULT_INITIAL_PASSWORD,
  MANAGER_PERMISSION_LABELS,
  createManagerAccessRequest,
  deleteManagerAccessRequest,
  listManagerAccessRequest,
  managerAccessQueryKey,
  updateManagerAccessPermissionsRequest,
  updateManagerAccessStatusRequest,
} from "@/lib/manager-access-api";
import {
  DEFAULT_MAX_MANAGERS_PER_TENANT_ADMIN,
  getTenantAdminMaxManagersAllowed,
  tenantAdminMaxManagersQueryKey,
} from "@/lib/tenant-admin-manager-limit";

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
  const [addManagerOpen, setAddManagerOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteManagerId, setDeleteManagerId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: accessProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["access-profile"],
    queryFn: getCurrentUserAccessProfile,
  });

  const { data: managers = [], isLoading } = useQuery({
    queryKey: managerAccessQueryKey,
    queryFn: listManagerAccessRequest,
    enabled: accessProfile?.role === "ADMIN",
  });

  const { data: maxManagersAllowed = DEFAULT_MAX_MANAGERS_PER_TENANT_ADMIN } = useQuery({
    queryKey: tenantAdminMaxManagersQueryKey(accessProfile?.uid ?? ""),
    queryFn: () => getTenantAdminMaxManagersAllowed(accessProfile!.uid),
    enabled: Boolean(
      accessProfile?.role === "ADMIN" && accessProfile.permissions.accounts && accessProfile.uid,
    ),
    // Plafond modifiable par le super admin : polling léger (le reste du cache est désactivé globalement).
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  const atManagerLimit = managers.length >= maxManagersAllowed;
  const remainingSlots = Math.max(0, maxManagersAllowed - managers.length);

  const canManageAccounts = useMemo(
    () =>
      Boolean(
        accessProfile && accessProfile.role === "ADMIN" && accessProfile.permissions.accounts,
      ),
    [accessProfile],
  );

  const toggleDraftPermission = (key: keyof PermissionMap) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetAddManagerForm = () => {
    setManagerName("");
    setManagerEmail("");
    setPermissions(DEFAULT_MANAGER_PERMISSIONS);
  };

  const handleAddManagerOpenChange = (open: boolean) => {
    if (!open && creating) return;
    setAddManagerOpen(open);
    if (!open) resetAddManagerForm();
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
      resetAddManagerForm();
      setAddManagerOpen(false);
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

  const confirmDeleteManager = async () => {
    if (!deleteManagerId || deleting) return;
    setDeleting(true);
    try {
      await deleteManagerAccessRequest(deleteManagerId);
      await queryClient.invalidateQueries({ queryKey: managerAccessQueryKey });
      toast.success(
        "Gestionnaire supprimé. La connexion est bloquée. Pour réutiliser l’e-mail, supprimez aussi le compte dans Firebase Authentication (console).",
      );
      setDeleteManagerId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setDeleting(false);
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
          reçoit un compte Authentication avec le mot de passe initial{" "}
          <span className="font-mono text-foreground">{MANAGER_DEFAULT_INITIAL_PASSWORD}</span>.
        </p>
        <p className="mt-3 text-sm text-foreground">
          <span className="font-medium">Gestionnaires :</span> {managers.length} / {maxManagersAllowed}
          {atManagerLimit ? (
            <span className="text-destructive"> — plafond atteint, vous ne pouvez plus en ajouter.</span>
          ) : (
            <span className="text-muted-foreground">
              {" "}
              — il vous reste {remainingSlots} création{remainingSlots > 1 ? "s" : ""}{" "}
              possible{remainingSlots > 1 ? "s" : ""}.
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            if (!atManagerLimit) setAddManagerOpen(true);
          }}
          disabled={atManagerLimit}
          title={
            atManagerLimit
              ? `Plafond atteint (${maxManagersAllowed} gestionnaire(s) maximum). Contactez le super administrateur pour augmenter la limite.`
              : undefined
          }
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />
          Ajouter un gestionnaire
        </button>
      </div>

      <Dialog open={addManagerOpen} onOpenChange={handleAddManagerOpenChange}>
        <DialogContent
          className="max-h-[90vh] max-w-2xl overflow-y-auto"
          onPointerDownOutside={(e) => creating && e.preventDefault()}
          onEscapeKeyDown={(e) => creating && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Ajouter un gestionnaire
            </DialogTitle>
            <DialogDescription>
              Renseignez le nom, l&apos;e-mail et les permissions. Mot de passe initial :{" "}
              <span className="font-mono text-foreground">{MANAGER_DEFAULT_INITIAL_PASSWORD}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {MANAGED_PERMISSION_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={permissions[key]}
                    onChange={() => toggleDraftPermission(key)}
                    className="accent-primary"
                  />
                  {MANAGER_PERMISSION_LABELS[key]}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => handleAddManagerOpenChange(false)}
              disabled={creating}
              className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleCreateManager}
              disabled={creating || atManagerLimit}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creating ? "Ajout..." : "Ajouter le gestionnaire"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteManagerId !== null} onOpenChange={(open) => !open && !deleting && setDeleteManagerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce gestionnaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;accès à l&apos;application sera retiré immédiatement. Supprimez le compte dans la base de données Authentication si vous souhaitez libérer l&apos;adresse e-mail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:opacity-90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteManager();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  <div className="flex flex-wrap items-center gap-2">
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
                    <button
                      type="button"
                      onClick={() => setDeleteManagerId(manager.id)}
                      disabled={updatingId === manager.id || deleting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  </div>
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

