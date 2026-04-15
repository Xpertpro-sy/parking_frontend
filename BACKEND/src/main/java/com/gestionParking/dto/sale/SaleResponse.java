package com.gestionParking.dto.sale;

import com.gestionParking.dto.receipt.ReceiptResponse;
import com.gestionParking.entity.Sale;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
@AllArgsConstructor
public class SaleResponse {

	private UUID id;
	private UUID vehicleId;
	private Long sellerUserId;
	private String buyerName;
	private String buyerPhone;
	private BigDecimal amount;
	private LocalDate date;
	private ReceiptResponse receipt;

	public static SaleResponse fromEntity(Sale sale) {
		return new SaleResponse(
			sale.getId(),
			sale.getVehicle().getId(),
			sale.getSeller().getId(),
			sale.getBuyerName(),
			sale.getBuyerPhone(),
			sale.getAmount(),
			sale.getDate(),
			sale.getReceipt() == null ? null : ReceiptResponse.fromEntity(sale.getReceipt())
		);
	}
}
