package com.gestionParking.dto.upload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PresignUploadRequest {

	@NotBlank
	@Size(max = 255)
	private String fileName;

	@NotBlank
	@Size(max = 100)
	private String contentType;
}
