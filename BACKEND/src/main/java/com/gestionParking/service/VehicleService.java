package com.gestionParking.service;

import com.gestionParking.dto.vehicle.CreateVehicleRequest;
import com.gestionParking.dto.vehicle.UpdateVehicleRequest;
import com.gestionParking.dto.vehicle.VehicleResponse;
import com.gestionParking.entity.User;
import com.gestionParking.entity.Vehicle;
import com.gestionParking.enums.VehicleStatus;
import com.gestionParking.repository.UserRepository;
import com.gestionParking.repository.VehicleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class VehicleService {

	private final VehicleRepository vehicleRepository;
	private final UserRepository userRepository;

	public VehicleService(VehicleRepository vehicleRepository, UserRepository userRepository) {
		this.vehicleRepository = vehicleRepository;
		this.userRepository = userRepository;
	}

	@Transactional
	public VehicleResponse create(CreateVehicleRequest request, String ownerEmail) {
		String email = ownerEmail.trim().toLowerCase();
		User owner = userRepository.findByEmail(email)
			.orElseThrow(() -> new IllegalStateException("Utilisateur connecte introuvable."));

		String plate = normalizePlate(request.getPlate());
		if (vehicleRepository.existsByPlateIgnoreCase(plate)) {
			throw new IllegalArgumentException("Une voiture avec cette immatriculation existe deja.");
		}

		Vehicle vehicle = new Vehicle();
		vehicle.setBrand(trim(request.getBrand()));
		vehicle.setModel(trim(request.getModel()));
		vehicle.setYear(request.getYear());
		vehicle.setColor(trim(request.getColor()));
		vehicle.setPlate(plate);
		vehicle.setFuel(trim(request.getFuel()));
		vehicle.setMileage(request.getMileage());
		vehicle.setSalePrice(request.getSalePrice());
		vehicle.setRentalPrice(request.getRentalPrice());
		vehicle.setDescription(trimToNull(request.getDescription()));
		vehicle.setCondition(trim(request.getCondition()));
		vehicle.setStatus(request.getStatus() != null ? request.getStatus() : VehicleStatus.AVAILABLE);
		vehicle.setUser(owner);
		vehicle.setPhotos(copyPhotoUrls(request.getPhotos()));

		Vehicle saved = vehicleRepository.save(vehicle);
		return VehicleResponse.fromEntity(saved);
	}

	@Transactional(readOnly = true)
	public List<VehicleResponse> listForOwner(String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		return vehicleRepository.findAllByUser_IdOrderByCreatedAtDesc(owner.getId()).stream()
			.map(VehicleResponse::fromEntity)
			.toList();
	}

	@Transactional(readOnly = true)
	public Optional<VehicleResponse> getByIdForOwner(UUID vehicleId, String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		return vehicleRepository.findByIdAndUser_Id(vehicleId, owner.getId())
			.map(VehicleResponse::fromEntity);
	}

	@Transactional
	public Optional<VehicleResponse> updateForOwner(UUID vehicleId, UpdateVehicleRequest request, String ownerEmail) {
		User owner = resolveOwner(ownerEmail);
		Optional<Vehicle> vehicleOpt = vehicleRepository.findByIdAndUser_Id(vehicleId, owner.getId());
		if (vehicleOpt.isEmpty()) {
			return Optional.empty();
		}

		Vehicle vehicle = vehicleOpt.get();
		String plate = normalizePlate(request.getPlate());
		if (vehicleRepository.existsByPlateIgnoreCaseAndIdNot(plate, vehicle.getId())) {
			throw new IllegalArgumentException("Une voiture avec cette immatriculation existe deja.");
		}

		vehicle.setBrand(trim(request.getBrand()));
		vehicle.setModel(trim(request.getModel()));
		vehicle.setYear(request.getYear());
		vehicle.setColor(trim(request.getColor()));
		vehicle.setPlate(plate);
		vehicle.setFuel(trim(request.getFuel()));
		vehicle.setMileage(request.getMileage());
		vehicle.setSalePrice(request.getSalePrice());
		vehicle.setRentalPrice(request.getRentalPrice());
		vehicle.setDescription(trimToNull(request.getDescription()));
		vehicle.setCondition(trim(request.getCondition()));
		if (request.getStatus() != null) {
			vehicle.setStatus(request.getStatus());
		}
		vehicle.setPhotos(copyPhotoUrls(request.getPhotos()));

		Vehicle saved = vehicleRepository.save(vehicle);
		return Optional.of(VehicleResponse.fromEntity(saved));
	}

	private User resolveOwner(String ownerEmail) {
		String email = ownerEmail.trim().toLowerCase();
		return userRepository.findByEmail(email)
			.orElseThrow(() -> new IllegalStateException("Utilisateur connecte introuvable."));
	}

	private static List<String> copyPhotoUrls(List<String> urls) {
		if (urls == null || urls.isEmpty()) {
			return new ArrayList<>();
		}
		List<String> out = new ArrayList<>(urls.size());
		for (String u : urls) {
			out.add(u.trim());
		}
		return out;
	}

	private static String normalizePlate(String plate) {
		return plate.trim().replaceAll("\\s+", "").toUpperCase();
	}

	private static String trim(String s) {
		return s.trim();
	}

	private static String trimToNull(String s) {
		if (s == null) {
			return null;
		}
		String t = s.trim();
		return t.isEmpty() ? null : t;
	}
}
