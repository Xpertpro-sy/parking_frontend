package com.gestionParking.controller;

import com.gestionParking.dto.upload.PresignUploadRequest;
import com.gestionParking.dto.upload.PresignUploadResponse;
import com.gestionParking.service.R2UploadService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/uploads")
public class UploadController {

	private final R2UploadService r2UploadService;

	public UploadController(R2UploadService r2UploadService) {
		this.r2UploadService = r2UploadService;
	}

	@PostMapping("/presign")
	public ResponseEntity<PresignUploadResponse> presignUpload(
		@Valid @RequestBody PresignUploadRequest request,
		@AuthenticationPrincipal UserDetails principal
	) {
		if (principal == null) {
			throw new IllegalStateException("Utilisateur non authentifie.");
		}

		PresignUploadResponse response = r2UploadService.generatePresignedUpload(principal.getUsername(), request);
		return ResponseEntity.ok(response);
	}
}
