import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnipileMessageService } from "../unipile-message.service";
import type { UnipileMessageAttachment } from "../unipile-message.service";

// Import the global drizzle mock from test setup
import drizzleMock from "../../../test/setup";

// Mock database schema
vi.mock("~/db/schema/tables2", () => ({
	unipileMessages: {
		id: "id",
		external_id: "external_id",
	},
}));



// Mock services
const mockUnipileService = {
	getMessageAttachment: vi.fn(),
};

const mockR2Service = {
	generateAttachmentKey: vi.fn(),
	upload: vi.fn(),
};



describe("UnipileMessageService - ensureAttachmentAvailable with R2", () => {
	let service: UnipileMessageService;
	let mockUpsertAttachment: any;

	beforeEach(() => {
		vi.clearAllMocks();
		
		service = new UnipileMessageService(drizzleMock);
		
		// Mock the upsertAttachment method
		mockUpsertAttachment = vi.spyOn(service, "upsertAttachment").mockResolvedValue({
			id: "updated-attachment-id",
			message_id: "test-message-id",
			external_id: "test-external-id",
			r2_key: "test-r2-key",
			r2_url: "https://r2.example.com/test-key",
			r2_uploaded_at: new Date(),
		} as any);
	});

	describe("when R2 URL exists and attachment is available", () => {
		it("should return attachment immediately without API calls", async () => {
			// Arrange
			const attachment: UnipileMessageAttachment = {
				id: "attachment-1",
				message_id: "msg-1",
				external_id: "ext-1",
				r2_url: "https://r2.example.com/existing-file.jpg",
				r2_key: "attachments/msg-1/abc123.jpg",
				r2_uploaded_at: new Date(),
				unavailable: false,
				filename: "test.jpg",
				mime_type: "image/jpeg",
				url: null,
				url_expires_at: null,
				content: null,
				file_size: null,
				width: null,
				height: null,
				is_deleted: false,
				created_at: new Date(),
				updated_at: new Date(),
			};

			// Act
			const result = await service.ensureAttachmentAvailable(
				attachment,
				"test-account-id",
				mockUnipileService,
				mockR2Service
			);

			// Assert
			expect(result).toBe(attachment);
			expect(mockUnipileService.getMessageAttachment).not.toHaveBeenCalled();
			expect(mockR2Service.upload).not.toHaveBeenCalled();
			expect(mockUpsertAttachment).not.toHaveBeenCalled();
		});
	});

	describe("when R2 URL is missing but Unipile URL is valid", () => {
		it("should return attachment without refreshing", async () => {
			// Arrange
			const futureExpiry = BigInt(Date.now() + 60 * 60 * 1000); // 1 hour in future
			const attachment: UnipileMessageAttachment = {
				id: "attachment-2",
				message_id: "msg-2",
				external_id: "ext-2",
				r2_url: null,
				r2_key: null,
				r2_uploaded_at: null,
				unavailable: false,
				filename: "test.jpg",
				mime_type: "image/jpeg",
				url: "https://unipile.example.com/valid-url.jpg",
				url_expires_at: futureExpiry,
				content: null,
				file_size: null,
				width: null,
				height: null,
				is_deleted: false,
				created_at: new Date(),
				updated_at: new Date(),
			};

			// Act
			const result = await service.ensureAttachmentAvailable(
				attachment,
				"test-account-id",
				mockUnipileService,
				mockR2Service
			);

			// Assert
			expect(result).toBe(attachment);
			expect(mockUnipileService.getMessageAttachment).not.toHaveBeenCalled();
		});
	});

	describe("when attachment needs refreshing from Unipile and upload to R2", () => {
		it("should fetch from Unipile and upload to R2", async () => {
			// Arrange
			const attachment: UnipileMessageAttachment = {
				id: "attachment-3",
				message_id: "msg-3",
				external_id: "ext-3",
				r2_url: null,
				r2_key: null,
				r2_uploaded_at: null,
				unavailable: true, // Needs refresh
				filename: "test.jpg",
				mime_type: "image/jpeg",
				url: null,
				url_expires_at: null,
				content: null,
				file_size: null,
				width: null,
				height: null,
				is_deleted: false,
				created_at: new Date(),
				updated_at: new Date(),
			};

			// Mock database query for message external_id
			drizzleMock.select.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([
							{ external_id: "msg-external-3" }
						])
					})
				})
			} as any);

			// Mock Unipile service response
			const freshAttachment = {
				content: "SGVsbG8gV29ybGQ=", // "Hello World" in base64
				mime_type: "image/jpeg",
			};
			mockUnipileService.getMessageAttachment.mockResolvedValue(freshAttachment);

			// Mock R2 service responses
			const r2Key = "attachments/msg-3/def456.jpg";
			const r2Url = "https://r2.example.com/def456.jpg";
			mockR2Service.generateAttachmentKey.mockReturnValue(r2Key);
			mockR2Service.upload.mockResolvedValue(r2Url);

			// Act
			const result = await service.ensureAttachmentAvailable(
				attachment,
				"test-account-id",
				mockUnipileService,
				mockR2Service
			);

			// Assert
			expect(mockUnipileService.getMessageAttachment).toHaveBeenCalledWith(
				"msg-external-3",
				"ext-3",
				"test-account-id"
			);
			
			expect(mockR2Service.generateAttachmentKey).toHaveBeenCalledWith(
				"msg-3",
				"test.jpg",
				"image/jpeg"
			);

			expect(mockR2Service.upload).toHaveBeenCalledWith(
				r2Key,
				expect.any(Uint8Array),
				"image/jpeg",
				{
					originalFilename: "test.jpg",
					messageId: "msg-3",
					attachmentId: "ext-3",
				}
			);

			expect(mockUpsertAttachment).toHaveBeenCalledWith(
				"msg-3",
				"ext-3",
				{
					content: undefined, // Should be undefined when R2 URL exists
					mime_type: "image/jpeg",
					unavailable: false,
					r2_key: r2Key,
					r2_url: r2Url,
					r2_uploaded_at: expect.any(Date),
				}
			);
		});

		it("should fallback to storing base64 when R2 upload fails", async () => {
			// Arrange
			const attachment: UnipileMessageAttachment = {
				id: "attachment-4",
				message_id: "msg-4",
				external_id: "ext-4",
				r2_url: null,
				r2_key: null,
				r2_uploaded_at: null,
				unavailable: true,
				filename: "test.jpg",
				mime_type: "image/jpeg",
				url: null,
				url_expires_at: null,
				content: null,
				file_size: null,
				width: null,
				height: null,
				is_deleted: false,
				created_at: new Date(),
				updated_at: new Date(),
			};

			// Mock database query
			drizzleMock.select.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([
							{ external_id: "msg-external-4" }
						])
					})
				})
			} as any);

			// Mock Unipile service response
			const freshAttachment = {
				content: "SGVsbG8gV29ybGQ=", // "Hello World" in base64
				mime_type: "image/jpeg",
			};
			mockUnipileService.getMessageAttachment.mockResolvedValue(freshAttachment);

			// Mock R2 service to fail
			mockR2Service.generateAttachmentKey.mockReturnValue("test-key");
			mockR2Service.upload.mockRejectedValue(new Error("R2 upload failed"));

			// Act
			const result = await service.ensureAttachmentAvailable(
				attachment,
				"test-account-id",
				mockUnipileService,
				mockR2Service
			);

			// Assert
			expect(mockUpsertAttachment).toHaveBeenCalledWith(
				"msg-4",
				"ext-4",
				{
					content: "SGVsbG8gV29ybGQ=", // Should store base64 when R2 fails
					mime_type: "image/jpeg",
					unavailable: false,
					r2_key: "test-key", // Key is generated even if upload fails
					r2_url: undefined,
					r2_uploaded_at: undefined,
				}
			);
		});

		it("should handle expired Unipile URLs", async () => {
			// Arrange
			const expiredTime = BigInt(Date.now() - 60 * 1000); // 1 minute ago
			const attachment: UnipileMessageAttachment = {
				id: "attachment-5",
				message_id: "msg-5",
				external_id: "ext-5",
				r2_url: null,
				r2_key: null,
				r2_uploaded_at: null,
				unavailable: false,
				filename: "test.jpg",
				mime_type: "image/jpeg",
				url: "https://unipile.example.com/expired-url.jpg",
				url_expires_at: expiredTime, // Expired
				content: null,
				file_size: null,
				width: null,
				height: null,
				is_deleted: false,
				created_at: new Date(),
				updated_at: new Date(),
			};

			// Mock database query
			drizzleMock.select.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([
							{ external_id: "msg-external-5" }
						])
					})
				})
			} as any);

			// Mock Unipile service response
			mockUnipileService.getMessageAttachment.mockResolvedValue({
				content: "UmVmcmVzaGVkQ29udGVudA==", // "RefreshedContent" in base64
				mime_type: "image/jpeg",
			});

			// Mock R2 service
			mockR2Service.generateAttachmentKey.mockReturnValue("test-key");
			mockR2Service.upload.mockResolvedValue("https://r2.example.com/test-key");

			// Act
			await service.ensureAttachmentAvailable(
				attachment,
				"test-account-id",
				mockUnipileService,
				mockR2Service
			);

			// Assert
			expect(mockUnipileService.getMessageAttachment).toHaveBeenCalled();
		});
	});

	describe("error handling", () => {
		it("should handle missing message gracefully", async () => {
			// Arrange
			const attachment: UnipileMessageAttachment = {
				id: "attachment-6",
				message_id: "non-existent-msg",
				external_id: "ext-6",
				r2_url: null,
				r2_key: null,
				r2_uploaded_at: null,
				unavailable: true,
				filename: "test.jpg",
				mime_type: "image/jpeg",
				url: null,
				url_expires_at: null,
				content: null,
				file_size: null,
				width: null,
				height: null,
				is_deleted: false,
				created_at: new Date(),
				updated_at: new Date(),
			};

			// Mock database query to return empty array
			drizzleMock.select.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([]) // No message found
					})
				})
			} as any);

			// Act
			const result = await service.ensureAttachmentAvailable(
				attachment,
				"test-account-id",
				mockUnipileService,
				mockR2Service
			);

			// Assert
			expect(result).toBe(attachment);
			expect(mockUnipileService.getMessageAttachment).not.toHaveBeenCalled();
		});

		it("should mark attachment as unavailable when Unipile fetch fails", async () => {
			// Arrange
			const attachment: UnipileMessageAttachment = {
				id: "attachment-7",
				message_id: "msg-7",
				external_id: "ext-7",
				r2_url: null,
				r2_key: null,
				r2_uploaded_at: null,
				unavailable: false, // Will become unavailable
				filename: "test.jpg",
				mime_type: "image/jpeg",
				url: null,
				url_expires_at: null,
				content: null,
				file_size: null,
				width: null,
				height: null,
				is_deleted: false,
				created_at: new Date(),
				updated_at: new Date(),
			};

			// Mock database query
			drizzleMock.select.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([
							{ external_id: "msg-external-7" }
						])
					})
				})
			} as any);

			// Mock Unipile service to fail
			mockUnipileService.getMessageAttachment.mockRejectedValue(
				new Error("Unipile API error")
			);

			// Act
			const result = await service.ensureAttachmentAvailable(
				attachment,
				"test-account-id",
				mockUnipileService,
				mockR2Service
			);

			// Assert
			expect(mockUpsertAttachment).toHaveBeenCalledWith(
				"msg-7",
				"ext-7",
				{ unavailable: true }
			);
		});

		it("should return original attachment when unavailable update fails", async () => {
			// Arrange
			const attachment: UnipileMessageAttachment = {
				id: "attachment-8",
				message_id: "msg-8",
				external_id: "ext-8",
				r2_url: null,
				r2_key: null,
				r2_uploaded_at: null,
				unavailable: false,
				filename: "test.jpg",
				mime_type: "image/jpeg",
				url: null,
				url_expires_at: null,
				content: null,
				file_size: null,
				width: null,
				height: null,
				is_deleted: false,
				created_at: new Date(),
				updated_at: new Date(),
			};

			// Mock database query
			drizzleMock.select.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([
							{ external_id: "msg-external-8" }
						])
					})
				})
			} as any);

			// Mock services to fail
			mockUnipileService.getMessageAttachment.mockRejectedValue(new Error("API error"));
			mockUpsertAttachment.mockRejectedValue(new Error("DB update failed"));

			// Act
			const result = await service.ensureAttachmentAvailable(
				attachment,
				"test-account-id",
				mockUnipileService,
				mockR2Service
			);

			// Assert
			expect(result).toBe(attachment);
		});
	});

	describe("with existing R2 key but missing URL", () => {
		it("should reuse existing R2 key when uploading", async () => {
			// Arrange
			const existingR2Key = "attachments/msg-9/existing123.jpg";
			const attachment: UnipileMessageAttachment = {
				id: "attachment-9",
				message_id: "msg-9",
				external_id: "ext-9",
				r2_url: null, // Missing URL
				r2_key: existingR2Key, // But has key
				r2_uploaded_at: null,
				unavailable: true,
				filename: "test.jpg",
				mime_type: "image/jpeg",
				url: null,
				url_expires_at: null,
				content: null,
				file_size: null,
				width: null,
				height: null,
				is_deleted: false,
				created_at: new Date(),
				updated_at: new Date(),
			};

			// Mock database query
			drizzleMock.select.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([
							{ external_id: "msg-external-9" }
						])
					})
				})
			} as any);

			// Mock Unipile service response
			mockUnipileService.getMessageAttachment.mockResolvedValue({
				content: "SGVsbG8gV29ybGQ=", // "Hello World" in base64
				mime_type: "image/jpeg",
			});

			// Mock R2 service
			const r2Url = "https://r2.example.com/existing123.jpg";
			mockR2Service.upload.mockResolvedValue(r2Url);

			// Act
			await service.ensureAttachmentAvailable(
				attachment,
				"test-account-id",
				mockUnipileService,
				mockR2Service
			);

			// Assert
			expect(mockR2Service.generateAttachmentKey).not.toHaveBeenCalled(); // Should not generate new key
			expect(mockR2Service.upload).toHaveBeenCalledWith(
				existingR2Key, // Should use existing key
				expect.any(Uint8Array),
				"image/jpeg",
				expect.any(Object)
			);
		});
	});
});
