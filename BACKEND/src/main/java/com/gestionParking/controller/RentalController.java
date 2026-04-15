package com.gestionParking.controller;

import com.gestionParking.dto.rental.CreateRentalRequest;
import com.gestionParking.dto.rental.RentalReceiptResponse;
import com.gestionParking.dto.rental.RentalResponse;
import com.gestionParking.service.RentalService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class RentalController {

	private final RentalService rentalService;

	public RentalController(RentalService rentalService) {
		this.rentalService = rentalService;
	}

	@PostMapping("/rentals")
	public ResponseEntity<?> createRental(
		@Valid @RequestBody CreateRentalRequest request,
		@AuthenticationPrincipal UserDetails principal
	) {
		try {
			RentalResponse rental = rentalService.createRental(request, principal.getUsername());
			return ResponseEntity.status(HttpStatus.CREATED).body(rental);
		} catch (IllegalArgumentException ex) {
			return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
		}
	}

	@GetMapping("/rentals")
	public List<RentalResponse> listRentals(@AuthenticationPrincipal UserDetails principal) {
		return rentalService.listRentals(principal.getUsername());
	}

	@GetMapping("/rentals/{id}")
	public ResponseEntity<RentalResponse> getRental(
		@PathVariable UUID id,
		@AuthenticationPrincipal UserDetails principal
	) {
		return rentalService.getRental(id, principal.getUsername())
			.map(ResponseEntity::ok)
			.orElse(ResponseEntity.notFound().build());
	}

	@PutMapping("/rentals/{id}/complete")
	public ResponseEntity<?> completeRental(
		@PathVariable UUID id,
		@AuthenticationPrincipal UserDetails principal
	) {
		try {
			return rentalService.completeRental(id, principal.getUsername())
				.map(ResponseEntity::ok)
				.orElse(ResponseEntity.notFound().build());
		} catch (IllegalArgumentException ex) {
			return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
		}
	}

	@GetMapping("/rentals/{id}/receipt")
	public ResponseEntity<RentalReceiptResponse> getReceiptByRental(
		@PathVariable UUID id,
		@AuthenticationPrincipal UserDetails principal
	) {
		return rentalService.getReceiptByRental(id, principal.getUsername())
			.map(ResponseEntity::ok)
			.orElse(ResponseEntity.notFound().build());
	}

	@GetMapping("/rental-receipts/{receiptId}")
	public ResponseEntity<RentalReceiptResponse> getReceipt(
		@PathVariable UUID receiptId,
		@AuthenticationPrincipal UserDetails principal
	) {
		return rentalService.getReceipt(receiptId, principal.getUsername())
			.map(ResponseEntity::ok)
			.orElse(ResponseEntity.notFound().build());
	}
}
