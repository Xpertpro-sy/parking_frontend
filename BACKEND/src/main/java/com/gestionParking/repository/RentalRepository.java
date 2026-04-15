package com.gestionParking.repository;

import com.gestionParking.entity.Rental;
import com.gestionParking.enums.RentalStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RentalRepository extends JpaRepository<Rental, UUID> {

	boolean existsByVehicle_IdAndStatus(UUID vehicleId, RentalStatus status);

	List<Rental> findAllByOwner_IdOrderByCreatedAtDesc(Long ownerId);

	Optional<Rental> findByIdAndOwner_Id(UUID rentalId, Long ownerId);
}
