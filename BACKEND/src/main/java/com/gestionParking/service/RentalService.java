package com.gestionParking.service;

import com.gestionParking.dto.rental.CreateRentalRequest;
import com.gestionParking.dto.rental.RentalReceiptResponse;
import com.gestionParking.dto.rental.RentalResponse;
import com.gestionParking.entity.Rental;
import com.gestionParking.entity.RentalReceipt;
import com.gestionParking.entity.User;
import com.gestionParking.entity.Vehicle;
import com.gestionParking.enums.RentalStatus;
import com.gestionParking.enums.VehicleStatus;
import com.gestionParking.repository.RentalRepository;
import com.gestionParking.repository.RentalReceiptRepository;
import com.gestionParking.repository.UserRepository;
import com.gestionParking.repository.VehicleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class RentalService {

	private final RentalRepository rentalRepository;
	private final RentalReceiptRepository rentalReceiptRepository;
	private final VehicleRepository vehicleRepository;
	private final UserRepository userRepository;

	public RentalService(
		RentalRepository rentalRepository,
		RentalReceiptRepository rentalReceiptRepository,
		VehicleRepository vehicleRepository,
		UserRepository userRepository
	) {
		this.rentalRepository = rentalRepository;
		this.rentalReceiptRepository = rentalReceiptRepository;
		this.vehicleRepository = vehicleRepository;
		this.userRepository = userRepository;
	}

	@Transactional
	public RentalResponse createRental(CreateRentalRequest request, String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		Vehicle vehicle = vehicleRepository.findByIdAndUser_Id(request.getVehicleId(), owner.getId())
			.orElseThrow(() -> new IllegalArgumentException("Vehicule introuvable pour cet utilisateur."));

		if (vehicle.getStatus() == VehicleStatus.SOLD) {
			throw new IllegalArgumentException("Ce vehicule est vendu, location impossible.");
		}
		if (vehicle.getStatus() == VehicleStatus.REPAIR) {
			throw new IllegalArgumentException("Ce vehicule est en reparation, location impossible.");
		}
		if (vehicle.getStatus() == VehicleStatus.RESERVED) {
			throw new IllegalArgumentException("Ce vehicule est reserve, location impossible.");
		}
		if (vehicle.getStatus() == VehicleStatus.RENTED
			|| rentalRepository.existsByVehicle_IdAndStatus(vehicle.getId(), RentalStatus.ACTIVE)) {
			throw new IllegalArgumentException("Ce vehicule est deja en location.");
		}
		if (!request.getEndDate().isAfter(request.getStartDate())) {
			throw new IllegalArgumentException("La date/heure de fin doit etre strictement superieure a la date/heure de debut.");
		}

		long minutes = ChronoUnit.MINUTES.between(request.getStartDate(), request.getEndDate());
		long days = (long) Math.ceil(minutes / 1440.0d);
		BigDecimal expectedAmount = vehicle.getRentalPrice().multiply(BigDecimal.valueOf(days));
		if (request.getAmount().compareTo(expectedAmount) != 0) {
			throw new IllegalArgumentException(
				"Le montant de location doit etre exactement: " + expectedAmount
			);
		}

		Rental rental = new Rental();
		rental.setVehicle(vehicle);
		rental.setOwner(owner);
		rental.setTenantName(request.getTenantName().trim());
		rental.setTenantPhone(request.getTenantPhone().trim());
		rental.setTenantIdCardNumber(request.getTenantIdCardNumber().trim());
		rental.setTenantIdCardPhotoUrl(trimToNull(request.getTenantIdCardPhotoUrl()));
		rental.setTenantAddress(trimToNull(request.getTenantAddress()));
		rental.setEmergencyContactName(trimToNull(request.getEmergencyContactName()));
		rental.setEmergencyContactPhone(trimToNull(request.getEmergencyContactPhone()));
		rental.setStartDate(request.getStartDate());
		rental.setEndDate(request.getEndDate());
		rental.setTotalDays((int) days);
		rental.setDailyPrice(vehicle.getRentalPrice());
		rental.setAmount(request.getAmount());
		rental.setDepositAmount(request.getDepositAmount());
		rental.setStatus(RentalStatus.ACTIVE);

		Rental saved = rentalRepository.save(rental);

		RentalReceipt receipt = new RentalReceipt();
		receipt.setReceiptNumber(buildRentalReceiptNumber(saved.getId()));
		receipt.setRental(saved);
		receipt.setVehicle(vehicle);
		receipt.setOwner(owner);
		receipt.setVehicleBrand(vehicle.getBrand());
		receipt.setVehicleModel(vehicle.getModel());
		receipt.setVehiclePlate(vehicle.getPlate());
		receipt.setTenantName(saved.getTenantName());
		receipt.setTenantPhone(saved.getTenantPhone());
		receipt.setTenantIdCardNumber(saved.getTenantIdCardNumber());
		receipt.setTenantIdCardPhotoUrl(saved.getTenantIdCardPhotoUrl());
		receipt.setStartDate(saved.getStartDate());
		receipt.setEndDate(saved.getEndDate());
		receipt.setTotalDays(saved.getTotalDays());
		receipt.setDailyPrice(saved.getDailyPrice());
		receipt.setRentalAmount(saved.getAmount());
		receipt.setDepositAmount(saved.getDepositAmount());
		RentalReceipt savedReceipt = rentalReceiptRepository.save(receipt);
		saved.setReceipt(savedReceipt);

		vehicle.setStatus(VehicleStatus.RENTED);
		vehicleRepository.save(vehicle);

		return RentalResponse.fromEntity(saved);
	}

	@Transactional(readOnly = true)
	public List<RentalResponse> listRentals(String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		return rentalRepository.findAllByOwner_IdOrderByCreatedAtDesc(owner.getId()).stream()
			.map(RentalResponse::fromEntity)
			.toList();
	}

	@Transactional(readOnly = true)
	public Optional<RentalResponse> getRental(UUID rentalId, String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		return rentalRepository.findByIdAndOwner_Id(rentalId, owner.getId())
			.map(RentalResponse::fromEntity);
	}

	@Transactional
	public Optional<RentalResponse> completeRental(UUID rentalId, String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		Optional<Rental> rentalOpt = rentalRepository.findByIdAndOwner_Id(rentalId, owner.getId());
		if (rentalOpt.isEmpty()) {
			return Optional.empty();
		}

		Rental rental = rentalOpt.get();
		if (rental.getStatus() != RentalStatus.ACTIVE) {
			throw new IllegalArgumentException("Seule une location ACTIVE peut etre cloturee.");
		}

		rental.setStatus(RentalStatus.COMPLETED);
		rental.setCompletedAt(LocalDateTime.now());
		Rental savedRental = rentalRepository.save(rental);

		Vehicle vehicle = savedRental.getVehicle();
		vehicle.setStatus(VehicleStatus.AVAILABLE);
		vehicleRepository.save(vehicle);
		return Optional.of(RentalResponse.fromEntity(savedRental));
	}

	@Transactional(readOnly = true)
	public Optional<RentalReceiptResponse> getReceiptByRental(UUID rentalId, String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		return rentalReceiptRepository.findByRental_IdAndOwner_Id(rentalId, owner.getId())
			.map(RentalReceiptResponse::fromEntity);
	}

	@Transactional(readOnly = true)
	public Optional<RentalReceiptResponse> getReceipt(UUID receiptId, String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		return rentalReceiptRepository.findByIdAndOwner_Id(receiptId, owner.getId())
			.map(RentalReceiptResponse::fromEntity);
	}

	private User resolveOwner(String ownerEmail) {
		String email = ownerEmail.trim().toLowerCase();
		return userRepository.findByEmail(email)
			.orElseThrow(() -> new IllegalStateException("Utilisateur connecte introuvable."));
	}

	private static String trimToNull(String value) {
		if (value == null) {
			return null;
		}
		String v = value.trim();
		return v.isEmpty() ? null : v;
	}

	private static String buildRentalReceiptNumber(UUID rentalId) {
		return "LOC-" + LocalDate.now() + "-" + rentalId.toString().substring(0, 8).toUpperCase();
	}
}
