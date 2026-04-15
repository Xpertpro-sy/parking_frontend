package com.gestionParking.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum RentalStatus {
	ACTIVE("active"),
	COMPLETED("completed"),
	CANCELLED("cancelled");

	private final String value;

	RentalStatus(String value) {
		this.value = value;
	}

	@JsonValue
	public String getValue() {
		return value;
	}

	@JsonCreator
	public static RentalStatus fromValue(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		for (RentalStatus s : values()) {
			if (s.value.equalsIgnoreCase(raw) || s.name().equalsIgnoreCase(raw)) {
				return s;
			}
		}
		throw new IllegalArgumentException("Unknown rental status: " + raw);
	}
}
