import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Create mock functions for all services
const mockSendMessage = vi.fn();
const mockGetMessage = vi.fn();
const mockGetMessageAttachment = vi.fn();
const mockListChats = vi.fn();
const mockListChatMessages = vi.fn();
const mockGetChat = vi.fn();
const mockPatchChat = vi.fn();
const mockHealthCheck = vi.fn();

const mockUpload = vi.fn();
const mockGenerateAttachmentKey = vi.fn();
const mockExists = vi.fn();
const mockGetSignedUrl = vi.fn();

const mockUpsertMessage = vi.fn();
const mockUpsertAttachment = vi.fn();
const mockGetMessagesByChat = vi.fn();
const mockEnsureAttachmentAvailable = vi.fn();

const mockGetChatWithDetails = vi.fn();

// Mock all services BEFORE any imports
vi.mock("~/services/unipile/unipile.service", () => ({
	createUnipileService: vi.fn(() => ({
		sendMessage: mockSendMessage,
		getMessage: mockGetMessage,
		getMessageAttachment: mockGetMessageAttachment,
		listChats: mockListChats,
		listChatMessages: mockListChatMessages,
		getChat: mockGetChat,
		patchChat: mockPatchChat,
		healthCheck: mockHealthCheck,
	})),
}));

vi.mock("~/services/r2/r2.service", () => ({
	createR2Service: vi.fn(() => ({
		upload: mockUpload,
		generateAttachmentKey: mockGenerateAttachmentKey,
		exists: mockExists,
		getSignedUrl: mockGetSignedUrl,
	})),
}));

vi.mock("~/env", () => ({
	env: {
		UNIPILE_API_KEY: "test-api-key",
		UNIPILE_DSN: "test-dsn",
		R2_ENDPOINT: "https://test-account.r2.cloudflarestorage.com",
		R2_BUCKET: "test-bucket",
		R2_ACCESS_KEY: "test-access-key",
		R2_SECRET_KEY: "test-secret-key",
	},
}));

// Import router AFTER mocks
import { inboxRouter } from "../inbox";

