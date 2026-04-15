package com.gestionParking.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum VehicleStatus {
	AVAILABLE("available"),
	SOLD("sold"),
	RENTED("rented"),
	REPAIR("repair"),
	RESERVED("reserved");

	private final String value;

	VehicleStatus(String value) {
		this.value = value;
	}

	@JsonValue
	public String getValue() {
		return value;
	}

	@JsonCreator
	public static VehicleStatus fromValue(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		for (VehicleStatus s : values()) {
			if (s.value.equalsIgnoreCase(raw) || s.name().equalsIgnoreCase(raw)) {
				return s;
			}
		}
		throw new IllegalArgumentException("Unknown vehicle status: " + raw);
	}
}
