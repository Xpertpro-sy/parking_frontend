import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  emptyTrashRequest,
  restoreSelectedTrashItemsRequest,
  restoreTrashItemRequest,
  deleteTrashItemPermanentlyRequest,
  deleteSelectedTrashItemsPermanentlyRequest,
  listTrashItemsRequest,
  trashItemsQueryKey,
} from '@/lib/trash-api';
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
import FullscreenLoader from '@/components/ui/fullscreen-loader';

const formatDateFr = (value: string) =>
  new Date(value).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

export default function CorbeillePage() {
  const queryClient = useQueryClient();
  const [pendingPermanentDeleteId, setPendingPermanentDeleteId] = useState<string | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [pendingEmptyTrash, setPendingEmptyTrash] = useState(false);
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
  const [pendingRestoreSelection, setPendingRestoreSelection] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [isRestoringSingle, setIsRestoringSingle] = useState(false);
  const [isRestoringSelection, setIsRestoringSelection] = useState(false);
  const [isDeletingSelection, setIsDeletingSelection] = useState(false);
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
  const { data: trashItems = [], isLoading, isError, error } = useQuery({
    queryKey: trashItemsQueryKey,
    queryFn: listTrashItemsRequest,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : 'Impossible de charger la corbeille.');
    }
  }, [isError, error]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => trashItems.some((item) => item.id === id)));
  }, [trashItems]);

  const onDeletePermanently = async (trashId: string) => {
    if (isDeletingSingle) return;
    setIsDeletingSingle(true);
    try {
      await deleteTrashItemPermanentlyRequest(trashId);
      await queryClient.invalidateQueries({ queryKey: trashItemsQueryKey });
      toast.success('Suppression définitive effectuée.');
      setPendingPermanentDeleteId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Echec de la suppression définitive.');
    } finally {
      setIsDeletingSingle(false);
    }
  };

  const onRestoreItem = async (trashId: string) => {
    if (isRestoringSingle) return;
    setIsRestoringSingle(true);
    try {
      await restoreTrashItemRequest(trashId);
      await queryClient.invalidateQueries({ queryKey: trashItemsQueryKey });
      toast.success('Élément restauré.');
      setSelectedIds((prev) => prev.filter((id) => id !== trashId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Echec de la restauration.');
    } finally {
      setIsRestoringSingle(false);
      setPendingRestoreId(null);
    }
  };

  const onRestoreSelected = async () => {
    if (selectedIds.length === 0 || isRestoringSelection) return;
    setIsRestoringSelection(true);
    try {
      await restoreSelectedTrashItemsRequest(selectedIds);
      await queryClient.invalidateQueries({ queryKey: trashItemsQueryKey });
      toast.success('Éléments restaurés.');
      setSelectedIds([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Echec de la restauration multiple.');
    } finally {
      setIsRestoringSelection(false);
      setPendingRestoreSelection(false);
    }
  };

  const onDeleteSelected = async () => {
    if (selectedIds.length === 0 || isDeletingSelection) return;
    setIsDeletingSelection(true);
    try {
      await deleteSelectedTrashItemsPermanentlyRequest(selectedIds);
      await queryClient.invalidateQueries({ queryKey: trashItemsQueryKey });
      toast.success('Éléments supprimés définitivement.');
      setSelectedIds([]);
      setPendingBulkDelete(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Echec de la suppression multiple.');
    } finally {
      setIsDeletingSelection(false);
    }
  };

  const onEmptyTrash = async () => {
    if (isEmptyingTrash) return;
    setIsEmptyingTrash(true);
    try {
      await emptyTrashRequest();
      await queryClient.invalidateQueries({ queryKey: trashItemsQueryKey });
      toast.success('Corbeille vidée.');
      setSelectedIds([]);
      setPendingEmptyTrash(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de vider la corbeille.');
    } finally {
      setIsEmptyingTrash(false);
    }
  };

  const allSelected = trashItems.length > 0 && selectedIds.length === trashItems.length;
  const isActionLoading =
    isDeletingSingle ||
    isRestoringSingle ||
    isRestoringSelection ||
    isDeletingSelection ||
    isEmptyingTrash;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Corbeille</h1>
        <p className="text-sm text-muted-foreground mt-1">Éléments supprimés en attente de suppression définitive.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Éléments supprimés</h2>
          <p className="text-xs text-muted-foreground">{trashItems.length} élément(s)</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedIds(allSelected ? [] : trashItems.map((item) => item.id))}
            className="px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary"
          >
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => setPendingRestoreSelection(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-medium disabled:opacity-50 hover:bg-secondary"
          >
            <RotateCcw className="w-4 h-4" />
            {isRestoringSelection ? 'Restauration...' : 'Restaurer la sélection'}
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0 || isDeletingSelection}
            onClick={() => setPendingBulkDelete(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-destructive/40 text-destructive text-xs font-medium disabled:opacity-50 hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
            {isDeletingSelection ? 'Suppression...' : 'Supprimer la sélection'}
          </button>
          <button
            type="button"
            disabled={trashItems.length === 0 || isEmptyingTrash}
            onClick={() => setPendingEmptyTrash(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isEmptyingTrash ? 'Vidage...' : 'Vider la corbeille'}
          </button>
        </div>

        {isLoading ? (
          <div className="py-10 text-center">
            <Loader2 className="w-5 h-5 mx-auto animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Chargement...</p>
          </div>
        ) : trashItems.length > 0 ? (
          <div className="divide-y divide-border/60">
            {trashItems.map((item) => (
              <div key={item.id} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedIds((prev) => [...prev, item.id]);
                      } else {
                        setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                      }
                    }}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.subtitle || item.sourceCollection} · supprimé le {formatDateFr(item.deletedAt)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">Supprimé par: {item.deletedByName}</p>
                  {item.amount != null && (
                    <p className="text-xs text-muted-foreground">{item.amount.toLocaleString()} CFA</p>
                  )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingRestoreId(item.id)}
                    disabled={isRestoringSingle || isDeletingSingle}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {isRestoringSingle && pendingRestoreId === item.id ? 'Restauration...' : 'Restaurer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingPermanentDeleteId(item.id)}
                    disabled={isDeletingSingle || isRestoringSingle}
                    className="inline-flex items-center justify-center rounded-lg bg-destructive p-2 text-destructive-foreground"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">La corbeille est vide.</p>
        )}
      </div>

      <AlertDialog
        open={Boolean(pendingPermanentDeleteId)}
        onOpenChange={(open) => !open && !isActionLoading && setPendingPermanentDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suppression définitive</AlertDialogTitle>
            <AlertDialogDescription>
              Cet élément sera supprimé définitivement de la corbeille. Continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingPermanentDeleteId && onDeletePermanently(pendingPermanentDeleteId)}
              disabled={isActionLoading}
            >
              {isDeletingSingle ? 'Suppression...' : 'Supprimer définitivement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingRestoreId)}
        onOpenChange={(open) => !open && !isActionLoading && setPendingRestoreId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurer l'élément</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous restaurer cet élément depuis la corbeille ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingRestoreId && onRestoreItem(pendingRestoreId)} disabled={isActionLoading}>
              {isRestoringSingle ? 'Restauration...' : 'Restaurer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingBulkDelete} onOpenChange={(open) => !isActionLoading && setPendingBulkDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suppression de la sélection</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer définitivement {selectedIds.length} élément(s) sélectionné(s) ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteSelected} disabled={isActionLoading}>
              {isDeletingSelection ? 'Suppression...' : 'Confirmer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingRestoreSelection} onOpenChange={(open) => !isActionLoading && setPendingRestoreSelection(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurer la sélection</AlertDialogTitle>
            <AlertDialogDescription>
              Restaurer {selectedIds.length} élément(s) sélectionné(s) ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={onRestoreSelected} disabled={isActionLoading}>
              {isRestoringSelection ? 'Restauration...' : 'Confirmer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingEmptyTrash} onOpenChange={(open) => !isActionLoading && setPendingEmptyTrash(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vider la corbeille</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement tous les éléments de la corbeille.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={onEmptyTrash} disabled={isActionLoading}>
              {isEmptyingTrash ? 'Vidage...' : 'Vider'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isActionLoading && (
        <FullscreenLoader message="Traitement de la corbeille..." />
      )}
    </div>
  );
}
