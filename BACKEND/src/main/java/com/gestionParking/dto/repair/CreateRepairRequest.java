package com.gestionParking.dto.repair;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class CreateRepairRequest {

	@NotBlank
	@Size(max = 2000)
	private String reason;

	@NotNull
	@DecimalMin(value = "0.0", inclusive = true)
	private BigDecimal cost;

	@NotNull
	private LocalDate startDate;
}
