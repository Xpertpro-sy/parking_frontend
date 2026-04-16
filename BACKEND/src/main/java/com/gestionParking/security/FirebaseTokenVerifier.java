package com.gestionParking.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;

@Component
public class FirebaseTokenVerifier {

	private final String firebaseProjectId;
	private final RestTemplate restTemplate = new RestTemplate();

	public FirebaseTokenVerifier(@Value("${firebase.project-id:${FIREBASE_PROJECT_ID:}}") String firebaseProjectId) {
		this.firebaseProjectId = firebaseProjectId == null ? "" : firebaseProjectId.trim();
	}

	public Optional<String> verifyAndExtractEmail(String idToken) {
		if (idToken == null || idToken.isBlank() || firebaseProjectId.isBlank()) {
			return Optional.empty();
		}
		try {
			String url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + URLEncoder.encode(idToken, StandardCharsets.UTF_8);
			ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
			Map body = response.getBody();
			if (body == null) {
				return Optional.empty();
			}
			Object aud = body.get("aud");
			Object email = body.get("email");
			Object emailVerified = body.get("email_verified");
			if (aud == null || email == null) {
				return Optional.empty();
			}
			if (!firebaseProjectId.equals(String.valueOf(aud).trim())) {
				return Optional.empty();
			}
			if (!Boolean.parseBoolean(String.valueOf(emailVerified))) {
				return Optional.empty();
			}
			String normalizedEmail = String.valueOf(email).trim().toLowerCase();
			return normalizedEmail.isEmpty() ? Optional.empty() : Optional.of(normalizedEmail);
		} catch (RestClientException ex) {
			return Optional.empty();
		}
	}
}
