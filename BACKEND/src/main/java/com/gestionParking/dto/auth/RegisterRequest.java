package com.gestionParking.dto.auth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class RegisterRequest {

	private String nom;
	private String prenom;
	private String email;
	private String telephone;
	private String password;
}
