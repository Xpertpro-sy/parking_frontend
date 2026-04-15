package com.gestionParking.dto.rental;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class CreateRentalRequest {

	@NotNull
	private UUID vehicleId;

	@NotBlank
	@Size(max = 160)
	private String tenantName;

	@NotBlank
	@Size(max = 40)
	private String tenantPhone;

	@NotBlank
	@Size(max = 80)
	private String tenantIdCardNumber;

	@Size(max = 2048)
	private String tenantIdCardPhotoUrl;

	@Size(max = 500)
	private String tenantAddress;

	@Size(max = 160)
	private String emergencyContactName;

	@Size(max = 40)
	private String emergencyContactPhone;

	@NotNull
	private LocalDateTime startDate;

	@NotNull
	private LocalDateTime endDate;

	@NotNull
	@DecimalMin(value = "0.0", inclusive = false)
	private BigDecimal amount;

	@DecimalMin(value = "0.0", inclusive = true)
	private BigDecimal depositAmount;
}
