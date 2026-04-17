import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, Landmark, Search, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  accountMovementsQueryKey,
  createFundTransferRequest,
  createManualExpenseRequest,
  listAccountMovementsRequest,
} from "@/lib/accounting-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MovementType = "entree" | "sortie";
type MovementSource = "caisse" | "banque" | "mobile-money" | "credit";
type PeriodFilter = "today" | "yesterday" | "week" | "month" | "year";

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

const sourceSelectOptions: { value: MovementSource; label: string }[] = [
  { value: "caisse", label: sourceLabel.caisse },
  { value: "banque", label: sourceLabel.banque },
  { value: "mobile-money", label: sourceLabel["mobile-money"] },
  { value: "credit", label: sourceLabel.credit },
];

const transferSourceOptions: { value: MovementSource; label: string }[] = [
  { value: "caisse", label: sourceLabel.caisse },
  { value: "banque", label: sourceLabel.banque },
  { value: "mobile-money", label: sourceLabel["mobile-money"] },
];

const expenseSourceOptions: { value: MovementSource; label: string }[] = [
  { value: "caisse", label: sourceLabel.caisse },
  { value: "mobile-money", label: "Orange Money" },
];

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "yesterday", label: "Hier" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois en cours" },
  { value: "year", label: "Année" },
];

const MOVEMENTS_PER_PAGE = 12;
const MOVEMENTS_PER_PAGE_MOBILE = 6;

