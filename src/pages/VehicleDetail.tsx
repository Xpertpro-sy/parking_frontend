import { type MouseEvent, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Car, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge from '@/components/StatusBadge';
import type { AppPermission } from '@/lib/access-control';
import { getCurrentUserAccessProfile } from '@/lib/access-control';
import { LIVE_COLLAB_REFETCH_MS, useVehicleDetailQuery, vehicleQueryKeys } from '@/lib/vehicle-queries';
import { completeRentalRequest, listRentalsRequest, reconcileVehicleRentalStatusRequest } from '@/lib/rental-api';
import { listSalesRequest } from '@/lib/sale-api';
import {
  cancelReservationRequest,
  completeRepairRequest,
  listRepairsRequest,
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
  const [showCancelReservationPopup, setShowCancelReservationPopup] = useState(false);
  const [showCompleteRepairPopup, setShowCompleteRepairPopup] = useState(false);
  const [submittingReservation, setSubmittingReservation] = useState(false);
  const [completingRepair, setCompletingRepair] = useState(false);

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
              <Link
                to={`/reservations/new?vehicleId=${vehicle.id}`}
                className="px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors"
              >
                Réserver
              </Link>
            )}
            {canUseVehiclesModule && (
              <Link
                to={`/repairs/new?vehicleId=${vehicle.id}`}
                className="px-4 py-2.5 bg-warning text-warning-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                En réparation
              </Link>
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

    </div>
  );
}
