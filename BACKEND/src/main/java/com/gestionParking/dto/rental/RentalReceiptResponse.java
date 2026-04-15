package com.gestionParking.dto.rental;

import com.gestionParking.entity.RentalReceipt;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@AllArgsConstructor
public class RentalReceiptResponse {

	private UUID id;
	private String receiptNumber;
	private UUID rentalId;
	private UUID vehicleId;
	private Long ownerUserId;
	private String vehicleBrand;
	private String vehicleModel;
	private String vehiclePlate;
	private String tenantName;
	private String tenantPhone;
	private String tenantIdCardNumber;
	private String tenantIdCardPhotoUrl;
	private LocalDateTime startDate;
	private LocalDateTime endDate;
	private Integer totalDays;
	private BigDecimal dailyPrice;
	private BigDecimal rentalAmount;
	private BigDecimal depositAmount;
	private LocalDateTime issuedAt;

	public static RentalReceiptResponse fromEntity(RentalReceipt receipt) {
		return new RentalReceiptResponse(
			receipt.getId(),
			receipt.getReceiptNumber(),
			receipt.getRental().getId(),
			receipt.getVehicle().getId(),
			receipt.getOwner().getId(),
			receipt.getVehicleBrand(),
			receipt.getVehicleModel(),
			receipt.getVehiclePlate(),
			receipt.getTenantName(),
			receipt.getTenantPhone(),
			receipt.getTenantIdCardNumber(),
			receipt.getTenantIdCardPhotoUrl(),
			receipt.getStartDate(),
			receipt.getEndDate(),
			receipt.getTotalDays(),
			receipt.getDailyPrice(),
			receipt.getRentalAmount(),
			receipt.getDepositAmount(),
			receipt.getIssuedAt()
		);
	}
}
