package com.gestionParking.dto.vehicle;

import com.gestionParking.entity.Vehicle;
import com.gestionParking.enums.VehicleStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@AllArgsConstructor
public class VehicleResponse {

	private UUID id;
	private String brand;
	private String model;
	private Integer year;
	private String color;
	private String plate;
	private String fuel;
	private Integer mileage;
	private BigDecimal salePrice;
	private BigDecimal rentalPrice;
	private String description;
	private String condition;
	private VehicleStatus status;
	private List<String> photos;
	private LocalDateTime createdAt;
	private Long ownerUserId;

	public static VehicleResponse fromEntity(Vehicle v) {
		return new VehicleResponse(
			v.getId(),
			v.getBrand(),
			v.getModel(),
			v.getYear(),
			v.getColor(),
			v.getPlate(),
			v.getFuel(),
			v.getMileage(),
			v.getSalePrice(),
			v.getRentalPrice(),
			v.getDescription(),
			v.getCondition(),
			v.getStatus(),
			v.getPhotos() == null ? List.of() : new ArrayList<>(v.getPhotos()),
			v.getCreatedAt(),
			v.getUser() == null ? null : v.getUser().getId()
		);
	}
}