describe("inboxRouter - sendMessage with R2", () => {
	let mockContext: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockContext = {
			userId: "test-user-id",
			services: {
				unipileChatService: {
					getChatWithDetails: mockGetChatWithDetails,
					updateLastMessageAt: vi.fn().mockResolvedValue({}), // Add missing mock
				},
				unipileMessageService: {
					upsertMessage: mockUpsertMessage,
					upsertAttachment: mockUpsertAttachment,
					getMessagesByChat: mockGetMessagesByChat,
					ensureAttachmentAvailable: mockEnsureAttachmentAvailable,
				},
				unipileService: {
					sendMessage: mockSendMessage,
					getMessage: mockGetMessage,
				},
				r2Service: {
					upload: mockUpload,
					generateAttachmentKey: mockGenerateAttachmentKey,
				},
			},
		};
	});

	describe("sendMessage with attachments and R2 upload", () => {
		it("should upload attachments to R2 before sending to Unipile", async () => {
			// Arrange
			const input = {
				chatId: "test-chat-id",
				content: "Message with attachment",
				attachments: [
					{
						type: "image/jpeg",
						data: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
						filename: "test-image.jpg",
					},
				],
			};

			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};

			const mockUnipileResponse = {
				id: "external-msg-id",
				content: "Message with attachment",
				sent_at: "2024-01-15T10:00:00Z",
				attachments: [
					{
						id: "unipile-attachment-id",
						url: "https://unipile.example.com/attachment.jpg",
						filename: "test-image.jpg",
						mime_type: "image/jpeg",
						file_size: 12345,
					},
				],
			};

			const mockFullMessage = {
				...mockUnipileResponse,
				attachments: [
					{
						id: "unipile-attachment-id",
						url: "https://unipile.example.com/attachment.jpg",
						filename: "test-image.jpg",
						mime_type: "image/jpeg",
						file_size: 12345,
					},
				],
			};

			const mockSavedMessage = {
				id: "local-msg-id",
				external_id: "external-msg-id",
				chat_id: "test-chat-id",
				content: "Message with attachment",
			};

			// Setup mocks
			mockGetChatWithDetails.mockResolvedValue(mockChatDetails);
			
			// Mock R2 upload
			const r2Key = "attachments/temp-123/abc123.jpg";
			const r2Url = "https://test-account.r2.cloudflarestorage.com/test-bucket/attachments/temp-123/abc123.jpg";
			mockGenerateAttachmentKey.mockReturnValue(r2Key);
			mockUpload.mockResolvedValue(r2Url);

			// Mock Unipile sendMessage to return correct format
			mockSendMessage.mockResolvedValue({
				object: "MessageSent", // This is required for the test to pass
				message_id: "external-msg-id", // Correct property name
			});
			mockGetMessage.mockResolvedValue(mockFullMessage);

			// Mock database operations
			mockUpsertMessage.mockResolvedValue(mockSavedMessage);
			mockUpsertAttachment.mockResolvedValue({
				id: "local-attachment-id",
				external_id: "unipile-attachment-id",
			});

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			const result = await caller.sendMessage(input);

			// Assert - R2 upload should happen first
			expect(mockGenerateAttachmentKey).toHaveBeenCalledWith(
				expect.stringMatching(/^temp-\d+$/),
				"test-image.jpg",
				"image/jpeg"
			);

			expect(mockUpload).toHaveBeenCalledWith(
				r2Key,
				expect.any(Uint8Array), // Base64 converted to binary
				"image/jpeg",
				{
					originalFilename: "test-image.jpg",
					messageId: "pending",
				}
			);

			// Unipile send should be called with original attachment data
			expect(mockSendMessage).toHaveBeenCalledWith(
				{
					chat_id: "external-chat-id",
					text: "Message with attachment",
					attachments: [
						{
							type: "image/jpeg",
							data: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
							filename: "test-image.jpg",
						},
					],
				},
				"linkedin-account-1"
			);

			// Should fetch full message details after sending
			expect(mockGetMessage).toHaveBeenCalledWith(
				"external-msg-id",
				"linkedin-account-1"
			);

			// Database should store both Unipile and R2 data
			expect(mockUpsertAttachment).toHaveBeenCalledWith(
				"local-msg-id",
				"unipile-attachment-id",
				{
					content: undefined, // Should not store base64 when R2 URL exists
					duration: undefined,
					expires_at: undefined,
					file_size: 12345,
					filename: "test-image.jpg",
					gif: false,
					height: undefined,
					mime_type: "image/jpeg",
					r2_key: r2Key,
					r2_uploaded_at: expect.any(Date),
					r2_url: r2Url,
					starts_at: undefined,
					sticker: false,
					time_range: undefined,
					unavailable: false,
					url: "https://unipile.example.com/attachment.jpg",
					url_expires_at: undefined,
					voice_note: false,
					width: undefined,
				},
				{
					attachment_type: "img",
				}
			);

			expect(result).toEqual({
				success: true,
				message: "Message sent successfully",
				messageId: "external-msg-id",
				chatId: "test-chat-id",
				unipileResponse: {
					object: "MessageSent",
					message_id: "external-msg-id",
				},
				savedMessage: mockSavedMessage,
				localSave: "immediate",
			});
		});

		it("should handle R2 upload failure gracefully", async () => {
			// Arrange
			const input = {
				chatId: "test-chat-id",
				content: "Message with attachment",
				attachments: [
					{
						type: "image/jpeg",
						data: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
						filename: "test-image.jpg",
					},
				],
			};

			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};

			// Setup mocks
			mockGetChatWithDetails.mockResolvedValue(mockChatDetails);
			
			// Mock R2 upload to fail
			mockGenerateAttachmentKey.mockReturnValue("test-key");
			mockUpload.mockRejectedValue(new Error("R2 upload failed"));

			// Mock successful Unipile operations
			mockSendMessage.mockResolvedValue({
				object: "MessageSent", // This is required for the test to pass
				id: "external-msg-id",
				content: "Message with attachment",
			});
			mockUpsertMessage.mockResolvedValue({
				id: "local-msg-id",
				external_id: "external-msg-id",
			});

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			const result = await caller.sendMessage(input);

			// Assert - Should continue despite R2 failure
			expect(mockSendMessage).toHaveBeenCalled();
			expect(result.success).toBe(true);
		});

		it("should handle attachments without data (URL-only)", async () => {
			// Arrange
			const input = {
				chatId: "test-chat-id",
				content: "Message with URL attachment",
				attachments: [
					{
						type: "image/jpeg",
						url: "https://example.com/external-image.jpg",
						filename: "external-image.jpg",
					},
				],
			};

			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};

			// Setup mocks
			mockGetChatWithDetails.mockResolvedValue(mockChatDetails);
			mockSendMessage.mockResolvedValue({
				object: "MessageSent", // This is required for the test to pass
				id: "external-msg-id",
				content: "Message with URL attachment",
			});
			mockUpsertMessage.mockResolvedValue({
				id: "local-msg-id",
				external_id: "external-msg-id",
			});

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			const result = await caller.sendMessage(input);

			// Assert - R2 upload should not be attempted for URL-only attachments
			expect(mockGenerateAttachmentKey).not.toHaveBeenCalled();
			expect(mockUpload).not.toHaveBeenCalled();
			expect(mockSendMessage).toHaveBeenCalledWith(
				{
					chat_id: "external-chat-id",
					text: "Message with URL attachment",
					attachments: [
						{
							type: "image/jpeg",
							url: "https://example.com/external-image.jpg",
							filename: "external-image.jpg",
						},
					],
				},
				"linkedin-account-1"
			);
		});
	});
});

