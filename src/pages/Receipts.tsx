import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { listReceiptsRequest } from '@/lib/sale-api';

export default function Receipts() {
  const { data: receipts = [], isLoading, isError, error } = useQuery({
    queryKey: ['receipts', 'list'],
    queryFn: listReceiptsRequest,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger les recus.");
    }
  }, [isError, error]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reçus</h1>
        <p className="text-muted-foreground mt-1">Historique des reçus générés</p>
      </div>

      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">Chargement des recus...</p>
        </div>
      ) : receipts.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {receipts.map((receipt) => (
            <div key={receipt.id} className="glass-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Numero de recu</p>
                  <p className="text-sm font-semibold text-foreground">{receipt.receiptNumber}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                  Vente
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Vehicule</p>
                  <p className="text-foreground font-medium">
                    {receipt.vehicleBrand} {receipt.vehicleModel}
                  </p>
                  <p className="text-xs text-muted-foreground">{receipt.vehiclePlate}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Acheteur</p>
                  <p className="text-foreground font-medium">{receipt.buyerName}</p>
                  <p className="text-xs text-muted-foreground">{receipt.buyerPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Montant</p>
                  <p className="text-foreground font-semibold">{receipt.amount.toLocaleString()} CFA</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date de vente</p>
                  <p className="text-foreground">{new Date(receipt.saleDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <Receipt className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Aucun recu pour le moment.</p>
          <p className="text-sm text-muted-foreground mt-1">Les recus seront generes automatiquement lors des ventes.</p>
        </div>
      )}
    </div>
  );
}
