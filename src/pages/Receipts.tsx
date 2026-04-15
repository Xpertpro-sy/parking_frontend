import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { listReceiptsRequest } from '@/lib/sale-api';
import { listRentalReceiptsRequest } from '@/lib/rental-api';

type UiReceipt =
  | {
      type: 'sale';
      id: string;
      receiptNumber: string;
      vehicleBrand: string;
      vehicleModel: string;
      vehiclePlate: string;
      personName: string;
      personPhone: string;
      amount: number;
      date: string;
    }
  | {
      type: 'rental';
      id: string;
      receiptNumber: string;
      vehicleBrand: string;
      vehicleModel: string;
      vehiclePlate: string;
      personName: string;
      personPhone: string;
      amount: number;
      date: string;
    };

export default function Receipts() {
  const { data: receipts = [], isLoading, isError, error } = useQuery({
    queryKey: ['receipts', 'list'],
    queryFn: async (): Promise<UiReceipt[]> => {
      const [saleReceipts, rentalReceipts] = await Promise.all([
        listReceiptsRequest(),
        listRentalReceiptsRequest(),
      ]);

      const normalizedSales: UiReceipt[] = saleReceipts.map((receipt) => ({
        type: 'sale',
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        vehicleBrand: receipt.vehicleBrand,
        vehicleModel: receipt.vehicleModel,
        vehiclePlate: receipt.vehiclePlate,
        personName: receipt.buyerName,
        personPhone: receipt.buyerPhone,
        amount: receipt.amount,
        date: receipt.saleDate,
      }));

      const normalizedRentals: UiReceipt[] = rentalReceipts.map((receipt) => ({
        type: 'rental',
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        vehicleBrand: receipt.vehicleBrand,
        vehicleModel: receipt.vehicleModel,
        vehiclePlate: receipt.vehiclePlate,
        personName: receipt.tenantName,
        personPhone: receipt.tenantPhone,
        amount: receipt.rentalAmount,
        date: receipt.endDate,
      }));

      return [...normalizedSales, ...normalizedRentals].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    },
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
        <p className="text-muted-foreground mt-1">Historique des recus generes (ventes et locations)</p>
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
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    receipt.type === 'sale'
                      ? 'bg-success/10 text-success'
                      : 'bg-info/10 text-info'
                  }`}
                >
                  {receipt.type === 'sale' ? 'Vente' : 'Location'}
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
                  <p className="text-xs text-muted-foreground">
                    {receipt.type === 'sale' ? 'Acheteur' : 'Locataire'}
                  </p>
                  <p className="text-foreground font-medium">{receipt.personName}</p>
                  <p className="text-xs text-muted-foreground">{receipt.personPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Montant</p>
                  <p className="text-foreground font-semibold">{receipt.amount.toLocaleString()} CFA</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {receipt.type === 'sale' ? 'Date de vente' : 'Date fin location'}
                  </p>
                  <p className="text-foreground">{new Date(receipt.date).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <Receipt className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Aucun recu pour le moment.</p>
          <p className="text-sm text-muted-foreground mt-1">Les recus seront generes automatiquement lors des ventes et locations.</p>
        </div>
      )}
    </div>
  );
}
