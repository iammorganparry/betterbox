import { describe, it, expect, vi, beforeEach } from "vitest";
import { _handleMessageReceived } from "../unipile-sync";
import type { UnipileMessageReceivedEventData } from "../schemas/unipile";

// Mock the dependencies (env is already mocked in setup.ts)
vi.mock("~/config/sync.config", () => ({
	getCurrentSyncConfig: () => ({
		enableProfileEnrichment: false,
		enableDetailedLogging: false,
	}),
}));
vi.mock("../unipile/unipile.service", () => ({
	createUnipileService: vi.fn(() => ({})),
}));

// Mock console methods to avoid noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock services
const mockServices = {
	unipileAccountService: {
		findUnipileAccountByProvider: vi.fn(),
	},
	unipileMessageService: {
		upsertMessage: vi.fn(),
		upsertAttachment: vi.fn(),
	},
	unipileContactService: {
		upsertContact: vi.fn(),
	},
	unipileChatService: {
		findChatByExternalId: vi.fn(),
		upsertChat: vi.fn(),
		upsertAttendee: vi.fn(),
	},
};

// Mock step.run to execute functions directly
const mockStep = {
	run: vi.fn((name: string, fn: () => any) => fn()),
};

// Helper function to create test event data
const createTestEvent = (overrides: Partial<UnipileMessageReceivedEventData> = {}): UnipileMessageReceivedEventData => ({
	account_id: "account-123",
	account_type: "linkedin",
	account_info: { 
		feature: "messaging",
		type: "linkedin",
		user_id: "user-123" 
	},
	message_id: "msg-123",
	message: "Test message",
	chat_id: "chat-123",
	sender: { 
		attendee_id: "sender-id",
		attendee_name: "Sender Name",
		attendee_profile_url: "https://linkedin.com/in/sender",
		attendee_provider_id: "other-user" 
	},
	attendees: [],
	timestamp: "2025-01-07T10:00:00Z",
	attachments: [],
	message_type: "MESSAGE",
	provider_message_id: "provider-msg-123",
	provider_chat_id: "provider-chat-123",
	is_event: 0,
	is_group: false,
	chat_content_type: null,
	folder: ["INBOX"],
	quoted: null,
	subject: null,
	event: "message_received",
	webhook_name: "unipile_message_received",
	...overrides,
});

