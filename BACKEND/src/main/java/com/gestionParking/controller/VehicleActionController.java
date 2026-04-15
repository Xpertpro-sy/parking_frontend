package com.gestionParking.controller;

import com.gestionParking.dto.repair.CreateRepairRequest;
import com.gestionParking.dto.repair.RepairResponse;
import com.gestionParking.dto.reservation.CreateReservationRequest;
import com.gestionParking.dto.reservation.ReservationResponse;
import com.gestionParking.service.VehicleActionService;
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

import java.util.Map;
import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class VehicleActionController {

	private final VehicleActionService vehicleActionService;

	public VehicleActionController(VehicleActionService vehicleActionService) {
		this.vehicleActionService = vehicleActionService;
	}

	@PostMapping("/vehicles/{id}/reservations")
	public ResponseEntity<?> reserveVehicle(
		@PathVariable UUID id,
		@Valid @RequestBody CreateReservationRequest request,
		@AuthenticationPrincipal UserDetails principal
	) {
		try {
			ReservationResponse response = vehicleActionService.reserveVehicle(id, request, principal.getUsername());
			return ResponseEntity.status(HttpStatus.CREATED).body(response);
		} catch (IllegalArgumentException ex) {
			return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
		}
	}

	@GetMapping("/reservations")
	public List<ReservationResponse> listReservations(@AuthenticationPrincipal UserDetails principal) {
		return vehicleActionService.listReservations(principal.getUsername());
	}

	@PutMapping("/vehicles/{id}/reservations/cancel")
	public ResponseEntity<?> cancelReservation(
		@PathVariable UUID id,
		@AuthenticationPrincipal UserDetails principal
	) {
		try {
			ReservationResponse response = vehicleActionService.cancelActiveReservation(id, principal.getUsername());
			return ResponseEntity.ok(response);
		} catch (IllegalArgumentException ex) {
			return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
		}
	}

	@PostMapping("/vehicles/{id}/repairs")
	public ResponseEntity<?> sendToRepair(
		@PathVariable UUID id,
		@Valid @RequestBody CreateRepairRequest request,
		@AuthenticationPrincipal UserDetails principal
	) {
		try {
			RepairResponse response = vehicleActionService.sendVehicleToRepair(id, request, principal.getUsername());
			return ResponseEntity.status(HttpStatus.CREATED).body(response);
		} catch (IllegalArgumentException ex) {
			return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
		}
	}

	@PutMapping("/vehicles/{id}/repairs/complete")
	public ResponseEntity<?> completeRepair(
		@PathVariable UUID id,
		@AuthenticationPrincipal UserDetails principal
	) {
		try {
			RepairResponse response = vehicleActionService.completeVehicleRepair(id, principal.getUsername());
			return ResponseEntity.ok(response);
		} catch (IllegalArgumentException ex) {
			return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
		}
	}
}
