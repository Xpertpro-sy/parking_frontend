package com.gestionParking.repository;

import com.gestionParking.entity.Sale;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SaleRepository extends JpaRepository<Sale, UUID> {

	boolean existsByVehicle_Id(UUID vehicleId);

	List<Sale> findAllBySeller_IdOrderByDateDesc(Long sellerId);

	Optional<Sale> findByIdAndSeller_Id(UUID saleId, Long sellerId);
}
