import { type MouseEvent, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Car, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge from '@/components/StatusBadge';
import { accountMovementsQueryKey } from '@/lib/accounting-api';
import type { AppPermission } from '@/lib/access-control';
import { getCurrentUserAccessProfile } from '@/lib/access-control';
import { LIVE_COLLAB_REFETCH_MS, useVehicleDetailQuery, vehicleQueryKeys } from '@/lib/vehicle-queries';
import { completeRentalRequest, listRentalsRequest, reconcileVehicleRentalStatusRequest } from '@/lib/rental-api';
import { listSalesRequest } from '@/lib/sale-api';
import {
  cancelReservationRequest,
  completeRepairRequest,
  createRepairRequest,
  listRepairsRequest,
  createReservationRequest,
  listReservationsRequest,
} from '@/lib/vehicle-action-api';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: accessProfile } = useQuery({
    queryKey: ['access-profile'],
    queryFn: getCurrentUserAccessProfile,
  });
  const can = (permission: AppPermission) => accessProfile?.permissions?.[permission] === true;
  const canSell = can('receipts');
  const canRent = can('rentals');
  const canReserve = can('reservations');
  const canUseVehiclesModule = can('vehicles');

  const { data: vehicle, isLoading, isError, error } = useVehicleDetailQuery(id, { live: true });
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [completingRental, setCompletingRental] = useState(false);
  const [showCompleteRentalPopup, setShowCompleteRentalPopup] = useState(false);
  const [rentalEndMileage, setRentalEndMileage] = useState('');
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showCancelReservationPopup, setShowCancelReservationPopup] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showCompleteRepairPopup, setShowCompleteRepairPopup] = useState(false);
  const [submittingReservation, setSubmittingReservation] = useState(false);
  const [submittingRepair, setSubmittingRepair] = useState(false);
  const [completingRepair, setCompletingRepair] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [reservationNotes, setReservationNotes] = useState('');
  const [reservationDate, setReservationDate] = useState(new Date().toISOString().slice(0, 10));
  const [reservationEndDate, setReservationEndDate] = useState('');
  const [reservationAmountPaid, setReservationAmountPaid] = useState('');

  const [repairReason, setRepairReason] = useState('');
  const [repairCost, setRepairCost] = useState('');
  const [repairStartDate, setRepairStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [repairExpectedEndDate, setRepairExpectedEndDate] = useState('');
  const [repairGarageName, setRepairGarageName] = useState('');
  const [repairTechnicianName, setRepairTechnicianName] = useState('');
  const [repairNotes, setRepairNotes] = useState('');

  const { data: rentals = [], isLoading: loadingRentals } = useQuery({
    queryKey: ['rentals', 'list'],
    queryFn: listRentalsRequest,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchInterval: LIVE_COLLAB_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', 'list'],
    queryFn: listReservationsRequest,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchInterval: LIVE_COLLAB_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
  const { data: sales = [] } = useQuery({
    queryKey: ['sales', 'list'],
    queryFn: listSalesRequest,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchInterval: LIVE_COLLAB_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
  const { data: repairs = [] } = useQuery({
    queryKey: ['repairs', 'list'],
    queryFn: listRepairsRequest,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchInterval: LIVE_COLLAB_REFETCH_MS,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger le vehicule.");
    }
  }, [isError, error]);

  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [vehicle?.id]);

  useEffect(() => {
    if (!vehicle || vehicle.photos.length <= 1) return;

    const timer = window.setInterval(() => {
      setCurrentPhotoIndex((prev) => (prev + 1) % vehicle.photos.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [vehicle]);

  useEffect(() => {
    if (!vehicle || loadingRentals) return;
    if (vehicle.status !== 'rented') return;
    const hasActiveRental = rentals.some(
      (rental) => rental.vehicleId === vehicle.id && rental.status?.trim().toLowerCase() === 'active',
    ) || rentals.some((rental) => rental.vehicleId === vehicle.id && !rental.completedAt);
    if (hasActiveRental) return;

    void (async () => {
      try {
        const reconciled = await reconcileVehicleRentalStatusRequest(vehicle.id);
        if (reconciled) {
          await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
          toast.success("Statut du véhicule synchronisé automatiquement.");
        }
      } catch {
        // Silence: la synchronisation peut échouer temporairement si les règles ne sont pas encore déployées.
      }
    })();
  }, [vehicle, loadingRentals, rentals, queryClient]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary mb-3" />
        <p className="text-muted-foreground text-lg">Chargement du vehicule...</p>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground text-lg">Véhicule introuvable</p>
        <Link to="/vehicles" className="mt-4 text-primary hover:underline text-sm">← Retour à la liste</Link>
      </div>
    );
  }

  const details = [
    { label: 'Marque', value: vehicle.brand },
    { label: 'Modele', value: vehicle.model },
    { label: 'Annee', value: vehicle.year },
    { label: 'Couleur', value: vehicle.color },
    { label: 'Immatriculation', value: vehicle.plate || 'Non renseignée' },
    { label: 'Carburant', value: vehicle.fuel },
    { label: 'Kilometrage', value: `${vehicle.mileage.toLocaleString()} km` },
    { label: 'Etat', value: vehicle.condition },
    { label: 'Prix de vente', value: `${vehicle.salePrice.toLocaleString()} CFA` },
    {
      label: 'Prix location/jour',
      value: vehicle.rentalPrice > 0 ? `${vehicle.rentalPrice.toLocaleString()} CFA` : 'Non renseigné',
    },
  ];

  const hasMultiplePhotos = vehicle.photos.length > 1;
  const currentPhoto = vehicle.photos[currentPhotoIndex];

  const goToPreviousPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + vehicle.photos.length) % vehicle.photos.length);
  };

  const goToNextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % vehicle.photos.length);
  };

  const activeRental = rentals.find(
    (rental) => rental.vehicleId === vehicle.id && rental.status?.trim().toLowerCase() === 'active',
  ) ?? rentals.find(
    (rental) => rental.vehicleId === vehicle.id && !rental.completedAt,
  );
  const activeRentalId = activeRental?.id ?? vehicle.currentRentalId ?? null;
  const activeRentalStartMileage = activeRental?.startMileage ?? vehicle.mileage;
  const parsedRentalEndMileage = Number(rentalEndMileage);
  const rentalMileageDifference =
    rentalEndMileage && Number.isFinite(parsedRentalEndMileage)
      ? parsedRentalEndMileage - activeRentalStartMileage
      : 0;
  const isRentalEndMileageInvalid =
    !rentalEndMileage || !Number.isFinite(parsedRentalEndMileage) || parsedRentalEndMileage < activeRentalStartMileage;
  const activeReservation = reservations.find(
    (reservation) => reservation.vehicleId === vehicle.id && reservation.status === 'ACTIVE',
  );
  const latestSale = sales.find((sale) => sale.vehicleId === vehicle.id);
  const activeRepair = repairs.find((repair) => repair.vehicleId === vehicle.id && repair.status === 'active');

  const handleCompleteRentalClick = () => {
    if (loadingRentals) {
      toast.info("Chargement de la location en cours...");
      return;
    }
    if (!activeRentalId) {
      toast.error("Aucune location active trouvee pour ce vehicule.");
      return;
    }
    setRentalEndMileage(String(vehicle.mileage));
    setShowCompleteRentalPopup(true);
  };

  const handleConfirmCompleteRental = async (event?: MouseEvent<HTMLButtonElement>) => {
    if (!activeRentalId) {
      event?.preventDefault();
      toast.error("Aucune location active trouvee pour ce vehicule.");
      return;
    }
    if (isRentalEndMileageInvalid) {
      event?.preventDefault();
      toast.error("Le kilometrage de retour doit etre superieur ou egal au kilometrage de depart.");
      return;
    }
    setCompletingRental(true);
    try {
      await completeRentalRequest(activeRentalId, parsedRentalEndMileage);
      await queryClient.invalidateQueries({ queryKey: ['rentals', 'list'] });
      await queryClient.invalidateQueries({ queryKey: ['receipts', 'list'] });
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      toast.success(`Location terminee. Ecart: ${rentalMileageDifference.toLocaleString()} km.`);
      setShowCompleteRentalPopup(false);
      setRentalEndMileage('');
    } catch (completeError) {
      const errorMessage = completeError instanceof Error ? completeError.message : "";
      if (errorMessage.toLowerCase().includes("missing or insufficient permissions")) {
        toast.error("Vous n'avez pas les permissions requises pour cloturer cette location.");
      } else {
        toast.error(errorMessage || "Impossible de terminer la location.");
      }
    } finally {
      setCompletingRental(false);
    }
  };

  const handleCreateReservation = async () => {
    const parsedAmount = Number(reservationAmountPaid);
    if (!customerName.trim() || !customerPhone.trim() || !reservationDate || Number.isNaN(parsedAmount) || parsedAmount < 0) {
      toast.error("Nom, telephone, jour et montant paye sont obligatoires.");
      return;
    }
    if (parsedAmount > vehicle.rentalPrice) {
      toast.error("Le montant paye ne peut pas depasser le prix de location de cette voiture.");
      return;
    }
    setSubmittingReservation(true);
    try {
      await createReservationRequest(vehicle.id, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        notes: reservationNotes.trim() || undefined,
        reservationDate,
        reservationEndDate: reservationEndDate.trim() || undefined,
        amountPaid: parsedAmount,
      });
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: ['reservations', 'list'] });
      await queryClient.invalidateQueries({ queryKey: accountMovementsQueryKey });
      toast.success("Reservation enregistree avec succes.");
      setShowReservationModal(false);
      setCustomerName('');
      setCustomerPhone('');
      setReservationNotes('');
      setReservationDate(new Date().toISOString().slice(0, 10));
      setReservationEndDate('');
      setReservationAmountPaid('');
    } catch (reservationError) {
      toast.error(reservationError instanceof Error ? reservationError.message : "Impossible d'enregistrer la reservation.");
    } finally {
      setSubmittingReservation(false);
    }
  };

  const handleCancelReservation = async () => {
    setSubmittingReservation(true);
    try {
      await cancelReservationRequest(vehicle.id);
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: ['reservations', 'list'] });
      toast.success("Reservation annulee avec succes.");
      setShowCancelReservationPopup(false);
    } catch (errorCancelReservation) {
      toast.error(errorCancelReservation instanceof Error ? errorCancelReservation.message : "Impossible d'annuler la reservation.");
    } finally {
      setSubmittingReservation(false);
    }
  };

  const handleSendToRepair = async () => {
    const parsedCost = Number(repairCost);
    if (!repairReason.trim() || !repairStartDate || Number.isNaN(parsedCost) || parsedCost < 0) {
      toast.error("Renseignez un motif, une date et un cout valide.");
      return;
    }
    if (repairExpectedEndDate && repairExpectedEndDate < repairStartDate) {
      toast.error("La date de fin prevue doit etre apres la date de debut.");
      return;
    }
    setSubmittingRepair(true);
    try {
      await createRepairRequest(vehicle.id, {
        reason: repairReason.trim(),
        cost: parsedCost,
        startDate: repairStartDate,
        expectedEndDate: repairExpectedEndDate || undefined,
        garageName: repairGarageName.trim() || undefined,
        technicianName: repairTechnicianName.trim() || undefined,
        notes: repairNotes.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: accountMovementsQueryKey });
      toast.success("Vehicule marque en reparation.");
      setShowRepairModal(false);
      setRepairReason('');
      setRepairCost('');
      setRepairStartDate(new Date().toISOString().slice(0, 10));
      setRepairExpectedEndDate('');
      setRepairGarageName('');
      setRepairTechnicianName('');
      setRepairNotes('');
    } catch (repairError) {
      toast.error(repairError instanceof Error ? repairError.message : "Impossible de lancer la reparation.");
    } finally {
      setSubmittingRepair(false);
    }
  };

  const handleCompleteRepair = async () => {
    setCompletingRepair(true);
    try {
      await completeRepairRequest(vehicle.id);
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      toast.success("Reparation terminee avec succes.");
      setShowCompleteRepairPopup(false);
    } catch (errorRepairComplete) {
      toast.error(errorRepairComplete instanceof Error ? errorRepairComplete.message : "Impossible de cloturer la reparation.");
    } finally {
      setCompletingRepair(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/vehicles" className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-accent transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{vehicle.brand} {vehicle.model}</h1>
          <p className="text-muted-foreground text-sm">
            {vehicle.plate} · Ajoute le {new Date(vehicle.createdAt).toLocaleDateString()}
          </p>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {vehicle.status === 'available' && (
          <>
            {canSell && (
              <Link
                to={`/sales/new?vehicleId=${vehicle.id}`}
                className="px-4 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Vendre
              </Link>
            )}
            {canRent && (
              <Link
                to={`/rentals/new?vehicleId=${vehicle.id}`}
                className="px-4 py-2.5 bg-info text-info-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Louer
              </Link>
            )}
            {canReserve && (
              <button
                type="button"
                onClick={() => {
                  setReservationAmountPaid(String(vehicle.rentalPrice));
                  setShowReservationModal(true);
                }}
                className="px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors"
              >
                Réserver
              </button>
            )}
            {canUseVehiclesModule && (
              <button
                type="button"
                onClick={() => setShowRepairModal(true)}
                className="px-4 py-2.5 bg-warning text-warning-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                En réparation
              </button>
            )}
          </>
        )}
        {vehicle.status === 'repair' && canUseVehiclesModule && (
          <button
            type="button"
            onClick={() => setShowCompleteRepairPopup(true)}
            className="px-4 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Réparation terminée
          </button>
        )}
        {vehicle.status === 'rented' && canRent && (
          <button
            type="button"
            onClick={handleCompleteRentalClick}
            disabled={completingRental || loadingRentals}
            className="px-4 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {completingRental ? "Cloture..." : loadingRentals ? "Chargement..." : "Fin de location"}
          </button>
        )}
        {vehicle.status === 'reserved' && (
          <>
            {canRent && canReserve && (
              <button
                type="button"
                onClick={() => navigate(`/rentals/finalize-from-reservation?vehicleId=${vehicle.id}`)}
                className="px-4 py-2.5 bg-info text-info-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                Louer maintenant
              </button>
            )}
            {canReserve && (
              <button
                type="button"
                onClick={() => setShowCancelReservationPopup(true)}
                disabled={submittingReservation}
                className="px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {submittingReservation ? "Annulation..." : "Annuler reservation"}
              </button>
            )}
          </>
        )}
      </div>
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Informations</h2>

        {vehicle.status === 'rented' && activeRental && (
          <div className="rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm space-y-1">
            <p className="text-foreground font-semibold">Client de location</p>
            <p className="text-muted-foreground">
              <span className="text-foreground font-medium">{activeRental.tenantName}</span> ({activeRental.tenantPhone})
            </p>
            <p className="text-muted-foreground">
              Du {new Date(activeRental.startDate).toLocaleDateString("fr-FR")} au {new Date(activeRental.endDate).toLocaleDateString("fr-FR")}
            </p>
            <p className="text-muted-foreground">
              Montant: <span className="text-foreground font-medium">{activeRental.amount.toLocaleString()} CFA</span> ·
              Effectué par <span className="text-foreground font-medium"> {activeRental.createdByName || "Utilisateur"}</span>
            </p>
            <p className="text-muted-foreground">
              Kilometrage depart:{" "}
              <span className="text-foreground font-medium">{activeRentalStartMileage.toLocaleString()} km</span>
            </p>
            {activeRental.driverFullName && (
              <p className="text-muted-foreground">
                Chauffeur:{" "}
                <span className="text-foreground font-medium">{activeRental.driverFullName}</span>
                {activeRental.driverPhone ? ` (${activeRental.driverPhone})` : ""}
              </p>
            )}
          </div>
        )}

        {vehicle.status === 'reserved' && activeReservation && (
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm space-y-1">
            <p className="text-foreground font-semibold">Client de réservation</p>
            <p className="text-muted-foreground">
              <span className="text-foreground font-medium">{activeReservation.customerName}</span> ({activeReservation.customerPhone})
            </p>
            <p className="text-muted-foreground">
              Du {new Date(activeReservation.reservationDate).toLocaleDateString("fr-FR")}
              {activeReservation.reservationEndDate
                ? ` au ${new Date(activeReservation.reservationEndDate).toLocaleDateString("fr-FR")}`
                : ""}
            </p>
            <p className="text-muted-foreground">
              Acompte: <span className="text-foreground font-medium">{activeReservation.amountPaid.toLocaleString()} CFA</span> ·
              Effectué par <span className="text-foreground font-medium"> {activeReservation.createdByName || "Utilisateur"}</span>
            </p>
          </div>
        )}

        {vehicle.status === 'sold' && latestSale && (
          <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm space-y-1">
            <p className="text-foreground font-semibold">Client de vente</p>
            <p className="text-muted-foreground">
              <span className="text-foreground font-medium">{latestSale.buyerName}</span> ({latestSale.buyerPhone})
            </p>
            <p className="text-muted-foreground">
              Prix: <span className="text-foreground font-medium">{latestSale.amount.toLocaleString()} CFA</span> ·
              Vendu le {new Date(latestSale.date).toLocaleDateString("fr-FR")}
            </p>
            <p className="text-muted-foreground">
              Effectué par <span className="text-foreground font-medium">{latestSale.createdByName || "Utilisateur"}</span>
            </p>
          </div>
        )}

        {vehicle.status === 'repair' && activeRepair && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm space-y-1">
            <p className="text-foreground font-semibold">Détails de réparation</p>
            <p className="text-muted-foreground">{activeRepair.reason}</p>
            <p className="text-muted-foreground">
              Coût: <span className="text-foreground font-medium">{activeRepair.cost.toLocaleString()} CFA</span> ·
              Début: {new Date(activeRepair.startDate).toLocaleDateString("fr-FR")}
            </p>
            <p className="text-muted-foreground">
              {activeRepair.garageName ? `Garage: ${activeRepair.garageName} · ` : ""}
              {activeRepair.technicianName ? `Technicien: ${activeRepair.technicianName} · ` : ""}
              Effectué par <span className="text-foreground font-medium">{activeRepair.createdByName || "Utilisateur"}</span>
            </p>
          </div>
        )}
      </div>
      {vehicle.status === 'reserved' && activeReservation && (
        <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm">
          <p className="text-muted-foreground">
                       Reserve par <span className="text-foreground font-medium">{activeReservation.customerName}</span> ({activeReservation.customerPhone})
            {activeReservation.reservationEndDate ? (
              <>
                {" "}
                du{" "}
                <span className="text-foreground font-medium">
                  {new Date(activeReservation.reservationDate).toLocaleDateString("fr-FR")}
                </span>{" "}
                au{" "}
                <span className="text-foreground font-medium">
                  {new Date(activeReservation.reservationEndDate).toLocaleDateString("fr-FR")}
                </span>
              </>
            ) : (
              <>
                {" "}
                pour le{" "}
                <span className="text-foreground font-medium">
                  {new Date(activeReservation.reservationDate).toLocaleDateString("fr-FR")}
                </span>
              </>
            )}
            . Montant paye:{" "}
            <span className="text-foreground font-semibold">{activeReservation.amountPaid.toLocaleString()} CFA</span>
          </p>
        </div>
      )}

      {/* Photos */}
      {vehicle.photos.length > 0 ? (
        <div className="glass-card p-3 space-y-3">
          <div className="relative">
            <img
              src={currentPhoto}
              alt={`${vehicle.brand} ${vehicle.model} - photo ${currentPhotoIndex + 1}`}
              className="h-80 md:h-96 w-full object-cover rounded-lg"
            />

            {hasMultiplePhotos && (
              <>
                <button
                  type="button"
                  onClick={goToPreviousPhoto}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-foreground" />
                </button>
                <button
                  type="button"
                  onClick={goToNextPhoto}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-foreground" />
                </button>
              </>
            )}
          </div>

          {hasMultiplePhotos && (
            <div className="flex items-center justify-center gap-2">
              {vehicle.photos.map((photoUrl, index) => (
                <button
                  key={`${photoUrl}-${index}`}
                  type="button"
                  onClick={() => setCurrentPhotoIndex(index)}
                  className={`h-2.5 rounded-full transition-all ${
                    currentPhotoIndex === index ? 'w-6 bg-primary' : 'w-2.5 bg-muted'
                  }`}
                  aria-label={`Afficher la photo ${index + 1}`}
                />
              ))}
            </div>
          )}

          {vehicle.photos.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {vehicle.photos.map((photoUrl, index) => (
                <button
                  key={`thumb-${photoUrl}-${index}`}
                  type="button"
                  onClick={() => setCurrentPhotoIndex(index)}
                  className={`overflow-hidden rounded-md border ${
                    currentPhotoIndex === index ? 'border-primary' : 'border-border'
                  }`}
                >
                  <img
                    src={photoUrl}
                    alt={`Miniature ${index + 1}`}
                    className="h-16 w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground text-center">
            Photo {currentPhotoIndex + 1} / {vehicle.photos.length}
          </div>
        </div>
      ) : (
        <div className="glass-card h-64 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Car className="w-16 h-16 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucune photo disponible</p>
          </div>
        </div>
      )}

      {/* Details grid */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Informations</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {details.map(d => (
            <div key={d.label}>
              <p className="text-xs text-muted-foreground mb-1">{d.label}</p>
              <p className="text-sm font-medium text-foreground">{d.value}</p>
            </div>
          ))}
        </div>
        {vehicle.description && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-sm text-foreground">{vehicle.description}</p>
          </div>
        )}
      </div>

      <AlertDialog open={showCompleteRentalPopup} onOpenChange={setShowCompleteRentalPopup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la fin de location</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va cloturer la location en cours. Renseignez le kilometrage de retour pour calculer l'ecart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Kilometrage de depart</p>
              <p className="text-sm font-semibold text-foreground">{activeRentalStartMileage.toLocaleString()} km</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Kilometrage de retour</label>
              <input
                type="number"
                min={activeRentalStartMileage}
                step={1}
                value={rentalEndMileage}
                onChange={(event) => setRentalEndMileage(event.target.value)}
                disabled={completingRental}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
              />
            </div>
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Ecart parcouru</p>
              <p className={`text-sm font-semibold ${rentalMileageDifference < 0 ? "text-destructive" : "text-foreground"}`}>
                {rentalMileageDifference.toLocaleString()} km
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completingRental}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCompleteRental}
              disabled={completingRental || isRentalEndMileageInvalid}
              className="bg-success text-success-foreground hover:opacity-90"
            >
              {completingRental ? "Cloture..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCompleteRepairPopup} onOpenChange={setShowCompleteRepairPopup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la fin de reparation</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action termine la reparation et remet le vehicule en statut disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completingRepair}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCompleteRepair}
              disabled={completingRepair}
              className="bg-success text-success-foreground hover:opacity-90"
            >
              {completingRepair ? "Validation..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCancelReservationPopup} onOpenChange={setShowCancelReservationPopup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'annulation de reservation</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action annule la reservation active de ce vehicule et le remet disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submittingReservation}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelReservation}
              disabled={submittingReservation}
              className="bg-destructive text-destructive-foreground hover:opacity-90"
            >
              {submittingReservation ? "Annulation..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showReservationModal} onOpenChange={setShowReservationModal}>
        <DialogContent className="max-h-[90dvh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Nouvelle reservation</DialogTitle>
            <DialogDescription>Renseignez les informations du client pour reserver ce vehicule.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto pr-1">
            <div>
              <label className="block text-sm text-foreground mb-1">Nom client</label>
              <input
                type="text"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Telephone client</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-foreground mb-1">Jour de reservation (debut)</label>
                <input
                  type="date"
                  value={reservationDate}
                  onChange={(event) => setReservationDate(event.target.value)}
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm text-foreground mb-1">Dernier jour (optionnel)</label>
                <input
                  type="date"
                  value={reservationEndDate}
                  min={reservationDate || undefined}
                  onChange={(event) => setReservationEndDate(event.target.value)}
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
                />
                {/* <p className="mt-1 text-xs text-muted-foreground">
                  Ex.: retrait le 17/04 et retour prevu le 18/04 — le repere liste s&apos;affiche sur toute la periode.
                </p> */}
              </div>
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Montant paye (CFA)</label>
              <input
                type="number"
                min={0}
                max={vehicle.rentalPrice}
                value={reservationAmountPaid}
                readOnly
                disabled
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground/90 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Montant fixe selon le prix de location: {vehicle.rentalPrice.toLocaleString()} CFA
              </p>
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Notes (optionnel)</label>
              <textarea
                rows={3}
                value={reservationNotes}
                onChange={(event) => setReservationNotes(event.target.value)}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground resize-none"
              />
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <button
              type="button"
              onClick={() => setShowReservationModal(false)}
              className="px-4 py-2.5 rounded-lg border border-border text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleCreateReservation}
              disabled={submittingReservation}
              className="px-4 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium disabled:opacity-60"
            >
              {submittingReservation ? "Enregistrement..." : "Confirmer reservation"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRepairModal} onOpenChange={setShowRepairModal}>
        <DialogContent className="max-h-[90dvh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Mettre en reparation</DialogTitle>
            <DialogDescription>Renseignez les details de la reparation du vehicule.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto pr-1">
            <div>
              <label className="block text-sm text-foreground mb-1">Motif</label>
              <textarea
                rows={3}
                value={repairReason}
                onChange={(event) => setRepairReason(event.target.value)}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-foreground mb-1">Garage (optionnel)</label>
                <input
                  type="text"
                  value={repairGarageName}
                  onChange={(event) => setRepairGarageName(event.target.value)}
                  placeholder="Ex: Garage Central"
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm text-foreground mb-1">Technicien (optionnel)</label>
                <input
                  type="text"
                  value={repairTechnicianName}
                  onChange={(event) => setRepairTechnicianName(event.target.value)}
                  placeholder="Ex: Mamadou Keita"
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Cout estime (CFA)</label>
              <input
                type="number"
                min={0}
                value={repairCost}
                onChange={(event) => setRepairCost(event.target.value)}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-foreground mb-1">Date debut reparation</label>
                <input
                  type="date"
                  value={repairStartDate}
                  onChange={(event) => setRepairStartDate(event.target.value)}
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm text-foreground mb-1">Date fin prevue (optionnel)</label>
                <input
                  type="date"
                  value={repairExpectedEndDate}
                  min={repairStartDate || undefined}
                  onChange={(event) => setRepairExpectedEndDate(event.target.value)}
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Notes internes (optionnel)</label>
              <textarea
                rows={2}
                value={repairNotes}
                onChange={(event) => setRepairNotes(event.target.value)}
                placeholder="Pieces a changer, priorite, recommandations..."
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground resize-none"
              />
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <button
              type="button"
              onClick={() => setShowRepairModal(false)}
              className="px-4 py-2.5 rounded-lg border border-border text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSendToRepair}
              disabled={submittingRepair}
              className="px-4 py-2.5 rounded-lg bg-warning text-warning-foreground text-sm font-medium disabled:opacity-60"
            >
              {submittingRepair ? "Enregistrement..." : "Confirmer reparation"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
