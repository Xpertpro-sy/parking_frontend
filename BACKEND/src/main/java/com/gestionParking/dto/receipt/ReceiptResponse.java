package com.gestionParking.dto.receipt;

import com.gestionParking.entity.Receipt;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@AllArgsConstructor
public class ReceiptResponse {

	private UUID id;
	private String receiptNumber;
	private UUID saleId;
	private UUID vehicleId;
	private Long sellerUserId;
	private String vehicleBrand;
	private String vehicleModel;
	private String vehiclePlate;
	private String buyerName;
	private String buyerPhone;
	private BigDecimal amount;
	private LocalDate saleDate;
	private LocalDateTime issuedAt;

	public static ReceiptResponse fromEntity(Receipt receipt) {
		return new ReceiptResponse(
			receipt.getId(),
			receipt.getReceiptNumber(),
			receipt.getSale().getId(),
			receipt.getVehicle().getId(),
			receipt.getSeller().getId(),
			receipt.getVehicleBrand(),
			receipt.getVehicleModel(),
			receipt.getVehiclePlate(),
			receipt.getBuyerName(),
			receipt.getBuyerPhone(),
			receipt.getAmount(),
			receipt.getSaleDate(),
			receipt.getIssuedAt()
		);
	}
}
