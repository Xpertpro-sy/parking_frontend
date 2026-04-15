package com.gestionParking.controller;

import com.gestionParking.dto.vehicle.CreateVehicleRequest;
import com.gestionParking.dto.vehicle.UpdateVehicleRequest;
import com.gestionParking.dto.vehicle.VehicleResponse;
import com.gestionParking.service.VehicleService;
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
public class VehicleController {

	private final VehicleService vehicleService;

	public VehicleController(VehicleService vehicleService) {
		this.vehicleService = vehicleService;
	}

	@PostMapping("/vehicles")
	public ResponseEntity<VehicleResponse> create(
		@Valid @RequestBody CreateVehicleRequest request,
		@AuthenticationPrincipal UserDetails principal
	) {
		VehicleResponse body = vehicleService.create(request, principal.getUsername());
		return ResponseEntity.status(HttpStatus.CREATED).body(body);
	}

	@GetMapping("/vehicles")
	public List<VehicleResponse> list(@AuthenticationPrincipal UserDetails principal) {
		return vehicleService.listForOwner(principal.getUsername());
	}

	@GetMapping("/vehicles/{id}")
	public ResponseEntity<VehicleResponse> getById(
		@PathVariable UUID id,
		@AuthenticationPrincipal UserDetails principal
	) {
		return vehicleService.getByIdForOwner(id, principal.getUsername())
			.map(ResponseEntity::ok)
			.orElse(ResponseEntity.notFound().build());
	}

	@PutMapping("/vehicles/{id}")
	public ResponseEntity<?> update(
		@PathVariable UUID id,
		@Valid @RequestBody UpdateVehicleRequest request,
		@AuthenticationPrincipal UserDetails principal
	) {
		try {
			return vehicleService.updateForOwner(id, request, principal.getUsername())
				.map(ResponseEntity::ok)
				.orElse(ResponseEntity.notFound().build());
		} catch (IllegalArgumentException ex) {
			return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
		}
	}
}
