package com.gestionParking.repository;

import com.gestionParking.entity.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VehicleRepository extends JpaRepository<Vehicle, UUID> {

	boolean existsByPlateIgnoreCase(String plate);

	List<Vehicle> findAllByUser_IdOrderByCreatedAtDesc(Long userId);

	Optional<Vehicle> findByIdAndUser_Id(UUID id, Long userId);
}
