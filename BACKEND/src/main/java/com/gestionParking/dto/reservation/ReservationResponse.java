package com.gestionParking.dto.reservation;

import com.gestionParking.entity.Reservation;
import com.gestionParking.enums.ReservationStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@AllArgsConstructor
public class ReservationResponse {

	private UUID id;
	private UUID vehicleId;
	private String vehicleBrand;
	private String vehicleModel;
	private String vehiclePlate;
	private Long ownerUserId;
	private String customerName;
	private String customerPhone;
	private String notes;
	private LocalDate reservationDate;
	private BigDecimal amountPaid;
	private ReservationStatus status;
	private LocalDateTime cancelledAt;
	private LocalDateTime createdAt;

	public static ReservationResponse fromEntity(Reservation reservation) {
		return new ReservationResponse(
			reservation.getId(),
			reservation.getVehicle().getId(),
			reservation.getVehicle().getBrand(),
			reservation.getVehicle().getModel(),
			reservation.getVehicle().getPlate(),
			reservation.getOwner().getId(),
			reservation.getCustomerName(),
			reservation.getCustomerPhone(),
			reservation.getNotes(),
			reservation.getReservationDate(),
			reservation.getAmountPaid(),
			reservation.getStatus(),
			reservation.getCancelledAt(),
			reservation.getCreatedAt()
		);
	}
}
