package com.gestionParking.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AuthResponse {

	private String message;
	private String accessToken;
	private Long userId;
	private String nom;
	private String prenom;
	private String email;
	private String role;
}
