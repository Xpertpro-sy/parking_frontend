package com.gestionParking.repository;

import com.gestionParking.entity.Reservation;
import com.gestionParking.enums.ReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReservationRepository extends JpaRepository<Reservation, UUID> {

	boolean existsByVehicle_IdAndStatus(UUID vehicleId, ReservationStatus status);

	Optional<Reservation> findFirstByVehicle_IdAndOwner_IdAndStatusOrderByCreatedAtDesc(
		UUID vehicleId,
		Long ownerId,
		ReservationStatus status
	);

	List<Reservation> findAllByOwner_IdOrderByCreatedAtDesc(Long ownerId);
}
