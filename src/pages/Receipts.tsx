import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Printer, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { getPaymentMethodLabel, listReceiptsRequest, type CreateSalePayload } from '@/lib/sale-api';
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
      buyerEmail: string | null;
      buyerAddress: string;
      buyerIdCardNumber: string;
      paymentMethod: CreateSalePayload['paymentMethod'];
      notes: string | null;
      issuedAt: string;
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
      tenantIdCardNumber: string;
      startDate: string;
      endDate: string;
      totalDays: number;
      dailyPrice: number;
      issuedAt: string;
    };

function formatCurrency(amount: number) {
  return `${amount.toLocaleString('fr-FR')} CFA`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('fr-FR');
}

const RECEIPTS_PER_PAGE = 12;

function printInvoice(receipt: UiReceipt) {
  const popup = window.open('', '_blank', 'width=960,height=720');
  if (!popup) {
    toast.error("Impossible d'ouvrir la fenetre d'impression.");
    return;
  }

  const content =
    receipt.type === 'sale'
      ? `
        <div class="section">
          <div class="section-title">Acheteur</div>
          <div class="grid">
            <div><span>Nom</span><strong>${receipt.personName}</strong></div>
            <div><span>Téléphone</span><strong>${receipt.personPhone}</strong></div>
            <div><span>Email</span><strong>${receipt.buyerEmail ?? '-'}</strong></div>
            <div><span>Pièce</span><strong>${receipt.buyerIdCardNumber}</strong></div>
            <div class="full"><span>Adresse</span><strong>${receipt.buyerAddress}</strong></div>
            <div><span>Paiement</span><strong>${getPaymentMethodLabel(receipt.paymentMethod)}</strong></div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Facturation</div>
          <table>
            <thead><tr><th>Désignation</th><th>Montant</th></tr></thead>
            <tbody><tr><td>Vente du véhicule ${receipt.vehicleBrand} ${receipt.vehicleModel} (${receipt.vehiclePlate})</td><td>${formatCurrency(receipt.amount)}</td></tr></tbody>
            <tfoot><tr><td>Total</td><td>${formatCurrency(receipt.amount)}</td></tr></tfoot>
          </table>
        </div>
        ${receipt.notes ? `<div class="notes"><strong>Observations :</strong> ${receipt.notes}</div>` : ''}
      `
      : `
        <div class="section">
          <div class="section-title">Locataire</div>
          <div class="grid">
            <div><span>Nom</span><strong>${receipt.personName}</strong></div>
            <div><span>Téléphone</span><strong>${receipt.personPhone}</strong></div>
            <div><span>Pièce</span><strong>${receipt.tenantIdCardNumber}</strong></div>
            <div><span>Période</span><strong>${formatDateTime(receipt.startDate)} au ${formatDateTime(receipt.endDate)}</strong></div>
            <div><span>Durée</span><strong>${receipt.totalDays} jour(s)</strong></div>
            <div><span>Tarif / jour</span><strong>${formatCurrency(receipt.dailyPrice)}</strong></div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Facturation</div>
          <table>
            <thead><tr><th>Désignation</th><th>Montant</th></tr></thead>
            <tbody><tr><td>Location du véhicule ${receipt.vehicleBrand} ${receipt.vehicleModel} (${receipt.vehiclePlate})</td><td>${formatCurrency(receipt.amount)}</td></tr></tbody>
            <tfoot><tr><td>Total</td><td>${formatCurrency(receipt.amount)}</td></tr></tfoot>
          </table>
        </div>
      `;

  popup.document.write(`
    <html>
      <head>
        <title>${receipt.receiptNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #0f172a; }
          .invoice { max-width: 920px; margin: 0 auto; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; border-bottom:2px solid #e2e8f0; padding-bottom:24px; }
          .brand { font-size: 28px; font-weight: 700; }
          .muted { color:#64748b; font-size:14px; }
          .badge { display:inline-block; padding:6px 10px; border-radius:999px; background:#eff6ff; color:#1d4ed8; font-weight:600; font-size:12px; }
          .section { margin-top: 24px; }
          .section-title { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color:#64748b; margin-bottom:12px; }
          .grid { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
          .grid div { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px; }
          .grid .full { grid-column: 1 / -1; }
          span { display:block; font-size:12px; color:#64748b; margin-bottom:4px; }
          strong { font-size:14px; }
          table { width:100%; border-collapse: collapse; }
          th, td { padding:14px 12px; border-bottom:1px solid #e2e8f0; text-align:left; }
          tfoot td { font-weight:700; font-size:16px; }
          .notes { margin-top:20px; padding:14px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; }
        </style>
      </head>
      <body>
        <div class="invoice">
          <div class="header">
            <div>
              <div class="brand">Gestion Parking</div>
              <div class="muted">Document généré automatiquement</div>
            </div>
            <div>
              <div class="badge">${receipt.type === 'sale' ? 'Facture de vente' : 'Reçu de location'}</div>
              <div style="margin-top:12px"><span>Numéro</span><strong>${receipt.receiptNumber}</strong></div>
              <div><span>Date</span><strong>${formatDateTime(receipt.type === 'sale' ? receipt.date : receipt.issuedAt)}</strong></div>
            </div>
          </div>
          ${content}
        </div>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

export default function Receipts() {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'sale' | 'rental'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const { data: receipts = [], isLoading, isError, error } = useQuery({
    queryKey: ['receipts', 'list'],
    queryFn: async (): Promise<UiReceipt[]> => {
      const [saleReceiptsResult, rentalReceiptsResult] = await Promise.allSettled([
        listReceiptsRequest(),
        listRentalReceiptsRequest(),
      ]);

      const saleReceipts =
        saleReceiptsResult.status === 'fulfilled' ? saleReceiptsResult.value : [];
      const rentalReceipts =
        rentalReceiptsResult.status === 'fulfilled' ? rentalReceiptsResult.value : [];

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
        buyerEmail: receipt.buyerEmail,
        buyerAddress: receipt.buyerAddress,
        buyerIdCardNumber: receipt.buyerIdCardNumber,
        paymentMethod: receipt.paymentMethod,
        notes: receipt.notes,
        issuedAt: receipt.issuedAt,
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
        tenantIdCardNumber: receipt.tenantIdCardNumber,
        startDate: receipt.startDate,
        endDate: receipt.endDate,
        totalDays: receipt.totalDays,
        dailyPrice: receipt.dailyPrice,
        issuedAt: receipt.issuedAt,
      }));

      return [...normalizedSales, ...normalizedRentals].sort(
        (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
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

  const highlightedReceiptId = searchParams.get('highlight');
  const highlightedReceipt = useMemo(
    () => receipts.find((receipt) => receipt.id === highlightedReceiptId) ?? null,
    [receipts, highlightedReceiptId],
  );

  const filteredReceipts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return receipts.filter((receipt) => {
      const matchesType = selectedType === 'all' || receipt.type === selectedType;
      if (!matchesType) return false;

      if (!normalizedSearch) return true;

      const haystack = [
        receipt.receiptNumber,
        receipt.vehicleBrand,
        receipt.vehicleModel,
        receipt.vehiclePlate,
        receipt.personName,
        receipt.personPhone,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [receipts, searchTerm, selectedType]);

  const totalPages = Math.max(1, Math.ceil(filteredReceipts.length / RECEIPTS_PER_PAGE));

  const paginatedReceipts = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * RECEIPTS_PER_PAGE;
    return filteredReceipts.slice(startIndex, startIndex + RECEIPTS_PER_PAGE);
  }, [currentPage, filteredReceipts, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedType]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Factures et recus</h1>
        <p className="text-muted-foreground mt-1">Documents generes automatiquement pour les ventes et locations.</p>
      </div>

      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">Chargement des recus...</p>
        </div>
      ) : receipts.length > 0 ? (
        <div className="space-y-5">
          {highlightedReceipt && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Derniere facture generee : {highlightedReceipt.receiptNumber}</p>
                <p className="text-sm text-muted-foreground">Le document est pret pour impression et remise au client.</p>
              </div>
              <button
                type="button"
                onClick={() => printInvoice(highlightedReceipt)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Printer className="h-4 w-4" />
                Imprimer
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Rechercher par numero, client, vehicule ou plaque"
                  className="w-full rounded-lg border border-border bg-secondary py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedType('all')}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    selectedType === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-foreground hover:bg-secondary'
                  }`}
                >
                  Tous
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType('sale')}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    selectedType === 'sale'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-foreground hover:bg-secondary'
                  }`}
                >
                  Ventes
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType('rental')}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    selectedType === 'rental'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-foreground hover:bg-secondary'
                  }`}
                >
                  Locations
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                {filteredReceipts.length} document(s) trouve(s)
                {filteredReceipts.length > RECEIPTS_PER_PAGE ? ` · page ${currentPage} / ${totalPages}` : ''}
              </p>
              <p>{receipts.length} document(s) au total</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedReceipts.map((receipt) => (
              <div
                key={receipt.id}
                className={`rounded-2xl border bg-card shadow-sm overflow-hidden ${
                  highlightedReceiptId === receipt.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                }`}
              >
                <div className="border-b border-dashed border-border bg-muted/20 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Gestion Parking</p>
                      <h2 className="mt-1 text-base font-bold text-foreground">
                        {receipt.type === 'sale' ? 'Facture de vente' : 'Recu de location'}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Emis le {formatDateTime(receipt.type === 'sale' ? receipt.date : receipt.issuedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">Numero</p>
                      <p className="text-sm font-semibold text-foreground">{receipt.receiptNumber}</p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          receipt.type === 'sale' ? 'bg-success/10 text-success' : 'bg-info/10 text-info'
                        }`}
                      >
                        {receipt.type === 'sale' ? 'Vente' : 'Location'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 px-4 py-4">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {receipt.type === 'sale' ? 'Client' : 'Locataire'}
                    </p>
                    <p className="truncate text-sm font-semibold text-foreground">{receipt.personName}</p>
                    <p className="text-xs text-muted-foreground">{receipt.personPhone}</p>
                  </div>

                  <div className="rounded-xl border border-border bg-secondary/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vehicule</p>
                        <p className="truncate text-sm font-semibold text-foreground">
                          {receipt.vehicleBrand} {receipt.vehicleModel}
                        </p>
                        <p className="text-xs text-muted-foreground">{receipt.vehiclePlate}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted-foreground">Total</p>
                        <p className="text-base font-bold text-foreground">{formatCurrency(receipt.amount)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-border px-3 py-2">
                      <p className="text-muted-foreground">Document</p>
                      <p className="mt-1 font-medium text-foreground">
                        {receipt.type === 'sale' ? 'Facture vente' : 'Recu location'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border px-3 py-2">
                      <p className="text-muted-foreground">
                        {receipt.type === 'sale' ? 'Paiement' : 'Duree'}
                      </p>
                      <p className="mt-1 font-medium text-foreground">
                        {receipt.type === 'sale'
                          ? getPaymentMethodLabel(receipt.paymentMethod)
                          : `${receipt.totalDays} jour(s)`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <div className="mr-auto text-[11px] text-muted-foreground">
                      {receipt.type === 'sale'
                        ? 'Facture prete pour consultation'
                        : 'Recu pret pour impression'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => printInvoice(receipt)}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
                      >
                        <Printer className="h-4 w-4" />
                        Imprimer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredReceipts.length === 0 && (
            <div className="glass-card p-12 text-center">
              <Search className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">Aucun document ne correspond a ta recherche.</p>
            </div>
          )}

          {filteredReceipts.length > RECEIPTS_PER_PAGE && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Affichage {(currentPage - 1) * RECEIPTS_PER_PAGE + 1}
                {' - '}
                {Math.min(currentPage * RECEIPTS_PER_PAGE, filteredReceipts.length)} sur {filteredReceipts.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Precedent
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <Search className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Aucun recu pour le moment.</p>
          <p className="text-sm text-muted-foreground mt-1">Les recus seront generes automatiquement lors des ventes et locations.</p>
        </div>
      )}
    </div>
  );
}
