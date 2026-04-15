package com.gestionParking.service;

import com.gestionParking.dto.upload.PresignUploadRequest;
import com.gestionParking.dto.upload.PresignUploadResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;

import java.net.URI;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class R2UploadService {

	private static final Map<String, String> CONTENT_TYPE_TO_EXTENSION = Map.of(
		"image/jpeg", "jpg",
		"image/png", "png",
		"image/webp", "webp",
		"image/gif", "gif"
	);

	private final String accountId;
	private final String accessKeyId;
	private final String secretAccessKey;
	private final String bucket;
	private final String region;
	private final String publicBaseUrl;
	private final int presignedExpiresSeconds;

	public R2UploadService(
		@Value("${r2.account-id}") String accountId,
		@Value("${r2.access-key-id}") String accessKeyId,
		@Value("${r2.secret-access-key}") String secretAccessKey,
		@Value("${r2.bucket}") String bucket,
		@Value("${r2.region:auto}") String region,
		@Value("${r2.public-base-url}") String publicBaseUrl,
		@Value("${r2.presigned-expires-seconds:300}") int presignedExpiresSeconds
	) {
		this.accountId = accountId;
		this.accessKeyId = accessKeyId;
		this.secretAccessKey = secretAccessKey;
		this.bucket = bucket;
		this.region = region;
		this.publicBaseUrl = publicBaseUrl;
		this.presignedExpiresSeconds = presignedExpiresSeconds;
	}

	public PresignUploadResponse generatePresignedUpload(String ownerEmail, PresignUploadRequest request) {
		validateR2Configuration();

		String normalizedContentType = normalizeContentType(request.getContentType());
		String extension = resolveExtension(normalizedContentType);
		String objectKey = buildObjectKey(ownerEmail, extension);

		PutObjectRequest putObjectRequest = PutObjectRequest.builder()
			.bucket(bucket)
			.key(objectKey)
			.contentType(normalizedContentType)
			.build();

		PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
			.signatureDuration(Duration.ofSeconds(presignedExpiresSeconds))
			.putObjectRequest(putObjectRequest)
			.build();

		PresignedPutObjectRequest presignedPutObjectRequest;
		try (S3Presigner presigner = buildPresigner()) {
			presignedPutObjectRequest = presigner.presignPutObject(presignRequest);
		}

		String cleanPublicBaseUrl = publicBaseUrl.endsWith("/")
			? publicBaseUrl.substring(0, publicBaseUrl.length() - 1)
			: publicBaseUrl;
		String publicUrl = cleanPublicBaseUrl + "/" + objectKey;

		return new PresignUploadResponse(
			presignedPutObjectRequest.url().toString(),
			objectKey,
			publicUrl
		);
	}

	private S3Presigner buildPresigner() {
		return S3Presigner.builder()
			.endpointOverride(URI.create("https://" + accountId + ".r2.cloudflarestorage.com"))
			.region(Region.of(region))
			.credentialsProvider(
				StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretAccessKey))
			)
			.serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
			.build();
	}

	private String normalizeContentType(String rawContentType) {
		if (rawContentType == null) {
			throw new IllegalArgumentException("Le type de fichier est obligatoire.");
		}
		return rawContentType.trim().toLowerCase(Locale.ROOT);
	}

	private String resolveExtension(String contentType) {
		String extension = CONTENT_TYPE_TO_EXTENSION.get(contentType);
		if (extension == null) {
			throw new IllegalArgumentException("Type d'image non supporte. Formats autorises: jpeg, png, webp, gif.");
		}
		return extension;
	}

	private String buildObjectKey(String ownerEmail, String extension) {
		String ownerFolder = ownerEmail.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]", "_");
		String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
		return "vehicles/" + ownerFolder + "/" + datePath + "/" + UUID.randomUUID() + "." + extension;
	}

	private void validateR2Configuration() {
		if (isBlank(accountId) || isBlank(accessKeyId) || isBlank(secretAccessKey) || isBlank(bucket) || isBlank(publicBaseUrl)) {
			throw new IllegalStateException("Configuration R2 incomplete. Verifiez les variables d'environnement R2_*.");
		}
	}

	private static boolean isBlank(String value) {
		return value == null || value.trim().isEmpty();
	}
}
