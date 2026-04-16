import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark, Search, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { accountMovementsQueryKey, listAccountMovementsRequest } from "@/lib/accounting-api";

type MovementType = "entree" | "sortie";
type MovementSource = "caisse" | "banque" | "mobile-money" | "credit";

type Movement = {
  id: string;
  reference: string;
  /** Date d'enregistrement du mouvement (Firestore) — tri et colonne « Date creation ». */
  createdAt: string;
  /** Date métier de l'opération — filtre semaine / mois. */
  operationDate: string;
  origin: string;
  label: string;
  category: string;
  manager: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  type: MovementType;
  source: MovementSource;
};

const sourceLabel: Record<MovementSource, string> = {
  caisse: "Caisse",
  banque: "Banque",
  "mobile-money": "Mobile Money",
  credit: "Credit",
};

const directionLabel: Record<MovementType, string> = {
  entree: "Entree",
  sortie: "Sortie",
};

const formatDateFr = (value: string) =>
  new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export default function ComptabilityPage() {
  const [periodFilter, setPeriodFilter] = useState<"semaine" | "mois">("semaine");
  const [sourceFilter, setSourceFilter] = useState<"all" | MovementSource>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | MovementType>("all");
  const [search, setSearch] = useState("");
  const {
    data: accountMovements = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: accountMovementsQueryKey,
    queryFn: listAccountMovementsRequest,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger les mouvements comptables.");
    }
  }, [isError, error]);

  const movementData = useMemo<Movement[]>(() => {
    return accountMovements
      .map((movement) => ({
        id: movement.id,
        reference: movement.reference,
        createdAt: movement.createdAt,
        operationDate: movement.operationDate,
        origin: `${movement.vehicleBrand} ${movement.vehicleModel} · ${movement.vehiclePlate}`,
        label: movement.description,
        category: movement.category,
        manager: movement.counterpartyName,
        unitPrice: movement.unitPrice,
        quantity: movement.quantity,
        amount: movement.amount,
        type: movement.direction,
        source: movement.source,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [accountMovements]);

  const filteredMovements = useMemo(() => {
    const now = new Date();
    const startDate =
      periodFilter === "semaine"
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return movementData.filter((movement) => {
      const movementDate = new Date(movement.operationDate);
      if (movementDate < startDate) return false;
      if (sourceFilter !== "all" && movement.source !== sourceFilter) return false;
      if (typeFilter !== "all" && movement.type !== typeFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return (
        movement.reference.toLowerCase().includes(q) ||
        movement.origin.toLowerCase().includes(q) ||
        movement.label.toLowerCase().includes(q) ||
        movement.manager.toLowerCase().includes(q)
      );
    });
  }, [movementData, periodFilter, search, sourceFilter, typeFilter]);

  const metrics = useMemo(() => {
    const accumulate = (source: MovementSource) => {
      let entree = 0;
      let sortie = 0;
      for (const item of filteredMovements) {
        if (item.source !== source) continue;
        if (item.type === "entree") entree += item.amount;
        else sortie += item.amount;
      }
      return { entree, sortie, net: entree - sortie };
    };
    return {
      caisse: accumulate("caisse"),
      banque: accumulate("banque"),
      mobileMoney: accumulate("mobile-money"),
      credit: accumulate("credit"),
    };
  }, [filteredMovements]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Entrees et sorties</h1>
          <p className="text-sm text-muted-foreground mt-1">Suivi comptable simplifie des flux financiers.</p>
        </div>
        <div className="px-4 py-2.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">
          {filteredMovements.length} mouvement(s)
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-emerald-200/40 bg-emerald-500/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-600">Caisse</p>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <p
            className={`mt-2 text-3xl font-bold ${
              metrics.caisse.net < 0 ? "text-rose-600" : "text-foreground"
            }`}
          >
            {metrics.caisse.net.toLocaleString()} CFA
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Déductions : {metrics.caisse.sortie.toLocaleString()} CFA
          </p>
        </div>
        <div className="rounded-xl border border-sky-200/40 bg-sky-500/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-sky-600">Banque</p>
            <Landmark className="w-4 h-4 text-sky-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{metrics.banque.net.toLocaleString()} CFA</p>
          <p className="text-xs text-muted-foreground mt-1">Periode: {periodFilter}</p>
        </div>
        <div className="rounded-xl border border-violet-200/40 bg-violet-500/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-violet-600">Mobile Money</p>
            <Smartphone className="w-4 h-4 text-violet-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{metrics.mobileMoney.net.toLocaleString()} CFA</p>
          <p className="text-xs text-muted-foreground mt-1">Periode: {periodFilter}</p>
        </div>
        <div className="rounded-xl border border-amber-200/40 bg-amber-500/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-600">Credit</p>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{metrics.credit.net.toLocaleString()} CFA</p>
          <p className="text-xs text-muted-foreground mt-1">Periode: {periodFilter}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3">
          <div className="relative min-w-0">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher reference, origine, designation..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
            />
          </div>
          <select
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value as "semaine" | "mois")}
            className="w-full lg:w-auto px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
          >
            <option value="semaine">Semaine</option>
            <option value="mois">Mois</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as "all" | MovementSource)}
            className="w-full lg:w-auto px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
          >
            <option value="all">Toutes les sources</option>
            <option value="caisse">Caisse</option>
            <option value="banque">Banque</option>
            <option value="mobile-money">Mobile Money</option>
            <option value="credit">Credit</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "Tous les mouvements" },
            { key: "entree", label: "Entrees" },
            { key: "sortie", label: "Sorties" },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setTypeFilter(option.key as "all" | MovementType)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                typeFilter === option.key ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="space-y-3 lg:hidden">
          {filteredMovements.map((movement) => (
            <div key={`mobile-${movement.id}`} className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{movement.reference}</p>
                  <p className="text-xs text-muted-foreground">{formatDateFr(movement.createdAt)}</p>
                </div>
                <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground">
                  {sourceLabel[movement.source]} - {directionLabel[movement.type]}
                </span>
              </div>
              <p className="text-sm text-foreground">{movement.label}</p>
              <p className="text-xs text-muted-foreground">{movement.origin}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Categorie</p>
                  <p className="text-foreground font-medium">{movement.category}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Responsable</p>
                  <p className="text-foreground font-medium">{movement.manager}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Prix U</p>
                  <p className="text-foreground">{movement.unitPrice.toLocaleString()} CFA</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Qte</p>
                  <p className="text-foreground">{movement.quantity}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Montant</p>
                  <p
                    className={`text-sm font-semibold ${movement.type === "sortie" ? "text-rose-600" : "text-emerald-600"}`}
                  >
                    {movement.type === "sortie" ? "-" : "+"}
                    {movement.amount.toLocaleString()} CFA
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="py-3 px-2 text-muted-foreground font-medium">N°</th>
                <th className="py-3 px-2 text-muted-foreground font-medium">Date creation</th>
                <th className="py-3 px-2 text-muted-foreground font-medium">Origine</th>
                <th className="py-3 px-2 text-muted-foreground font-medium">Designation</th>
                <th className="py-3 px-2 text-muted-foreground font-medium">Categorie</th>
                <th className="py-3 px-2 text-muted-foreground font-medium">Resp</th>
                <th className="py-3 px-2 text-muted-foreground font-medium">Prix U</th>
                <th className="py-3 px-2 text-muted-foreground font-medium">Qte</th>
                <th className="py-3 px-2 text-muted-foreground font-medium">Montant</th>
                <th className="py-3 px-2 text-muted-foreground font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((movement) => (
                <tr key={movement.id} className="border-b border-border/60 hover:bg-secondary/35 transition-colors">
                  <td className="py-3 px-2">{movement.reference}</td>
                  <td className="py-3 px-2">{formatDateFr(movement.createdAt)}</td>
                  <td className="py-3 px-2">{movement.origin}</td>
                  <td className="py-3 px-2">{movement.label}</td>
                  <td className="py-3 px-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        movement.category.toLowerCase().includes("vente")
                          ? "bg-emerald-100 text-emerald-700"
                          : movement.category.toLowerCase().includes("location")
                            ? "bg-sky-100 text-sky-700"
                            : movement.category.toLowerCase().includes("reservation")
                              ? "bg-violet-100 text-violet-700"
                              : movement.category.toLowerCase().includes("reparation")
                                ? "bg-rose-100 text-rose-700"
                                : "bg-secondary text-foreground"
                      }`}
                    >
                      {movement.category}
                    </span>
                  </td>
                  <td className="py-3 px-2">{movement.manager}</td>
                  <td className="py-3 px-2">{movement.unitPrice.toLocaleString()} CFA</td>
                  <td className="py-3 px-2">{movement.quantity}</td>
                  <td
                    className={`py-3 px-2 font-semibold ${
                      movement.type === "sortie" ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {movement.type === "sortie" ? "-" : "+"}
                    {movement.amount.toLocaleString()} CFA
                  </td>
                  <td className="py-3 px-2">
                    <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                      {sourceLabel[movement.source]} - {directionLabel[movement.type]}
                    </span>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-muted-foreground">
                    Aucun mouvement comptable trouve pour ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && filteredMovements.length === 0 && (
          <div className="py-8 text-center text-muted-foreground lg:hidden">
            Aucun mouvement comptable trouve pour ces filtres.
          </div>
        )}
      </div>
    </div>
  );
}