describe("inboxRouter - getChatMessages with R2", () => {
	let mockContext: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockContext = {
			userId: "test-user-id",
			services: {
				unipileChatService: {
					getChatWithDetails: mockGetChatWithDetails,
				},
				unipileMessageService: {
					getMessagesByChat: mockGetMessagesByChat,
					ensureAttachmentAvailable: mockEnsureAttachmentAvailable,
				},
				unipileService: {},
				r2Service: {},
			},
		};
	});

	describe("getChatMessages with attachment validation", () => {
		it("should validate attachments and prioritize R2 URLs", async () => {
			// Arrange
			const input = { chatId: "test-chat-id" };

			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};

			const mockMessages = [
				{
					id: "msg-1",
					content: "Message with R2 attachment",
					unipileMessageAttachments: [
						{
							id: "attachment-1",
							r2_url: null, // No R2 URL initially
							url: "https://unipile.example.com/old-url.jpg",
							filename: "test.jpg",
							mime_type: "image/jpeg",
						},
					],
				},
				{
					id: "msg-2",
					content: "Message with valid R2 attachment",
					unipileMessageAttachments: [
						{
							id: "attachment-2",
							r2_url: "https://r2.example.com/test.jpg",
							url: "https://unipile.example.com/old-url2.jpg",
							filename: "test2.jpg",
							mime_type: "image/jpeg",
						},
					],
				},
			];

			// Setup mocks
			mockGetChatWithDetails.mockResolvedValue(mockChatDetails);
			mockGetMessagesByChat.mockResolvedValue(mockMessages);

			// Mock ensureAttachmentAvailable to return R2 URL based on actual processing order
			mockEnsureAttachmentAvailable
				.mockResolvedValueOnce({
					id: "attachment-1",
					r2_url: "https://r2.example.com/validated.jpg", // First call returns validated.jpg (actual result[0])
					url: "https://unipile.example.com/old-url.jpg",
					filename: "test.jpg",
					mime_type: "image/jpeg",
				})
				.mockResolvedValueOnce({
					id: "attachment-2",
					r2_url: "https://r2.example.com/test.jpg", // Second call returns test.jpg (actual result[1])
					url: "https://unipile.example.com/old-url2.jpg",
					filename: "test2.jpg",
					mime_type: "image/jpeg",
				});

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			const result = await caller.getChatMessages(input);

			// Assert
			expect(mockEnsureAttachmentAvailable).toHaveBeenCalledTimes(2);
			
			// First attachment should be validated
			expect(mockEnsureAttachmentAvailable).toHaveBeenNthCalledWith(
				1,
				mockMessages[0].unipileMessageAttachments[0],
				"linkedin-account-1",
				mockContext.services.unipileService,
				mockContext.services.r2Service
			);

			// Second attachment should also be validated
			expect(mockEnsureAttachmentAvailable).toHaveBeenNthCalledWith(
				2,
				mockMessages[1].unipileMessageAttachments[0],
				"linkedin-account-1",
				mockContext.services.unipileService,
				mockContext.services.r2Service
			);

			// Result should contain validated attachments
			expect(result[0].unipileMessageAttachments[0].r2_url).toBe(
				"https://r2.example.com/test.jpg"
			);
			expect(result[1].unipileMessageAttachments[0].r2_url).toBe(
				"https://r2.example.com/validated.jpg"
			);
		});

		it("should handle attachment validation failures gracefully", async () => {
			// Arrange
			const input = { chatId: "test-chat-id" };

			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};

			const mockMessages = [
				{
					id: "msg-1",
					content: "Message with problematic attachment",
					unipileMessageAttachments: [
						{
							id: "attachment-1",
							r2_url: null,
							url: null,
							filename: "missing.jpg",
							mime_type: "image/jpeg",
						},
					],
				},
			];

			// Setup mocks
			mockGetChatWithDetails.mockResolvedValue(mockChatDetails);
			mockGetMessagesByChat.mockResolvedValue(mockMessages);

			// Mock ensureAttachmentAvailable to fail
			mockEnsureAttachmentAvailable.mockRejectedValue(
				new Error("Attachment validation failed")
			);

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			const result = await caller.getChatMessages(input);

			// Assert - Should return original attachment when validation fails
			expect(result[0].unipileMessageAttachments[0]).toEqual(
				mockMessages[0].unipileMessageAttachments[0]
			);
		});

		it("should skip validation for messages without attachments", async () => {
			// Arrange
			const input = { chatId: "test-chat-id" };

			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};

			const mockMessages = [
				{
					id: "msg-1",
					content: "Simple text message",
					unipileMessageAttachments: [], // No attachments
				},
				{
					id: "msg-2",
					content: "Another text message",
					// No unipileMessageAttachments property
				},
			];

			// Setup mocks
			mockGetChatWithDetails.mockResolvedValue(mockChatDetails);
			mockGetMessagesByChat.mockResolvedValue(mockMessages);

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			const result = await caller.getChatMessages(input);

			// Assert - No attachment validation should occur
			expect(mockEnsureAttachmentAvailable).not.toHaveBeenCalled();
			expect(result).toEqual(mockMessages.reverse()); // Messages are reversed in response
		});

		it("should log URL source for each attachment", async () => {
			// Arrange
			const input = { chatId: "test-chat-id" };

			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};

			const mockMessages = [
				{
					id: "msg-1",
					content: "Message with mixed attachment sources",
					unipileMessageAttachments: [
						{
							id: "attachment-r2",
							r2_url: "https://r2.example.com/test.jpg",
							url: null,
							content: null,
						},
						{
							id: "attachment-unipile",
							r2_url: null,
							url: "https://unipile.example.com/test2.jpg",
							content: null,
						},
						{
							id: "attachment-base64",
							r2_url: null,
							url: null,
							content: "base64content",
						},
						{
							id: "attachment-none",
							r2_url: null,
							url: null,
							content: null,
						},
					],
				},
			];

			// Setup mocks
			mockGetChatWithDetails.mockResolvedValue(mockChatDetails);
			mockGetMessagesByChat.mockResolvedValue(mockMessages);

			// Mock ensureAttachmentAvailable to return attachments as-is
			mockEnsureAttachmentAvailable
				.mockImplementation((attachment) => Promise.resolve(attachment));

			// Spy on console.log
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			await caller.getChatMessages(input);

			// Assert - Should log the URL source for each attachment
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("📎 Attachment attachment-r2 using R2 source")
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("📎 Attachment attachment-unipile using Unipile source")
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("📎 Attachment attachment-base64 using Base64 source")
			);
			// attachment-none should not be logged (urlSource is 'None')

			consoleSpy.mockRestore();
		});
	});
});
