package com.gestionParking.controller;

import com.gestionParking.dto.receipt.ReceiptResponse;
import com.gestionParking.dto.sale.CreateSaleRequest;
import com.gestionParking.dto.sale.SaleResponse;
import com.gestionParking.service.SaleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class SaleController {

	private final SaleService saleService;

	public SaleController(SaleService saleService) {
		this.saleService = saleService;
	}

	@PostMapping("/sales")
	public ResponseEntity<?> createSale(
		@Valid @RequestBody CreateSaleRequest request,
		@AuthenticationPrincipal UserDetails principal
	) {
		try {
			SaleResponse sale = saleService.createSale(request, principal.getUsername());
			return ResponseEntity.status(HttpStatus.CREATED).body(sale);
		} catch (IllegalArgumentException ex) {
			return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
		}
	}

	@GetMapping("/sales")
	public List<SaleResponse> listSales(@AuthenticationPrincipal UserDetails principal) {
		return saleService.listSales(principal.getUsername());
	}

	@GetMapping("/sales/{id}")
	public ResponseEntity<SaleResponse> getSale(
		@PathVariable UUID id,
		@AuthenticationPrincipal UserDetails principal
	) {
		return saleService.getSale(id, principal.getUsername())
			.map(ResponseEntity::ok)
			.orElse(ResponseEntity.notFound().build());
	}

	@GetMapping("/sales/{id}/receipt")
	public ResponseEntity<ReceiptResponse> getReceiptBySale(
		@PathVariable UUID id,
		@AuthenticationPrincipal UserDetails principal
	) {
		return saleService.getReceiptBySale(id, principal.getUsername())
			.map(ResponseEntity::ok)
			.orElse(ResponseEntity.notFound().build());
	}

	@GetMapping("/receipts/{receiptId}")
	public ResponseEntity<ReceiptResponse> getReceipt(
		@PathVariable UUID receiptId,
		@AuthenticationPrincipal UserDetails principal
	) {
		return saleService.getReceipt(receiptId, principal.getUsername())
			.map(ResponseEntity::ok)
			.orElse(ResponseEntity.notFound().build());
	}
}
