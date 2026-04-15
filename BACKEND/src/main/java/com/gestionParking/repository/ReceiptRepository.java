package com.gestionParking.repository;

import com.gestionParking.entity.Receipt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReceiptRepository extends JpaRepository<Receipt, UUID> {

	List<Receipt> findAllBySeller_IdOrderByIssuedAtDesc(Long sellerId);

	Optional<Receipt> findBySale_IdAndSeller_Id(UUID saleId, Long sellerId);

	Optional<Receipt> findByIdAndSeller_Id(UUID receiptId, Long sellerId);
}
