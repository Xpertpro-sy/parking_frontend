package com.gestionParking.service;

import com.gestionParking.entity.User;
import com.gestionParking.repository.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CustomUserDetailsService implements UserDetailsService {

	private final UserRepository userRepository;

	public CustomUserDetailsService(UserRepository userRepository) {
		this.userRepository = userRepository;
	}

	@Override
	public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
		String normalizedEmail = email == null ? "" : email.trim().toLowerCase();
		User user = userRepository.findByEmail(normalizedEmail)
			.orElseThrow(() -> new UsernameNotFoundException("Utilisateur introuvable"));

		String role = normalizeRole(user.getRole());

		return org.springframework.security.core.userdetails.User
			.withUsername(user.getEmail())
			.password(user.getPassword())
			.authorities(List.of(new SimpleGrantedAuthority(role)))
			.build();
	}

	private String normalizeRole(String role) {
		String normalized = role == null || role.isBlank() ? "USER" : role.trim().toUpperCase();
		return normalized.startsWith("ROLE_") ? normalized : "ROLE_" + normalized;
	}
}
