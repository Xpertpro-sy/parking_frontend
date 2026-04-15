package com.gestionParking.dto.reservation;

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
public class CreateReservationRequest {

	@NotBlank
	@Size(max = 160)
	private String customerName;

	@NotBlank
	@Size(max = 40)
	private String customerPhone;

	@Size(max = 1200)
	private String notes;

	@NotNull
	private LocalDate reservationDate;

	@NotNull
	@DecimalMin(value = "0.0", inclusive = true)
	private BigDecimal amountPaid;
}
