import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteTrashItemPermanentlyRequest,
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

const formatDateFr = (value: string) =>
  new Date(value).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

export default function CorbeillePage() {
  const queryClient = useQueryClient();
  const [pendingPermanentDeleteId, setPendingPermanentDeleteId] = useState<string | null>(null);
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

  const onDeletePermanently = async (trashId: string) => {
    try {
      await deleteTrashItemPermanentlyRequest(trashId);
      await queryClient.invalidateQueries({ queryKey: trashItemsQueryKey });
      toast.success('Suppression définitive effectuée.');
      setPendingPermanentDeleteId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Echec de la suppression définitive.');
    }
  };

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

        {isLoading ? (
          <div className="py-10 text-center">
            <Loader2 className="w-5 h-5 mx-auto animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Chargement...</p>
          </div>
        ) : trashItems.length > 0 ? (
          <div className="divide-y divide-border/60">
            {trashItems.map((item) => (
              <div key={item.id} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.subtitle || item.sourceCollection} · supprimé le {formatDateFr(item.deletedAt)}
                  </p>
                  {item.amount != null && (
                    <p className="text-xs text-muted-foreground">{item.amount.toLocaleString()} CFA</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPendingPermanentDeleteId(item.id)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer définitivement
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">La corbeille est vide.</p>
        )}
      </div>

      <AlertDialog open={Boolean(pendingPermanentDeleteId)} onOpenChange={(open) => !open && setPendingPermanentDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suppression définitive</AlertDialogTitle>
            <AlertDialogDescription>
              Cet élément sera supprimé définitivement de la corbeille. Continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingPermanentDeleteId && onDeletePermanently(pendingPermanentDeleteId)}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
