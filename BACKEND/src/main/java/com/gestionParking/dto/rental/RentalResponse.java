package com.gestionParking.dto.rental;

import com.gestionParking.entity.Rental;
import com.gestionParking.enums.RentalStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@AllArgsConstructor
public class RentalResponse {

	private UUID id;
	private UUID vehicleId;
	private String vehicleBrand;
	private String vehicleModel;
	private String vehiclePlate;
	private Long ownerUserId;
	private String tenantName;
	private String tenantPhone;
	private String tenantIdCardNumber;
	private String tenantIdCardPhotoUrl;
	private String tenantAddress;
	private String emergencyContactName;
	private String emergencyContactPhone;
	private LocalDateTime startDate;
	private LocalDateTime endDate;
	private Integer totalDays;
	private BigDecimal dailyPrice;
	private BigDecimal amount;
	private BigDecimal depositAmount;
	private RentalStatus status;
	private LocalDateTime completedAt;
	private LocalDateTime createdAt;
	private RentalReceiptResponse receipt;

	public static RentalResponse fromEntity(Rental rental) {
		return new RentalResponse(
			rental.getId(),
			rental.getVehicle().getId(),
			rental.getVehicle().getBrand(),
			rental.getVehicle().getModel(),
			rental.getVehicle().getPlate(),
			rental.getOwner().getId(),
			rental.getTenantName(),
			rental.getTenantPhone(),
			rental.getTenantIdCardNumber(),
			rental.getTenantIdCardPhotoUrl(),
			rental.getTenantAddress(),
			rental.getEmergencyContactName(),
			rental.getEmergencyContactPhone(),
			rental.getStartDate(),
			rental.getEndDate(),
			rental.getTotalDays(),
			rental.getDailyPrice(),
			rental.getAmount(),
			rental.getDepositAmount(),
			rental.getStatus(),
			rental.getCompletedAt(),
			rental.getCreatedAt(),
			rental.getReceipt() == null ? null : RentalReceiptResponse.fromEntity(rental.getReceipt())
		);
	}
}
