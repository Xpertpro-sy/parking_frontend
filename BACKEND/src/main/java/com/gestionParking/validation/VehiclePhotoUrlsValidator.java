package com.gestionParking.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public class VehiclePhotoUrlsValidator implements ConstraintValidator<ValidVehiclePhotoUrls, List<String>> {

	private static final int MAX_PHOTOS = 4;
	private static final int MAX_URL_LENGTH = 2048;

	@Override
	public boolean isValid(List<String> urls, ConstraintValidatorContext context) {
		if (urls == null || urls.isEmpty()) {
			return true;
		}
		if (urls.size() > MAX_PHOTOS) {
			return false;
		}
		Set<String> seen = new HashSet<>();
		for (String raw : urls) {
			if (raw == null || raw.isBlank()) {
				return false;
			}
			String url = raw.trim();
			if (url.length() > MAX_URL_LENGTH) {
				return false;
			}
			if (!isHttpsUrl(url)) {
				return false;
			}
			if (!seen.add(url.toLowerCase(Locale.ROOT))) {
				return false;
			}
		}
		return true;
	}

	private static boolean isHttpsUrl(String url) {
		try {
			URI uri = URI.create(url);
			if (!"https".equalsIgnoreCase(uri.getScheme())) {
				return false;
			}
			String host = uri.getHost();
			return host != null && !host.isBlank();
		} catch (IllegalArgumentException e) {
			return false;
		}
	}
}
