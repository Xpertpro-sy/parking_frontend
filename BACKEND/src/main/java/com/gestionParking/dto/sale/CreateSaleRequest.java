package com.gestionParking.dto.sale;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class CreateSaleRequest {

	@NotNull
	private UUID vehicleId;

	@NotBlank
	@Size(max = 160)
	private String buyerName;

	@NotBlank
	@Size(max = 40)
	private String buyerPhone;

	@NotNull
	@DecimalMin(value = "0.0", inclusive = false)
	private BigDecimal amount;

	private LocalDate date;
}
