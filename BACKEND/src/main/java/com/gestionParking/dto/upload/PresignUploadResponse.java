package com.gestionParking.dto.upload;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class PresignUploadResponse {

	private String uploadUrl;
	private String objectKey;
	private String publicUrl;
}
