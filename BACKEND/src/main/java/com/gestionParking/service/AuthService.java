package com.gestionParking.service;

import com.gestionParking.dto.auth.AuthResponse;
import com.gestionParking.dto.auth.LoginRequest;
import com.gestionParking.dto.auth.RegisterRequest;
import com.gestionParking.entity.User;
import com.gestionParking.repository.UserRepository;
import com.gestionParking.security.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final AuthenticationManager authenticationManager;
	private final JwtService jwtService;

	public AuthService(
		UserRepository userRepository,
		PasswordEncoder passwordEncoder,
		AuthenticationManager authenticationManager,
		JwtService jwtService
	) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.authenticationManager = authenticationManager;
		this.jwtService = jwtService;
	}

	public AuthResponse register(RegisterRequest request) {
		validateRegisterRequest(request);

		String email = request.getEmail().trim().toLowerCase();
		if (userRepository.existsByEmail(email)) {
			throw new IllegalArgumentException("Un compte avec cet email existe deja.");
		}

		User user = new User();
		user.setNom(request.getNom().trim());
		user.setPrenom(request.getPrenom().trim());
		user.setEmail(email);
		user.setTelephone(request.getTelephone().trim());
		user.setPassword(passwordEncoder.encode(request.getPassword()));
		user.setRole("ADMIN");

		User savedUser = userRepository.save(user);
		String token = jwtService.generateToken(savedUser);

		return new AuthResponse(
			"Compte cree avec succes.",
			token,
			savedUser.getId(),
			savedUser.getNom(),
			savedUser.getPrenom(),
			savedUser.getEmail(),
			savedUser.getRole()
		);
	}

	public AuthResponse login(LoginRequest request) {
		if (request == null || isBlank(request.getEmail()) || isBlank(request.getPassword())) {
			throw new IllegalArgumentException("Email et mot de passe sont obligatoires.");
		}

		String email = request.getEmail().trim().toLowerCase();

		authenticationManager.authenticate(
			new UsernamePasswordAuthenticationToken(email, request.getPassword())
		);

		User user = userRepository.findByEmail(email)
			.orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable."));
		String token = jwtService.generateToken(user);

		return new AuthResponse(
			"Connexion reussie.",
			token,
			user.getId(),
			user.getNom(),
			user.getPrenom(),
			user.getEmail(),
			user.getRole()
		);
	}

	private void validateRegisterRequest(RegisterRequest request) {
		if (request == null
			|| isBlank(request.getNom())
			|| isBlank(request.getPrenom())
			|| isBlank(request.getEmail())
			|| isBlank(request.getTelephone())
			|| isBlank(request.getPassword())) {
			throw new IllegalArgumentException("Nom, prenom, email, telephone et mot de passe sont obligatoires.");
		}
	}

	private boolean isBlank(String value) {
		return value == null || value.trim().isEmpty();
	}
}
