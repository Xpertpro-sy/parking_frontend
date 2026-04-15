package com.gestionParking.dto.repair;

import com.gestionParking.entity.Repair;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
@AllArgsConstructor
public class RepairResponse {

	private UUID id;
	private UUID vehicleId;
	private String vehicleBrand;
	private String vehicleModel;
	private String vehiclePlate;
	private String reason;
	private BigDecimal cost;
	private LocalDate startDate;
	private LocalDate endDate;

	public static RepairResponse fromEntity(Repair repair) {
		return new RepairResponse(
			repair.getId(),
			repair.getVehicle().getId(),
			repair.getVehicle().getBrand(),
			repair.getVehicle().getModel(),
			repair.getVehicle().getPlate(),
			repair.getReason(),
			repair.getCost(),
			repair.getStartDate(),
			repair.getEndDate()
		);
	}
}
