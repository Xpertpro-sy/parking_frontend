package com.gestionParking.security;

import com.gestionParking.service.CustomUserDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

	private final JwtService jwtService;
	private final CustomUserDetailsService userDetailsService;
	private final FirebaseTokenVerifier firebaseTokenVerifier;

	public JwtAuthenticationFilter(
		JwtService jwtService,
		CustomUserDetailsService userDetailsService,
		FirebaseTokenVerifier firebaseTokenVerifier
	) {
		this.jwtService = jwtService;
		this.userDetailsService = userDetailsService;
		this.firebaseTokenVerifier = firebaseTokenVerifier;
	}

	@Override
	protected void doFilterInternal(
		HttpServletRequest request,
		HttpServletResponse response,
		FilterChain filterChain
	) throws ServletException, IOException {
		String authHeader = request.getHeader("Authorization");
		String jwt = extractBearerToken(authHeader);
		if (jwt == null) {
			filterChain.doFilter(request, response);
			return;
		}
		try {
			String email = jwtService.extractUsername(jwt);
			if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
				UserDetails userDetails = userDetailsService.loadUserByUsername(email);
				if (jwtService.isTokenValid(jwt, userDetails)) {
					UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
						userDetails,
						null,
						userDetails.getAuthorities()
					);
					authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
					SecurityContextHolder.getContext().setAuthentication(authToken);
				}
			}
		} catch (Exception ex) {
			log.debug("JWT Spring invalide pour {} {}: {}", request.getMethod(), request.getRequestURI(), ex.getMessage());
			SecurityContextHolder.clearContext();
			tryAuthenticateWithFirebase(jwt, request);
		}

		filterChain.doFilter(request, response);
	}

	private void tryAuthenticateWithFirebase(String idToken, HttpServletRequest request) {
		if (SecurityContextHolder.getContext().getAuthentication() != null) {
			return;
		}
		Optional<String> emailOpt = firebaseTokenVerifier.verifyAndExtractEmail(idToken);
		if (emailOpt.isEmpty()) {
			return;
		}
		String email = emailOpt.get();
		UserDetails firebaseUser = org.springframework.security.core.userdetails.User
			.withUsername(email)
			.password("{noop}firebase-user")
			.authorities(List.of(new SimpleGrantedAuthority("ROLE_ADMIN")))
			.build();
		UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
			firebaseUser,
			null,
			firebaseUser.getAuthorities()
		);
		authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
		SecurityContextHolder.getContext().setAuthentication(authToken);
	}

	/**
	 * Accepte "Bearer &lt;token&gt;" (casse du schéma ignorée), comme Postman / certains clients l'envoient.
	 */
	private static String extractBearerToken(String authorizationHeader) {
		if (authorizationHeader == null || authorizationHeader.isBlank()) {
			return null;
		}
		String header = authorizationHeader.trim();
		int space = header.indexOf(' ');
		if (space <= 0 || space >= header.length() - 1) {
			return null;
		}
		String scheme = header.substring(0, space);
		if (!scheme.equalsIgnoreCase("Bearer")) {
			return null;
		}
		String token = header.substring(space + 1).trim();
		return token.isEmpty() ? null : token;
	}
}
