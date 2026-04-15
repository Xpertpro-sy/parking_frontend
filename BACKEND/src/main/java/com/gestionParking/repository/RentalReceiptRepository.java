package com.gestionParking.repository;

import com.gestionParking.entity.RentalReceipt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RentalReceiptRepository extends JpaRepository<RentalReceipt, UUID> {

	Optional<RentalReceipt> findByRental_IdAndOwner_Id(UUID rentalId, Long ownerId);

	Optional<RentalReceipt> findByIdAndOwner_Id(UUID receiptId, Long ownerId);
}