const formatDateFr = (value: string) =>
  new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export default function ComptabilityPage() {
  const queryClient = useQueryClient();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("week");
  const [sourceFilter, setSourceFilter] = useState<"all" | MovementSource>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | MovementType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState<MovementSource>("caisse");
  const [transferTo, setTransferTo] = useState<MovementSource>("banque");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDesc, setTransferDesc] = useState("");
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseSource, setExpenseSource] = useState<MovementSource>("caisse");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
        manager: movement.createdByName,
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
    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return movementData.filter((movement) => {
      const movementDate = new Date(movement.operationDate);
      const matchesPeriod =
        periodFilter === "today"
          ? isSameDay(movementDate, now)
          : periodFilter === "yesterday"
            ? isSameDay(movementDate, yesterday)
            : periodFilter === "week"
              ? movementDate >= weekStart
              : periodFilter === "month"
                ? movementDate >= monthStart
                : movementDate >= yearStart;
      if (!matchesPeriod) return false;
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

  const movementsPerPage = isMobile ? MOVEMENTS_PER_PAGE_MOBILE : MOVEMENTS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / movementsPerPage));

  const paginatedMovements = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * movementsPerPage;
    return filteredMovements.slice(startIndex, startIndex + movementsPerPage);
  }, [currentPage, filteredMovements, movementsPerPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, periodFilter, sourceFilter, typeFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const sourceAvailableBalances = useMemo(() => {
    const balances: Record<MovementSource, number> = {
      caisse: 0,
      banque: 0,
      "mobile-money": 0,
      credit: 0,
    };
    for (const item of movementData) {
      const sign = item.type === "entree" ? 1 : -1;
      balances[item.source] += sign * item.amount;
    }
    return balances;
  }, [movementData]);

  const openTransferDialog = () => {
    setTimeout(() => setTransferOpen(true), 0);
  };

  const openExpenseDialog = () => {
    setTimeout(() => setExpenseOpen(true), 0);
  };

  const handleTransferFromChange = (value: MovementSource) => {
    setTransferFrom(value);
    if (value === transferTo) {
      const next = sourceSelectOptions.find((o) => o.value !== value)?.value ?? "banque";
      setTransferTo(next);
    }
  };

  const handleTransferToChange = (value: MovementSource) => {
    setTransferTo(value);
    if (value === transferFrom) {
      const next = sourceSelectOptions.find((o) => o.value !== value)?.value ?? "caisse";
      setTransferFrom(next);
    }
  };

  const handleSubmitTransfer = async () => {
    const amount = Number(transferAmount);
    if (transferFrom === transferTo) {
      toast.error("La source et la destination doivent etre differentes.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Indiquez un montant valide.");
      return;
    }
    const availableFromSource = sourceAvailableBalances[transferFrom];
    if (amount > availableFromSource) {
      toast.error(
        `Solde insuffisant dans ${sourceLabel[transferFrom]}. Disponible: ${availableFromSource.toLocaleString()} CFA.`,
      );
      return;
    }
    setSubmittingTransfer(true);
    try {
      await createFundTransferRequest({
        fromSource: transferFrom,
        toSource: transferTo,
        amount,
        description: transferDesc,
        operationDate: transferDate,
      });
      await queryClient.invalidateQueries({ queryKey: accountMovementsQueryKey });
      toast.success("Transfert enregistre.");
      setTransferOpen(false);
      setTransferAmount("");
      setTransferDesc("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Echec de l'enregistrement.");
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const handleSubmitExpense = async () => {
    const amount = Number(expenseAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Indiquez un montant valide.");
      return;
    }
    setSubmittingExpense(true);
    try {
      await createManualExpenseRequest({
        source: expenseSource,
        amount,
        description: expenseDesc,
        operationDate: expenseDate,
      });
      await queryClient.invalidateQueries({ queryKey: accountMovementsQueryKey });
      toast.success("Dépense enregistrée.");
      setExpenseOpen(false);
      setExpenseAmount("");
      setExpenseDesc("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Echec de l'enregistrement.");
    } finally {
      setSubmittingExpense(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in min-w-0 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Entrees et sorties</h1>
          <p className="text-sm text-muted-foreground mt-1">Suivi comptable simplifie des flux financiers.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium cursor-pointer border-0 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Ajouter un mouvement
              <ChevronDown className="w-4 h-4 opacity-90" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[14rem]">
            <DropdownMenuItem className="cursor-pointer" onSelect={openTransferDialog}>
              Transfert de fonds
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onSelect={openExpenseDialog}>
              Faire une dépense
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-emerald-200/40 bg-emerald-500/10 p-4 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-600">Caisse</p>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <p
            className={`mt-2 text-2xl sm:text-3xl font-bold break-words ${
              metrics.caisse.net < 0 ? "text-rose-600" : "text-foreground"
            }`}
          >
            {metrics.caisse.net.toLocaleString()} CFA
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Déductions : {metrics.caisse.sortie.toLocaleString()} CFA
          </p>
        </div>
        <div className="rounded-xl border border-sky-200/40 bg-sky-500/10 p-4 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-sky-600">Banque</p>
            <Landmark className="w-4 h-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-foreground break-words">{metrics.banque.net.toLocaleString()} CFA</p>
          <p className="text-xs text-muted-foreground mt-1">Période: {periodOptions.find((o) => o.value === periodFilter)?.label}</p>
        </div>
        <div className="rounded-xl border border-violet-200/40 bg-violet-500/10 p-4 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-violet-600">Mobile Money</p>
            <Smartphone className="w-4 h-4 text-violet-500" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-foreground break-words">{metrics.mobileMoney.net.toLocaleString()} CFA</p>
          <p className="text-xs text-muted-foreground mt-1">Période: {periodOptions.find((o) => o.value === periodFilter)?.label}</p>
        </div>
        <div className="rounded-xl border border-amber-200/40 bg-amber-500/10 p-4 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-600">Credit</p>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-foreground break-words">{metrics.credit.net.toLocaleString()} CFA</p>
          <p className="text-xs text-muted-foreground mt-1">Période: {periodOptions.find((o) => o.value === periodFilter)?.label}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm min-w-0">
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
            onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}
            className="w-full lg:w-auto px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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
          {paginatedMovements.map((movement) => (
            <div key={`mobile-${movement.id}`} className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground break-words">{movement.reference}</p>
                  <p className="text-xs text-muted-foreground">{formatDateFr(movement.createdAt)}</p>
                </div>
                <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground">
                  {sourceLabel[movement.source]} - {directionLabel[movement.type]}
                </span>
              </div>
              <p className="text-sm text-foreground break-words">{movement.label}</p>
              <p className="text-xs text-muted-foreground break-words">{movement.origin}</p>
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

        <div className="hidden lg:block w-full max-w-full overflow-x-auto overflow-y-hidden">
          <table className="w-full min-w-[1200px] text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="py-3 px-2 text-muted-foreground font-medium whitespace-nowrap">N°</th>
                <th className="py-3 px-2 text-muted-foreground font-medium whitespace-nowrap">Date creation</th>
                <th className="py-3 px-2 text-muted-foreground font-medium whitespace-nowrap">Origine</th>
                <th className="py-3 px-2 text-muted-foreground font-medium whitespace-nowrap">Designation</th>
                <th className="py-3 px-2 text-muted-foreground font-medium whitespace-nowrap">Categorie</th>
                <th className="py-3 px-2 text-muted-foreground font-medium whitespace-nowrap">Resp</th>
                <th className="py-3 px-2 text-muted-foreground font-medium whitespace-nowrap">Prix U</th>
                <th className="py-3 px-2 text-muted-foreground font-medium whitespace-nowrap">Qte</th>
                <th className="py-3 px-2 text-muted-foreground font-medium whitespace-nowrap">Montant</th>
                <th className="py-3 px-2 text-muted-foreground font-medium whitespace-nowrap">Source</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMovements.map((movement) => (
                <tr key={movement.id} className="border-b border-border/60 hover:bg-secondary/35 transition-colors">
                  <td className="py-3 px-2 whitespace-nowrap">{movement.reference}</td>
                  <td className="py-3 px-2 whitespace-nowrap">{formatDateFr(movement.createdAt)}</td>
                  <td className="py-3 px-2 whitespace-nowrap">{movement.origin}</td>
                  <td className="py-3 px-2 whitespace-nowrap">{movement.label}</td>
                  <td className="py-3 px-2 whitespace-nowrap">
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
                                : movement.category.toLowerCase().includes("transfert")
                                  ? "bg-amber-100 text-amber-800"
                                  : movement.category.toLowerCase().includes("depense")
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-secondary text-foreground"
                      }`}
                    >
                      {movement.category}
                    </span>
                  </td>
                  <td className="py-3 px-2 whitespace-nowrap">{movement.manager}</td>
                  <td className="py-3 px-2 whitespace-nowrap">{movement.unitPrice.toLocaleString()} CFA</td>
                  <td className="py-3 px-2 whitespace-nowrap">{movement.quantity}</td>
                  <td
                    className={`py-3 px-2 whitespace-nowrap font-semibold ${
                      movement.type === "sortie" ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {movement.type === "sortie" ? "-" : "+"}
                    {movement.amount.toLocaleString()} CFA
                  </td>
                  <td className="py-3 px-2 whitespace-nowrap">
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

        {filteredMovements.length > movementsPerPage && (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Affichage {(currentPage - 1) * movementsPerPage + 1}
              {" - "}
              {Math.min(currentPage * movementsPerPage, filteredMovements.length)} sur {filteredMovements.length}
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

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfert de fonds</DialogTitle>
            <DialogDescription>
              Deplacez un montant d&apos;une source vers une autre (sortie + entree liees).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-foreground mb-1">Source</label>
                <select
                  value={transferFrom}
                  onChange={(e) => handleTransferFromChange(e.target.value as MovementSource)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
                >
                  {transferSourceOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-foreground mb-1">Destination</label>
                <select
                  value={transferTo}
                  onChange={(e) => handleTransferToChange(e.target.value as MovementSource)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
                >
                  {sourceSelectOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Disponible dans {sourceLabel[transferFrom]} :{" "}
              {sourceAvailableBalances[transferFrom].toLocaleString()} CFA
            </p>
            <div>
              <label className="block text-sm text-foreground mb-1">Montant (CFA)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Date de l&apos;operation</label>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Description</label>
              <textarea
                rows={2}
                value={transferDesc}
                onChange={(e) => setTransferDesc(e.target.value)}
                placeholder="Motif de Transfert"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setTransferOpen(false)}
              className="px-4 py-2.5 rounded-lg border border-border text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmitTransfer}
              disabled={submittingTransfer}
              className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
            >
              {submittingTransfer ? "Enregistrement..." : "Enregistrer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Faire une dépense</DialogTitle>
            <DialogDescription>Enregistrez une sortie de fonds (hors réparation véhicule).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-foreground mb-1">Source</label>
              <select
                value={expenseSource}
                onChange={(e) => setExpenseSource(e.target.value as MovementSource)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
              >
                {expenseSourceOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Montant (CFA)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Date de l&apos;operation</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Motif</label>
              <textarea
                rows={2}
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                placeholder="Ex: Achat fournitures, frais administratifs..."
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setExpenseOpen(false)}
              className="px-4 py-2.5 rounded-lg border border-border text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmitExpense}
              disabled={submittingExpense}
              className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
            >
              {submittingExpense ? "Enregistrement..." : "Enregistrer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
