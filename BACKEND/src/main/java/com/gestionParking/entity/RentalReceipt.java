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
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "rental_receipts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RentalReceipt {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "receipt_number", nullable = false, unique = true, length = 40)
	private String receiptNumber;

	@OneToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "rental_id", nullable = false, unique = true)
	private Rental rental;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "vehicle_id", nullable = false)
	private Vehicle vehicle;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "owner_user_id", nullable = false)
	private User owner;

	@Column(name = "vehicle_brand", nullable = false)
	private String vehicleBrand;

	@Column(name = "vehicle_model", nullable = false)
	private String vehicleModel;

	@Column(name = "vehicle_plate", nullable = false)
	private String vehiclePlate;

	@Column(name = "tenant_name", nullable = false)
	private String tenantName;

	@Column(name = "tenant_phone", nullable = false)
	private String tenantPhone;

	@Column(name = "tenant_id_card_number", nullable = false, length = 80)
	private String tenantIdCardNumber;

	@Column(name = "tenant_id_card_photo_url", length = 2048)
	private String tenantIdCardPhotoUrl;

	@Column(name = "start_date", nullable = false)
	private LocalDateTime startDate;

	@Column(name = "end_date", nullable = false)
	private LocalDateTime endDate;

	@Column(name = "total_days", nullable = false)
	private Integer totalDays;

	@Column(name = "daily_price", nullable = false, precision = 12, scale = 2)
	private BigDecimal dailyPrice;

	@Column(name = "rental_amount", nullable = false, precision = 12, scale = 2)
	private BigDecimal rentalAmount;

	@Column(name = "deposit_amount", precision = 12, scale = 2)
	private BigDecimal depositAmount;

	@Column(name = "issued_at", nullable = false)
	private LocalDateTime issuedAt;

	@PrePersist
	void prePersist() {
		if (issuedAt == null) {
			issuedAt = LocalDateTime.now();
		}
	}
}
