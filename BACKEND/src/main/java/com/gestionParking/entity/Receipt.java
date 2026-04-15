package com.gestionParking.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "receipts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Receipt {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "receipt_number", nullable = false, unique = true, length = 40)
	private String receiptNumber;

	@OneToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "sale_id", nullable = false, unique = true)
	private Sale sale;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "vehicle_id", nullable = false)
	private Vehicle vehicle;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "seller_user_id", nullable = false)
	private User seller;

	@Column(name = "vehicle_brand", nullable = false)
	private String vehicleBrand;

	@Column(name = "vehicle_model", nullable = false)
	private String vehicleModel;

	@Column(name = "vehicle_plate", nullable = false)
	private String vehiclePlate;

	@Column(name = "buyer_name", nullable = false)
	private String buyerName;

	@Column(name = "buyer_phone", nullable = false)
	private String buyerPhone;

	@Column(nullable = false, precision = 12, scale = 2)
	private BigDecimal amount;

	@Column(name = "sale_date", nullable = false)
	private LocalDate saleDate;

	@Column(name = "issued_at", nullable = false)
	private LocalDateTime issuedAt;

	@PrePersist
	void prePersist() {
		if (issuedAt == null) {
			issuedAt = LocalDateTime.now();
		}
	}
}