describe("_handleMessageReceived - Attachment Processing", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		
		// Setup default mock returns
		mockServices.unipileAccountService.findUnipileAccountByProvider.mockResolvedValue({
			id: "unipile-account-id",
			account_id: "account-123",
			user_id: "user-123",
		});
		
		mockServices.unipileChatService.findChatByExternalId.mockResolvedValue({
			id: "chat-internal-id",
		});
		
		mockServices.unipileMessageService.upsertMessage.mockResolvedValue({
			id: "message-internal-id",
		});
		
		mockServices.unipileMessageService.upsertAttachment.mockResolvedValue({
			id: "attachment-internal-id",
		});
	});

	describe("Image Attachments", () => {
		it("should process image attachment with standard fields", async () => {
			// Add some delay to service mocks to make them more realistic
			mockServices.unipileAccountService.findUnipileAccountByProvider.mockImplementation(
				() => new Promise(resolve => setTimeout(() => resolve({
					id: "unipile-account-id",
					account_id: "account-123",
					user_id: "user-123",
				}), 10))
			);
			
			mockServices.unipileChatService.findChatByExternalId.mockImplementation(
				() => new Promise(resolve => setTimeout(() => resolve({
					id: "chat-internal-id",
				}), 5))
			);
			
			mockServices.unipileMessageService.upsertMessage.mockImplementation(
				() => new Promise(resolve => setTimeout(() => resolve({
					id: "message-internal-id",
				}), 5))
			);

			const eventData = createTestEvent({
				message: "Check out this image!",
				attachments: [
					{
						id: "att-123",
						type: "img",
						url: "https://example.com/image.jpg",
						filename: "photo.jpg",
						file_size: 1024000,
						mime_type: "image/jpeg",
						unavailable: false,
					},
				],
			});

			const startTime = Date.now();
			const result = await _handleMessageReceived({
				event: { data: eventData },
				step: mockStep,
				services: mockServices,
			} as any);
			const duration = Date.now() - startTime;

			// Ensure the test actually took some time (indicating real async work)
			expect(duration).toBeGreaterThan(10);

			// Verify the function calls were made in the right order
			expect(mockServices.unipileAccountService.findUnipileAccountByProvider).toHaveBeenCalledWith(
				"account-123",
				"linkedin",
				{ include_user: true }
			);

			expect(mockServices.unipileMessageService.upsertMessage).toHaveBeenCalled();

			expect(mockServices.unipileMessageService.upsertAttachment).toHaveBeenCalledWith(
				"message-internal-id",
				"att-123",
				{
					url: "https://example.com/image.jpg",
					filename: "photo.jpg",
					file_size: 1024000,
					mime_type: "image/jpeg",
					unavailable: false,
					width: undefined,
					height: undefined,
					duration: undefined,
					sticker: false,
					gif: false,
					voice_note: false,
					starts_at: undefined,
					expires_at: undefined,
					url_expires_at: undefined,
					time_range: undefined,
				},
				{
					attachment_type: "img",
				}
			);

			// Verify return value structure
			expect(result).toHaveProperty('message');
			expect(result).toHaveProperty('chat');
			expect(result).toHaveProperty('account');
		});

		it("should process image attachment with alternative field names", async () => {
			const eventData = createTestEvent({
				message: "Check out this image!",
				attachments: [
					{
						// Test alternative field names that might come from webhooks
						id: "att-456", // Use standard id field
						type: "img", // Use standard type field  
						url: "https://cdn.linkedin.com/image456.png", // Standard url field
						name: "linkedin-image.png", // Using 'name' instead of 'filename'
						size: 2048000, // Using 'size' instead of 'file_size'
						mime_type: "image/png", // Standard mime_type
					},
				],
			});

			await _handleMessageReceived({
				event: { data: eventData },
				step: mockStep,
				services: mockServices,
			} as any);

			expect(mockServices.unipileMessageService.upsertAttachment).toHaveBeenCalledWith(
				"message-internal-id",
				"att-456",
				{
					url: "https://cdn.linkedin.com/image456.png",
					filename: "linkedin-image.png", // Should map from 'name'
					file_size: 2048000, // Should map from 'size'
					mime_type: "image/png",
					unavailable: false,
					width: undefined,
					height: undefined,
					duration: undefined,
					sticker: false,
					gif: false,
					voice_note: false,
					starts_at: undefined,
					expires_at: undefined,
					url_expires_at: undefined,
					time_range: undefined,
				},
				{
					attachment_type: "img",
				}
			);
		});
	});

	describe("LinkedIn Post Attachments", () => {
		it("should process linkedin_post attachment", async () => {
			const eventData = createTestEvent({
				message: "Shared a post",
				attachments: [
					{
						id: "post-123",
						type: "linkedin_post",
						url: "https://www.linkedin.com/feed/update/activity-123456789",
						name: "LinkedIn Post Share",
						unavailable: false,
					},
				],
			});

			await _handleMessageReceived({
				event: { data: eventData },
				step: mockStep,
				services: mockServices,
			} as any);

			expect(mockServices.unipileMessageService.upsertAttachment).toHaveBeenCalledWith(
				"message-internal-id",
				"post-123",
				{
					url: "https://www.linkedin.com/feed/update/activity-123456789",
					filename: "LinkedIn Post Share",
					file_size: undefined,
					mime_type: undefined,
					unavailable: false,
					width: undefined,
					height: undefined,
					duration: undefined,
					sticker: false,
					gif: false,
					voice_note: false,
					starts_at: undefined,
					expires_at: undefined,
					url_expires_at: undefined,
					time_range: undefined,
				},
				{
					attachment_type: "linkedin_post",
				}
			);
		});
	});

	describe("File Attachments", () => {
		it("should process file attachment", async () => {
			const eventData = createTestEvent({
				message: "Here's the document",
				attachments: [
					{
						id: "file-123",
						type: "file",
						url: "https://files.example.com/document.pdf",
						filename: "report.pdf",
						file_size: 5120000,
						mime_type: "application/pdf",
					},
				],
			});

			await _handleMessageReceived({
				event: { data: eventData },
				step: mockStep,
				services: mockServices,
			} as any);

			expect(mockServices.unipileMessageService.upsertAttachment).toHaveBeenCalledWith(
				"message-internal-id",
				"file-123",
				{
					url: "https://files.example.com/document.pdf",
					filename: "report.pdf",
					file_size: 5120000,
					mime_type: "application/pdf",
					unavailable: false,
					width: undefined,
					height: undefined,
					duration: undefined,
					sticker: false,
					gif: false,
					voice_note: false,
					starts_at: undefined,
					expires_at: undefined,
					url_expires_at: undefined,
					time_range: undefined,
				},
				{
					attachment_type: "file",
				}
			);
		});
	});

	describe("Edge Cases", () => {
		it("should handle attachment with no ID by generating one", async () => {
			const eventData = createTestEvent({
				message: "Attachment without ID",
				attachments: [
					{
						// No ID field
						type: "img",
						url: "https://example.com/no-id-image.jpg",
						name: "untitled.jpg",
					},
				],
			});

			await _handleMessageReceived({
				event: { data: eventData },
				step: mockStep,
				services: mockServices,
			} as any);

			expect(mockServices.unipileMessageService.upsertAttachment).toHaveBeenCalledWith(
				"message-internal-id",
				"message-internal-id_0", // Generated ID
				expect.objectContaining({
					url: "https://example.com/no-id-image.jpg",
					filename: "untitled.jpg",
				}),
				{
					attachment_type: "img",
				}
			);
		});

		it("should handle unavailable attachment", async () => {
			const eventData = createTestEvent({
				message: "Unavailable attachment",
				attachments: [
					{
						id: "unavailable-123",
						type: "file",
						unavailable: true,
						filename: "expired-file.pdf",
					},
				],
			});

			await _handleMessageReceived({
				event: { data: eventData },
				step: mockStep,
				services: mockServices,
			} as any);

			expect(mockServices.unipileMessageService.upsertAttachment).toHaveBeenCalledWith(
				"message-internal-id",
				"unavailable-123",
				expect.objectContaining({
					unavailable: true,
					filename: "expired-file.pdf",
				}),
				{
					attachment_type: "file",
				}
			);
		});

		it("should default to file type when type is missing", async () => {
			const eventData = createTestEvent({
				message: "Attachment without type",
				attachments: [
					{
						id: "no-type-123",
						url: "https://example.com/unknown-file",
						filename: "unknown.dat",
					},
				],
			});

			await _handleMessageReceived({
				event: { data: eventData },
				step: mockStep,
				services: mockServices,
			} as any);

			expect(mockServices.unipileMessageService.upsertAttachment).toHaveBeenCalledWith(
				"message-internal-id",
				"no-type-123",
				expect.objectContaining({
					url: "https://example.com/unknown-file",
					filename: "unknown.dat",
				}),
				{
					attachment_type: "file", // Default type
				}
			);
		});

		it("should handle message with multiple attachments", async () => {
			const eventData = createTestEvent({
				message: "Multiple attachments",
				attachments: [
					{
						id: "img-1",
						type: "img",
						url: "https://example.com/image1.jpg",
						filename: "photo1.jpg",
					},
					{
						id: "file-1",
						type: "file",
						url: "https://example.com/document.pdf",
						filename: "doc.pdf",
					},
					{
						id: "post-1",
						type: "linkedin_post",
						url: "https://www.linkedin.com/feed/update/123",
						name: "Shared Post",
					},
				],
			});

			await _handleMessageReceived({
				event: { data: eventData },
				step: mockStep,
				services: mockServices,
			} as any);

			expect(mockServices.unipileMessageService.upsertAttachment).toHaveBeenCalledTimes(3);
		});
	});

	describe("Message Type Inference", () => {
		it("should set message type to 'image' for image-only messages", async () => {
			const eventData = createTestEvent({
				message: "", // Empty text content
				attachments: [
					{
						id: "img-only",
						type: "img",
						url: "https://example.com/image.jpg",
						filename: "photo.jpg",
					},
				],
			});

			await _handleMessageReceived({
				event: { data: eventData },
				step: mockStep,
				services: mockServices,
			} as any);

			expect(mockServices.unipileMessageService.upsertMessage).toHaveBeenCalledWith(
				"unipile-account-id",
				"msg-123",
				expect.objectContaining({
					message_type: "image",
					content: null,
				})
			);
		});

		it("should set message type to 'attachment' for other attachment-only messages", async () => {
			const eventData = createTestEvent({
				message: "", // Empty text content
				attachments: [
					{
						id: "file-only",
						type: "file",
						url: "https://example.com/document.pdf",
						filename: "report.pdf",
					},
				],
			});

			await _handleMessageReceived({
				event: { data: eventData },
				step: mockStep,
				services: mockServices,
			} as any);

			expect(mockServices.unipileMessageService.upsertMessage).toHaveBeenCalledWith(
				"unipile-account-id",
				"msg-123",
				expect.objectContaining({
					message_type: "attachment",
					content: null,
				})
			);
		});
	});

	describe("Error Handling", () => {
		it("should continue processing other attachments if one fails", async () => {
			// Mock one attachment to fail
			mockServices.unipileMessageService.upsertAttachment
				.mockResolvedValueOnce({ id: "success-1" })
				.mockRejectedValueOnce(new Error("Database error"))
				.mockResolvedValueOnce({ id: "success-2" });

			const eventData = createTestEvent({
				message: "Test error handling",
				attachments: [
					{ id: "good-1", type: "img", url: "https://example.com/1.jpg", filename: "1.jpg" },
					{ id: "bad-1", type: "img", url: "https://example.com/2.jpg", filename: "2.jpg" },
					{ id: "good-2", type: "img", url: "https://example.com/3.jpg", filename: "3.jpg" },
				],
			});

			// Should not throw error
			await expect(_handleMessageReceived({
				event: { data: eventData },
				step: mockStep,
				services: mockServices,
			} as any)).resolves.not.toThrow();

			// Should have attempted all three attachments
			expect(mockServices.unipileMessageService.upsertAttachment).toHaveBeenCalledTimes(3);
		});
	});

	describe("Field Mapping", () => {
		it("should map alternative URL field names", async () => {
			// Test with extended webhook attachment that includes alternative field names
			const eventData = createTestEvent({
				message: "Testing URL field mapping",
				attachments: [
					{
						id: "url-test",
						type: "img",
						// No standard 'url' field, but alternative fields
						content_url: "https://content.example.com/image.jpg", 
						filename: "test.jpg",
					} as any,
				],
			});

			await _handleMessageReceived({
				event: { data: eventData },
				step: mockStep,
				services: mockServices,
			} as any);

			expect(mockServices.unipileMessageService.upsertAttachment).toHaveBeenCalledWith(
				"message-internal-id",
				"url-test",
				expect.objectContaining({
					url: "https://content.example.com/image.jpg", // Should map from content_url
					filename: "test.jpg",
				}),
				expect.any(Object)
			);
		});
	});
});