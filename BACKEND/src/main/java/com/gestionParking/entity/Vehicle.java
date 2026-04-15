package com.gestionParking.entity;

import com.gestionParking.enums.VehicleStatus;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "vehicles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Vehicle {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false)
	private String brand;

	@Column(nullable = false)
	private String model;

	@Column(nullable = false)
	private Integer year;

	@Column(nullable = false)
	private String color;

	@Column(nullable = false, unique = true)
	private String plate;

	@Column(nullable = false)
	private String fuel;

	@Column(nullable = false)
	private Integer mileage;

	@Column(name = "sale_price", nullable = false, precision = 12, scale = 2)
	private BigDecimal salePrice;

	@Column(name = "rental_price", nullable = false, precision = 12, scale = 2)
	private BigDecimal rentalPrice;

	@Column(length = 4000)
	private String description;

	@Column(name = "vehicle_condition", nullable = false)
	private String condition;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private VehicleStatus status;

	@ElementCollection
	@CollectionTable(name = "vehicle_photos", joinColumns = @JoinColumn(name = "vehicle_id"))
	@Column(name = "photo_url", length = 2048)
	private List<String> photos = new ArrayList<>();

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id")
	private User user;

	@PrePersist
	void prePersist() {
		if (createdAt == null) {
			createdAt = LocalDateTime.now();
		}
	}
}
