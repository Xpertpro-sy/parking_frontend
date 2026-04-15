package com.gestionParking.dto.vehicle;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.gestionParking.enums.VehicleStatus;
import com.gestionParking.validation.ValidVehiclePhotoUrls;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class CreateVehicleRequest {

	@NotBlank
	@Size(max = 120)
	private String brand;

	@NotBlank
	@Size(max = 120)
	private String model;

	@NotNull
	@Min(1900)
	@Max(2100)
	private Integer year;

	@NotBlank
	@Size(max = 80)
	private String color;

	@NotBlank
	@Size(max = 32)
	private String plate;

	@NotBlank
	@Size(max = 40)
	private String fuel;

	@NotNull
	@Min(0)
	private Integer mileage;

	@NotNull
	@DecimalMin(value = "0.0", inclusive = true)
	private BigDecimal salePrice;

	@NotNull
	@DecimalMin(value = "0.0", inclusive = true)
	private BigDecimal rentalPrice;

	@Size(max = 4000)
	private String description;

	@NotBlank
	@Size(max = 120)
	private String condition;

	private VehicleStatus status;

	/** URLs publiques (ex. Cloudflare R2 / CDN), uniquement HTTPS — max 4. */
	@ValidVehiclePhotoUrls
	private List<String> photos = new ArrayList<>();
}
