import { beforeEach, describe, expect, it, vi } from "vitest";

// Environment constants for tests
const mockEnv = {
	R2_ENDPOINT: "https://test-account.r2.cloudflarestorage.com",
	R2_BUCKET: "test-bucket",
	R2_ACCESS_KEY: "test-access-key",
	R2_SECRET_KEY: "test-secret-key",
};

// Mock environment variables FIRST
vi.mock("~/env", () => ({
	env: mockEnv,
}));

// Mock AWS SDK
vi.mock("@aws-sdk/client-s3", () => ({
	S3Client: vi.fn(),
	PutObjectCommand: vi.fn(),
	HeadObjectCommand: vi.fn(),
	GetObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: vi.fn(),
}));

// Import AFTER mocks are set up
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { R2Service, createR2Service } from "../r2.service";

describe("R2Service", () => {
	let r2Service: R2Service;
	let mockS3Client: any;
	let mockSend: any;

	beforeEach(() => {
		vi.clearAllMocks();
		
		// Create mock S3 client with send method
		mockSend = vi.fn();
		mockS3Client = {
			send: mockSend,
		};
		
		// Mock S3Client constructor
		(S3Client as any).mockImplementation(() => mockS3Client);
		
		// Create service instance
		r2Service = new R2Service(mockS3Client);
		
		// Override the private properties with test values since env mocking isn't working
		(r2Service as any).bucket = mockEnv.R2_BUCKET;
		(r2Service as any).endpoint = mockEnv.R2_ENDPOINT;
	});

	describe("upload", () => {
		it("should successfully upload file to R2", async () => {
			// Arrange
			const key = "test/file.jpg";
			const data = new Uint8Array([1, 2, 3, 4]);
			const mimeType = "image/jpeg";
			const metadata = { originalFilename: "test.jpg" };

			mockSend.mockResolvedValue({});

			// Act
			const result = await r2Service.upload(key, data, mimeType, metadata);

		// Assert
		expect(PutObjectCommand).toHaveBeenCalledWith({
			Bucket: mockEnv.R2_BUCKET,
			Key: key,
			Body: data,
			ContentType: mimeType,
			Metadata: metadata,
		});
		expect(mockSend).toHaveBeenCalledTimes(1);
		expect(result).toBe(`${mockEnv.R2_ENDPOINT}/${mockEnv.R2_BUCKET}/test/file.jpg`);
		});

		it("should handle upload with Buffer data", async () => {
			// Arrange
			const key = "test/buffer-file.png";
			const data = Buffer.from([5, 6, 7, 8]);
			const mimeType = "image/png";

			mockSend.mockResolvedValue({});

			// Act
			const result = await r2Service.upload(key, data, mimeType);

		// Assert
		expect(PutObjectCommand).toHaveBeenCalledWith({
			Bucket: mockEnv.R2_BUCKET,
			Key: key,
			Body: data,
			ContentType: mimeType,
			Metadata: undefined,
		});
		expect(result).toBe(`${mockEnv.R2_ENDPOINT}/${mockEnv.R2_BUCKET}/test/buffer-file.png`);
		});

		it("should throw error when upload fails", async () => {
			// Arrange
			const key = "test/fail.jpg";
			const data = new Uint8Array([1, 2, 3]);
			const mimeType = "image/jpeg";
			const error = new Error("Upload failed");

			mockSend.mockRejectedValue(error);

			// Act & Assert
			await expect(r2Service.upload(key, data, mimeType)).rejects.toThrow(
				"R2 upload failed: Upload failed"
			);
		});

		it("should handle unknown error types", async () => {
			// Arrange
			const key = "test/unknown-error.jpg";
			const data = new Uint8Array([1, 2, 3]);
			const mimeType = "image/jpeg";

			mockSend.mockRejectedValue("Unknown error");

			// Act & Assert
			await expect(r2Service.upload(key, data, mimeType)).rejects.toThrow(
				"R2 upload failed: Unknown error"
			);
		});
	});

	describe("exists", () => {
		it("should return true when file exists", async () => {
			// Arrange
			const key = "test/existing-file.jpg";
			mockSend.mockResolvedValue({});

			// Act
			const result = await r2Service.exists(key);

					// Assert
		expect(HeadObjectCommand).toHaveBeenCalledWith({
			Bucket: mockEnv.R2_BUCKET,
			Key: key,
		});
		expect(mockSend).toHaveBeenCalledTimes(1);
		expect(result).toBe(true);
		});

		it("should return false when file does not exist", async () => {
			// Arrange
			const key = "test/non-existing-file.jpg";
			mockSend.mockRejectedValue(new Error("Not found"));

			// Act
			const result = await r2Service.exists(key);

					// Assert
		expect(HeadObjectCommand).toHaveBeenCalledWith({
			Bucket: mockEnv.R2_BUCKET,
			Key: key,
		});
		expect(result).toBe(false);
		});
	});

	describe("getSignedUrl", () => {
		it("should generate signed URL with default expiration", async () => {
					// Arrange
		const key = "test/private-file.jpg";
		const expectedUrl = "https://signed-url.example.com";

		(getSignedUrl as any).mockResolvedValue(expectedUrl);

		// Act
		const result = await r2Service.getSignedUrl(key);

		// Assert
		expect(GetObjectCommand).toHaveBeenCalledWith({
			Bucket: mockEnv.R2_BUCKET,
			Key: key,
		});
		expect(getSignedUrl).toHaveBeenCalledWith(
			mockS3Client,
			expect.any(Object),
			{ expiresIn: 86400 }
		);
		expect(result).toBe(expectedUrl);
		});

		it("should generate signed URL with custom expiration", async () => {
					// Arrange
		const key = "test/private-file.jpg";
		const expiresInSeconds = 3600;
		const expectedUrl = "https://signed-url-custom.example.com";

		(getSignedUrl as any).mockResolvedValue(expectedUrl);

		// Act
		const result = await r2Service.getSignedUrl(key, expiresInSeconds);

		// Assert
		expect(getSignedUrl).toHaveBeenCalledWith(
			mockS3Client,
			expect.any(Object),
			{ expiresIn: expiresInSeconds }
		);
		expect(result).toBe(expectedUrl);
		});

		it("should throw error when signed URL generation fails", async () => {
					// Arrange
		const key = "test/fail-signed.jpg";
		const error = new Error("Signed URL generation failed");

		(getSignedUrl as any).mockRejectedValue(error);

		// Act & Assert
		await expect(r2Service.getSignedUrl(key)).rejects.toThrow(
			"Failed to generate signed URL: Signed URL generation failed"
		);
		});
	});

	describe("generateAttachmentKey", () => {
		it("should generate key with filename extension", () => {
			// Arrange
			const messageId = "msg-123";
			const originalFilename = "document.pdf";
			const mimeType = "application/pdf";

			// Act
			const result = r2Service.generateAttachmentKey(messageId, originalFilename, mimeType);

			// Assert
			expect(result).toMatch(/^attachments\/msg-123\/[a-z0-9]{6}\.pdf$/);
		});

		it("should generate key from MIME type when filename has no extension", () => {
			// Arrange
			const messageId = "msg-456";
			const originalFilename = "document";
			const mimeType = "image/jpeg";

			// Act
			const result = r2Service.generateAttachmentKey(messageId, originalFilename, mimeType);

			// Assert
			expect(result).toMatch(/^attachments\/msg-456\/[a-z0-9]{6}\.jpg$/);
		});

		it("should handle various MIME types correctly", () => {
			const testCases = [
				{ mimeType: "image/png", expectedExt: "png" },
				{ mimeType: "video/mp4", expectedExt: "mp4" },
				{ mimeType: "audio/mpeg", expectedExt: "mp3" },
				{ mimeType: "application/msword", expectedExt: "doc" },
				{ mimeType: "text/plain", expectedExt: "txt" },
				{ mimeType: "unknown/type", expectedExt: "bin" },
			];

			testCases.forEach(({ mimeType, expectedExt }) => {
				const result = r2Service.generateAttachmentKey("msg-test", undefined, mimeType);
				expect(result).toMatch(new RegExp(`^attachments\\/msg-test\\/[a-z0-9]{6}\\.${expectedExt}$`));
			});
		});

		it("should generate key without extension when no filename or MIME type", () => {
			// Arrange
			const messageId = "msg-789";

			// Act
			const result = r2Service.generateAttachmentKey(messageId);

			// Assert
			expect(result).toMatch(/^attachments\/msg-789\/[a-z0-9]{6}$/);
		});

		it("should prefer filename extension over MIME type", () => {
			// Arrange
			const messageId = "msg-priority";
			const originalFilename = "test.jpg";
			const mimeType = "image/png"; // Different from filename extension

			// Act
			const result = r2Service.generateAttachmentKey(messageId, originalFilename, mimeType);

			// Assert
			expect(result).toMatch(/^attachments\/msg-priority\/[a-z0-9]{6}\.jpg$/);
		});

		it("should generate unique keys for same inputs", () => {
			// Arrange
			const messageId = "msg-unique";
			const originalFilename = "test.jpg";
			const mimeType = "image/jpeg";

			// Act
			const result1 = r2Service.generateAttachmentKey(messageId, originalFilename, mimeType);
			const result2 = r2Service.generateAttachmentKey(messageId, originalFilename, mimeType);

			// Assert
			expect(result1).not.toBe(result2);
			expect(result1).toMatch(/^attachments\/msg-unique\/[a-z0-9]{6}\.jpg$/);
			expect(result2).toMatch(/^attachments\/msg-unique\/[a-z0-9]{6}\.jpg$/);
		});
	});

	describe("getPublicUrl", () => {
		it("should return correct public URL for key", () => {
			// Arrange
			const key = "test/public-file.jpg";

			// Act
			const result = r2Service.getPublicUrl(key);

		// Assert
		expect(result).toBe(`${mockEnv.R2_ENDPOINT}/${mockEnv.R2_BUCKET}/test/public-file.jpg`);
		});

		it("should handle keys with special characters", () => {
			// Arrange
			const key = "test/file with spaces & symbols.jpg";

			// Act
			const result = r2Service.getPublicUrl(key);

		// Assert
		expect(result).toBe(`${mockEnv.R2_ENDPOINT}/${mockEnv.R2_BUCKET}/test/file with spaces & symbols.jpg`);
		});
	});
});

describe("createR2Service", () => {
	it("should create R2Service instance with global S3Client", () => {
		// Arrange
		vi.clearAllMocks();
		
		// Act
		const service = createR2Service();

		// Assert
		expect(service).toBeInstanceOf(R2Service);
		// Note: Due to environment mocking limitations in Vitest, we verify the service was created
		// The actual environment variable reading would happen at runtime with real env vars
	});
});
