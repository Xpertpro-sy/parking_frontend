package com.gestionParking.service;

import com.gestionParking.dto.repair.CreateRepairRequest;
import com.gestionParking.dto.repair.RepairResponse;
import com.gestionParking.dto.reservation.CreateReservationRequest;
import com.gestionParking.dto.reservation.ReservationResponse;
import com.gestionParking.entity.Repair;
import com.gestionParking.entity.Reservation;
import com.gestionParking.entity.User;
import com.gestionParking.entity.Vehicle;
import com.gestionParking.enums.ReservationStatus;
import com.gestionParking.enums.VehicleStatus;
import com.gestionParking.repository.RepairRepository;
import com.gestionParking.repository.ReservationRepository;
import com.gestionParking.repository.UserRepository;
import com.gestionParking.repository.VehicleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class VehicleActionService {

	private final VehicleRepository vehicleRepository;
	private final UserRepository userRepository;
	private final ReservationRepository reservationRepository;
	private final RepairRepository repairRepository;

	public VehicleActionService(
		VehicleRepository vehicleRepository,
		UserRepository userRepository,
		ReservationRepository reservationRepository,
		RepairRepository repairRepository
	) {
		this.vehicleRepository = vehicleRepository;
		this.userRepository = userRepository;
		this.reservationRepository = reservationRepository;
		this.repairRepository = repairRepository;
	}

	@Transactional
	public ReservationResponse reserveVehicle(UUID vehicleId, CreateReservationRequest request, String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		Vehicle vehicle = getVehicleForOwner(vehicleId, owner.getId());

		if (vehicle.getStatus() == VehicleStatus.SOLD) {
			throw new IllegalArgumentException("Ce vehicule est vendu, reservation impossible.");
		}
		if (vehicle.getStatus() == VehicleStatus.RENTED) {
			throw new IllegalArgumentException("Ce vehicule est en location, reservation impossible.");
		}
		if (vehicle.getStatus() == VehicleStatus.REPAIR) {
			throw new IllegalArgumentException("Ce vehicule est en reparation, reservation impossible.");
		}
		if (vehicle.getStatus() == VehicleStatus.RESERVED
			|| reservationRepository.existsByVehicle_IdAndStatus(vehicle.getId(), ReservationStatus.ACTIVE)) {
			throw new IllegalArgumentException("Ce vehicule est deja reserve.");
		}
		if (request.getReservationDate().isBefore(LocalDate.now())) {
			throw new IllegalArgumentException("Le jour de reservation doit etre aujourd'hui ou dans le futur.");
		}

		Reservation reservation = new Reservation();
		reservation.setVehicle(vehicle);
		reservation.setOwner(owner);
		reservation.setCustomerName(request.getCustomerName().trim());
		reservation.setCustomerPhone(request.getCustomerPhone().trim());
		reservation.setNotes(trimToNull(request.getNotes()));
		reservation.setReservationDate(request.getReservationDate());
		reservation.setAmountPaid(request.getAmountPaid());
		reservation.setStatus(ReservationStatus.ACTIVE);
		reservation.setCancelledAt(null);

		Reservation saved = reservationRepository.save(reservation);
		vehicle.setStatus(VehicleStatus.RESERVED);
		vehicleRepository.save(vehicle);

		return ReservationResponse.fromEntity(saved);
	}

	@Transactional(readOnly = true)
	public List<ReservationResponse> listReservations(String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		return reservationRepository.findAllByOwner_IdOrderByCreatedAtDesc(owner.getId()).stream()
			.map(ReservationResponse::fromEntity)
			.toList();
	}

	@Transactional
	public ReservationResponse cancelActiveReservation(UUID vehicleId, String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		Vehicle vehicle = getVehicleForOwner(vehicleId, owner.getId());

		Reservation reservation = reservationRepository
			.findFirstByVehicle_IdAndOwner_IdAndStatusOrderByCreatedAtDesc(
				vehicleId,
				owner.getId(),
				ReservationStatus.ACTIVE
			)
			.orElseThrow(() -> new IllegalArgumentException("Aucune reservation active trouvee pour ce vehicule."));

		reservation.setStatus(ReservationStatus.CANCELLED);
		reservation.setCancelledAt(LocalDateTime.now());
		Reservation savedReservation = reservationRepository.save(reservation);

		if (vehicle.getStatus() == VehicleStatus.RESERVED) {
			vehicle.setStatus(VehicleStatus.AVAILABLE);
			vehicleRepository.save(vehicle);
		}

		return ReservationResponse.fromEntity(savedReservation);
	}

	@Transactional
	public RepairResponse sendVehicleToRepair(UUID vehicleId, CreateRepairRequest request, String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		Vehicle vehicle = getVehicleForOwner(vehicleId, owner.getId());

		if (vehicle.getStatus() == VehicleStatus.SOLD) {
			throw new IllegalArgumentException("Ce vehicule est vendu, impossible de le mettre en reparation.");
		}
		if (vehicle.getStatus() == VehicleStatus.RENTED) {
			throw new IllegalArgumentException("Ce vehicule est en location, impossible de le mettre en reparation.");
		}
		if (vehicle.getStatus() == VehicleStatus.REPAIR) {
			throw new IllegalArgumentException("Ce vehicule est deja en reparation.");
		}

		Repair repair = new Repair();
		repair.setVehicle(vehicle);
		repair.setReason(request.getReason().trim());
		repair.setCost(request.getCost());
		repair.setStartDate(request.getStartDate());
		repair.setEndDate(null);

		Repair saved = repairRepository.save(repair);
		vehicle.setStatus(VehicleStatus.REPAIR);
		vehicleRepository.save(vehicle);
		return RepairResponse.fromEntity(saved);
	}

	@Transactional
	public RepairResponse completeVehicleRepair(UUID vehicleId, String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		Vehicle vehicle = getVehicleForOwner(vehicleId, owner.getId());
		Repair repair = repairRepository.findFirstByVehicle_IdAndEndDateIsNullOrderByStartDateDesc(vehicle.getId())
			.orElseThrow(() -> new IllegalArgumentException("Aucune reparation active trouvee pour ce vehicule."));

		repair.setEndDate(LocalDate.now());
		Repair saved = repairRepository.save(repair);
		vehicle.setStatus(VehicleStatus.AVAILABLE);
		vehicleRepository.save(vehicle);
		return RepairResponse.fromEntity(saved);
	}

	private User resolveOwner(String ownerEmail) {
		String email = ownerEmail.trim().toLowerCase();
		return userRepository.findByEmail(email)
			.orElseThrow(() -> new IllegalStateException("Utilisateur connecte introuvable."));
	}

	private Vehicle getVehicleForOwner(UUID vehicleId, Long ownerId) {
		return vehicleRepository.findByIdAndUser_Id(vehicleId, ownerId)
			.orElseThrow(() -> new IllegalArgumentException("Vehicule introuvable pour cet utilisateur."));
	}

	private static String trimToNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}
}
