import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Landmark, Search, Smartphone, Wallet } from "lucide-react";

type MovementType = "entree" | "sortie" | "transfert" | "credit";
type MovementSource = "caisse" | "banque" | "mobile-money" | "credit";

type Movement = {
  id: string;
  reference: string;
  createdAt: string;
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

const typeLabel: Record<MovementType, string> = {
  entree: "Entree",
  sortie: "Sortie",
  transfert: "Transfert",
  credit: "Credit",
};

const movementData: Movement[] = [
  {
    id: "m1",
    reference: "C-002-04-2026",
    createdAt: "2026-04-13T11:00:00.000Z",
    origin: "POS - Agence ACI",
    label: "Vente location weekend",
    category: "Location",
    manager: "Diakari D.",
    unitPrice: 154000,
    quantity: 1,
    amount: 154000,
    type: "entree",
    source: "caisse",
  },
  {
    id: "m2",
    reference: "B-008-04-2026",
    createdAt: "2026-04-14T10:20:00.000Z",
    origin: "Virement client",
    label: "Acompte vente vehicule",
    category: "Vente",
    manager: "Aicha K.",
    unitPrice: 350000,
    quantity: 1,
    amount: 350000,
    type: "entree",
    source: "banque",
  },
  {
    id: "m3",
    reference: "MM-003-04-2026",
    createdAt: "2026-04-15T15:30:00.000Z",
    origin: "Orange Money",
    label: "Remboursement reservation",
    category: "Reservation",
    manager: "Fatou T.",
    unitPrice: 10000,
    quantity: 1,
    amount: 10000,
    type: "sortie",
    source: "mobile-money",
  },
  {
    id: "m4",
    reference: "CR-001-04-2026",
    createdAt: "2026-04-16T08:00:00.000Z",
    origin: "Paiement differe",
    label: "Paiement partiel entreprise",
    category: "Credit client",
    manager: "Paul N.",
    unitPrice: 267900,
    quantity: 1,
    amount: 267900,
    type: "credit",
    source: "credit",
  },
];

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

  const filteredMovements = useMemo(() => {
    return movementData.filter((movement) => {
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
  }, [search, sourceFilter, typeFilter]);

  const metrics = useMemo(() => {
    const bySource = (source: MovementSource) =>
      filteredMovements.filter((item) => item.source === source).reduce((sum, item) => sum + item.amount, 0);
    return {
      caisse: bySource("caisse"),
      banque: bySource("banque"),
      mobileMoney: bySource("mobile-money"),
      credit: bySource("credit"),
    };
  }, [filteredMovements]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Entrees et sorties</h1>
          <p className="text-sm text-muted-foreground mt-1">Suivi comptable simplifie des flux financiers.</p>
        </div>
        <button className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          Effectuer un mouvement
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-emerald-200/40 bg-emerald-500/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-600">Caisse</p>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{metrics.caisse.toLocaleString()} CFA</p>
          <p className="text-xs text-muted-foreground mt-1">Periode: {periodFilter}</p>
        </div>
        <div className="rounded-xl border border-sky-200/40 bg-sky-500/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-sky-600">Banque</p>
            <Landmark className="w-4 h-4 text-sky-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{metrics.banque.toLocaleString()} CFA</p>
          <p className="text-xs text-muted-foreground mt-1">Periode: {periodFilter}</p>
        </div>
        <div className="rounded-xl border border-violet-200/40 bg-violet-500/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-violet-600">Mobile Money</p>
            <Smartphone className="w-4 h-4 text-violet-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{metrics.mobileMoney.toLocaleString()} CFA</p>
          <p className="text-xs text-muted-foreground mt-1">Periode: {periodFilter}</p>
        </div>
        <div className="rounded-xl border border-amber-200/40 bg-amber-500/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-600">Credit</p>
            <ArrowDownLeft className="w-4 h-4 text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{metrics.credit.toLocaleString()} CFA</p>
          <p className="text-xs text-muted-foreground mt-1">Periode: {periodFilter}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
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
            className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
          >
            <option value="semaine">Semaine</option>
            <option value="mois">Mois</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as "all" | MovementSource)}
            className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
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
            { key: "transfert", label: "Transferts" },
            { key: "credit", label: "Credit" },
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

        <div className="overflow-x-auto">
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
                <th className="py-3 px-2 text-muted-foreground font-medium">Type</th>
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
                  <td className="py-3 px-2">{movement.category}</td>
                  <td className="py-3 px-2">{movement.manager}</td>
                  <td className="py-3 px-2">{movement.unitPrice.toLocaleString()} CFA</td>
                  <td className="py-3 px-2">{movement.quantity}</td>
                  <td className="py-3 px-2 font-semibold">{movement.amount.toLocaleString()} CFA</td>
                  <td className="py-3 px-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                        movement.type === "entree"
                          ? "bg-emerald-100 text-emerald-700"
                          : movement.type === "sortie"
                            ? "bg-rose-100 text-rose-700"
                            : movement.type === "transfert"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {movement.type === "entree" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                      {typeLabel[movement.type]}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                      {sourceLabel[movement.source]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
