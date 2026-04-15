package com.gestionParking.service;

import com.gestionParking.dto.receipt.ReceiptResponse;
import com.gestionParking.dto.sale.CreateSaleRequest;
import com.gestionParking.dto.sale.SaleResponse;
import com.gestionParking.entity.Receipt;
import com.gestionParking.entity.Sale;
import com.gestionParking.entity.User;
import com.gestionParking.entity.Vehicle;
import com.gestionParking.enums.VehicleStatus;
import com.gestionParking.repository.ReceiptRepository;
import com.gestionParking.repository.SaleRepository;
import com.gestionParking.repository.UserRepository;
import com.gestionParking.repository.VehicleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class SaleService {

	private final SaleRepository saleRepository;
	private final ReceiptRepository receiptRepository;
	private final VehicleRepository vehicleRepository;
	private final UserRepository userRepository;

	public SaleService(
		SaleRepository saleRepository,
		ReceiptRepository receiptRepository,
		VehicleRepository vehicleRepository,
		UserRepository userRepository
	) {
		this.saleRepository = saleRepository;
		this.receiptRepository = receiptRepository;
		this.vehicleRepository = vehicleRepository;
		this.userRepository = userRepository;
	}

	@Transactional
	public SaleResponse createSale(CreateSaleRequest request, String sellerEmail) {
		User seller = resolveSeller(sellerEmail);
		Vehicle vehicle = vehicleRepository.findByIdAndUser_Id(request.getVehicleId(), seller.getId())
			.orElseThrow(() -> new IllegalArgumentException("Vehicule introuvable pour cet utilisateur."));

		if (vehicle.getStatus() == VehicleStatus.SOLD || saleRepository.existsByVehicle_Id(vehicle.getId())) {
			throw new IllegalArgumentException("Ce vehicule est deja vendu.");
		}
		if (vehicle.getSalePrice() == null || request.getAmount().compareTo(vehicle.getSalePrice()) != 0) {
			throw new IllegalArgumentException(
				"Le montant de vente doit etre exactement egal au prix du vehicule: " + vehicle.getSalePrice()
			);
		}

		Sale sale = new Sale();
		sale.setVehicle(vehicle);
		sale.setSeller(seller);
		sale.setBuyerName(request.getBuyerName().trim());
		sale.setBuyerPhone(request.getBuyerPhone().trim());
		sale.setAmount(request.getAmount());
		sale.setDate(request.getDate() == null ? LocalDate.now() : request.getDate());

		Sale savedSale = saleRepository.save(sale);

		Receipt receipt = new Receipt();
		receipt.setReceiptNumber(buildReceiptNumber(savedSale.getId()));
		receipt.setSale(savedSale);
		receipt.setVehicle(vehicle);
		receipt.setSeller(seller);
		receipt.setVehicleBrand(vehicle.getBrand());
		receipt.setVehicleModel(vehicle.getModel());
		receipt.setVehiclePlate(vehicle.getPlate());
		receipt.setBuyerName(savedSale.getBuyerName());
		receipt.setBuyerPhone(savedSale.getBuyerPhone());
		receipt.setAmount(savedSale.getAmount());
		receipt.setSaleDate(savedSale.getDate());

		Receipt savedReceipt = receiptRepository.save(receipt);
		savedSale.setReceipt(savedReceipt);

		vehicle.setStatus(VehicleStatus.SOLD);
		vehicleRepository.save(vehicle);

		return SaleResponse.fromEntity(savedSale);
	}

	@Transactional(readOnly = true)
	public List<SaleResponse> listSales(String sellerEmail) {
		User seller = resolveSeller(sellerEmail);
		return saleRepository.findAllBySeller_IdOrderByDateDesc(seller.getId()).stream()
			.map(SaleResponse::fromEntity)
			.toList();
	}

	@Transactional(readOnly = true)
	public Optional<SaleResponse> getSale(UUID saleId, String sellerEmail) {
		User seller = resolveSeller(sellerEmail);
		return saleRepository.findByIdAndSeller_Id(saleId, seller.getId())
			.map(SaleResponse::fromEntity);
	}

	@Transactional(readOnly = true)
	public Optional<ReceiptResponse> getReceiptBySale(UUID saleId, String sellerEmail) {
		User seller = resolveSeller(sellerEmail);
		return receiptRepository.findBySale_IdAndSeller_Id(saleId, seller.getId())
			.map(ReceiptResponse::fromEntity);
	}

	@Transactional(readOnly = true)
	public Optional<ReceiptResponse> getReceipt(UUID receiptId, String sellerEmail) {
		User seller = resolveSeller(sellerEmail);
		return receiptRepository.findByIdAndSeller_Id(receiptId, seller.getId())
			.map(ReceiptResponse::fromEntity);
	}

	private User resolveSeller(String sellerEmail) {
		String email = sellerEmail.trim().toLowerCase();
		return userRepository.findByEmail(email)
			.orElseThrow(() -> new IllegalStateException("Utilisateur connecte introuvable."));
	}

	private static String buildReceiptNumber(UUID saleId) {
		return "FAC-" + LocalDate.now() + "-" + saleId.toString().substring(0, 8).toUpperCase();
	}
}
