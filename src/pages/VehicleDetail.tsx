import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Car, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge from '@/components/StatusBadge';
import { useVehicleDetailQuery, vehicleQueryKeys } from '@/lib/vehicle-queries';
import { completeRentalRequest, listRentalsRequest } from '@/lib/rental-api';
import {
  cancelReservationRequest,
  completeRepairRequest,
  createRepairRequest,
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
  const queryClient = useQueryClient();
  const { data: vehicle, isLoading, isError, error } = useVehicleDetailQuery(id);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [completingRental, setCompletingRental] = useState(false);
  const [showCompleteRentalPopup, setShowCompleteRentalPopup] = useState(false);
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
  const [reservationAmountPaid, setReservationAmountPaid] = useState('');

  const [repairReason, setRepairReason] = useState('');
  const [repairCost, setRepairCost] = useState('');
  const [repairStartDate, setRepairStartDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: rentals = [] } = useQuery({
    queryKey: ['rentals', 'list'],
    queryFn: listRentalsRequest,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', 'list'],
    queryFn: listReservationsRequest,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
    { label: 'Immatriculation', value: vehicle.plate },
    { label: 'Carburant', value: vehicle.fuel },
    { label: 'Kilometrage', value: `${vehicle.mileage.toLocaleString()} km` },
    { label: 'Etat', value: vehicle.condition },
    { label: 'Prix de vente', value: `${vehicle.salePrice.toLocaleString()} CFA` },
    { label: 'Prix location/jour', value: `${vehicle.rentalPrice.toLocaleString()} CFA` },
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
    (rental) => rental.vehicleId === vehicle.id && rental.status?.toLowerCase() === 'active',
  );
  const activeReservation = reservations.find(
    (reservation) => reservation.vehicleId === vehicle.id && reservation.status === 'ACTIVE',
  );

  const handleCompleteRentalClick = () => {
    if (!activeRental) {
      toast.error("Aucune location active trouvee pour ce vehicule.");
      return;
    }
    setShowCompleteRentalPopup(true);
  };

  const handleConfirmCompleteRental = async () => {
    if (!activeRental) {
      toast.error("Aucune location active trouvee pour ce vehicule.");
      return;
    }
    setCompletingRental(true);
    try {
      await completeRentalRequest(activeRental.id);
      await queryClient.invalidateQueries({ queryKey: ['rentals', 'list'] });
      await queryClient.invalidateQueries({ queryKey: ['receipts', 'list'] });
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      toast.success("Location terminee. Recu genere avec succes.");
      setShowCompleteRentalPopup(false);
    } catch (completeError) {
      toast.error(completeError instanceof Error ? completeError.message : "Impossible de terminer la location.");
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
    setSubmittingReservation(true);
    try {
      await createReservationRequest(vehicle.id, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        notes: reservationNotes.trim() || undefined,
        reservationDate,
        amountPaid: parsedAmount,
      });
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: ['reservations', 'list'] });
      toast.success("Reservation enregistree avec succes.");
      setShowReservationModal(false);
      setCustomerName('');
      setCustomerPhone('');
      setReservationNotes('');
      setReservationDate(new Date().toISOString().slice(0, 10));
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
    setSubmittingRepair(true);
    try {
      await createRepairRequest(vehicle.id, {
        reason: repairReason.trim(),
        cost: parsedCost,
        startDate: repairStartDate,
      });
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      toast.success("Vehicule marque en reparation.");
      setShowRepairModal(false);
      setRepairReason('');
      setRepairCost('');
      setRepairStartDate(new Date().toISOString().slice(0, 10));
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
            <Link
              to={`/sales/new?vehicleId=${vehicle.id}`}
              className="px-4 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Vendre
            </Link>
            <Link
              to={`/rentals/new?vehicleId=${vehicle.id}`}
              className="px-4 py-2.5 bg-info text-info-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Louer
            </Link>
            <button
              onClick={() => setShowReservationModal(true)}
              className="px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors"
            >
              Réserver
            </button>
            <button
              onClick={() => setShowRepairModal(true)}
              className="px-4 py-2.5 bg-warning text-warning-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              En réparation
            </button>
          </>
        )}
        {vehicle.status === 'repair' && (
          <button
            onClick={() => setShowCompleteRepairPopup(true)}
            className="px-4 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Réparation terminée
          </button>
        )}
        {vehicle.status === 'rented' && (
          <button
            onClick={handleCompleteRentalClick}
            disabled={completingRental}
            className="px-4 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {completingRental ? "Cloture..." : "Fin de location"}
          </button>
        )}
        {vehicle.status === 'reserved' && (
          <button
            onClick={() => setShowCancelReservationPopup(true)}
            disabled={submittingReservation}
            className="px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {submittingReservation ? "Annulation..." : "Annuler reservation"}
          </button>
        )}
      </div>
      {vehicle.status === 'reserved' && activeReservation && (
        <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            Reserve par <span className="text-foreground font-medium">{activeReservation.customerName}</span> ({activeReservation.customerPhone}) pour le{" "}
            <span className="text-foreground font-medium">
              {new Date(activeReservation.reservationDate).toLocaleDateString('fr-FR')}
            </span>
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
              Cette action va cloturer la location en cours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completingRental}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCompleteRental}
              disabled={completingRental}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle reservation</DialogTitle>
            <DialogDescription>Renseignez les informations du client pour reserver ce vehicule.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
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
            <div>
              <label className="block text-sm text-foreground mb-1">Jour de reservation</label>
              <input
                type="date"
                value={reservationDate}
                onChange={(event) => setReservationDate(event.target.value)}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">Montant paye (CFA)</label>
              <input
                type="number"
                min={0}
                value={reservationAmountPaid}
                onChange={(event) => setReservationAmountPaid(event.target.value)}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
              />
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
          <DialogFooter>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mettre en reparation</DialogTitle>
            <DialogDescription>Renseignez les details de la reparation du vehicule.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-foreground mb-1">Motif</label>
              <textarea
                rows={3}
                value={repairReason}
                onChange={(event) => setRepairReason(event.target.value)}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground resize-none"
              />
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
            <div>
              <label className="block text-sm text-foreground mb-1">Date debut reparation</label>
              <input
                type="date"
                value={repairStartDate}
                onChange={(event) => setRepairStartDate(event.target.value)}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
              />
            </div>
          </div>
          <DialogFooter>
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
