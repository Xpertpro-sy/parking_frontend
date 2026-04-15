package com.gestionParking.security;

import com.gestionParking.service.CustomUserDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private final JwtService jwtService;
	private final CustomUserDetailsService userDetailsService;

	public JwtAuthenticationFilter(JwtService jwtService, CustomUserDetailsService userDetailsService) {
		this.jwtService = jwtService;
		this.userDetailsService = userDetailsService;
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
		} catch (Exception ignored) {
			// Token invalide ou expiré : la requête continue sans authentification JWT
		}

		filterChain.doFilter(request, response);
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
