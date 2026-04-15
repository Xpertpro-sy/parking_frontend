package com.gestionParking.repository;

import com.gestionParking.entity.Repair;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RepairRepository extends JpaRepository<Repair, UUID> {

	Optional<Repair> findFirstByVehicle_IdAndEndDateIsNullOrderByStartDateDesc(UUID vehicleId);
}
