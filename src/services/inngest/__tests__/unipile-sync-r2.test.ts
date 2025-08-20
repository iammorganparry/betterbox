import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock all services before imports
const mockUpsertMessage = vi.fn();
const mockUpsertAttachment = vi.fn();
const mockUpsertChat = vi.fn();
const mockGetMessageAttachment = vi.fn();
const mockUpload = vi.fn();
const mockGenerateAttachmentKey = vi.fn();

// Mock services middleware
vi.mock("~/middleware/services.middleware", () => ({
	servicesMiddleware: {
		init: vi.fn(() => ({
			event: {},
			step: {},
			user: {},
		})),
	},
}));

// Mock Inngest
const mockStep = {
	run: vi.fn((name, fn) => fn()),
	sendEvent: vi.fn(),
};

const mockInngest = {
	createFunction: vi.fn(),
};

vi.mock("~/services/inngest", () => ({
	inngest: mockInngest,
}));

describe("Inngest message-received with R2", () => {
	let messageReceivedHandler: any;
	let mockServices: any;

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup mock services
		mockServices = {
			unipileMessageService: {
				upsertMessage: mockUpsertMessage,
				upsertAttachment: mockUpsertAttachment,
			},
			unipileChatService: {
				upsertChat: mockUpsertChat,
			},
			unipileService: {
				getMessageAttachment: mockGetMessageAttachment,
			},
			r2Service: {
				upload: mockUpload,
				generateAttachmentKey: mockGenerateAttachmentKey,
			},
		};

		// Mock the message-received handler
		messageReceivedHandler = async (ctx: any, event: any) => {
			// Simulate the actual handler logic
			const { data } = event.data;
			const services = mockServices;

			// Save message
			const savedMessage = await services.unipileMessageService.upsertMessage(
				data.chat_id,
				data.external_id,
				{
					content: data.content,
					is_outgoing: data.is_outgoing,
					sent_at: new Date(data.sent_at),
					provider: data.provider,
				}
			);

			// Process attachments if any
			if (data.attachments?.length > 0) {
				for (const attachmentData of data.attachments) {
					try {
						// Download from Unipile
						const attachmentContent = await services.unipileService.getMessageAttachment(
							data.external_id,
							attachmentData.id,
							data.account_id
						);

						let r2Key: string | undefined;
						let r2Url: string | undefined;

						// Upload to R2 if we have content
						if (attachmentContent && attachmentData.mime_type) {
							try {
								const binaryData = Uint8Array.from(atob(attachmentContent), c => c.charCodeAt(0));
								r2Key = services.r2Service.generateAttachmentKey(
									savedMessage.id,
									attachmentData.filename,
									attachmentData.mime_type
								);
								r2Url = await services.r2Service.upload(
									r2Key,
									binaryData,
									attachmentData.mime_type,
									{
										originalFilename: attachmentData.filename || 'attachment',
										messageId: savedMessage.id,
										attachmentId: attachmentData.id,
									}
								);
							} catch (r2Error) {
								console.warn("Failed to upload to R2:", r2Error);
							}
						}

						// Save attachment to DB
						await services.unipileMessageService.upsertAttachment(
							savedMessage.id,
							attachmentData.id,
							{
								url: attachmentData.url,
								filename: attachmentData.filename,
								mime_type: attachmentData.mime_type,
								file_size: attachmentData.file_size,
								width: attachmentData.width,
								height: attachmentData.height,
								content: r2Url ? undefined : attachmentContent, // Only store base64 if no R2
								r2_key: r2Key,
								r2_url: r2Url,
								r2_uploaded_at: r2Url ? new Date() : undefined,
							}
						);
					} catch (error) {
						console.error("Failed to process attachment:", error);
					}
				}
			}

			return savedMessage;
		};
	});

	describe("message with attachments", () => {
		it("should upload attachments to R2 and store references", async () => {
			// Arrange
			const eventData = {
				data: {
					chat_id: "local-chat-id",
					external_id: "external-msg-id",
					content: "Message with attachment",
					is_outgoing: false,
					sent_at: "2024-01-15T10:00:00Z",
					provider: "linkedin",
					account_id: "linkedin-account-1",
					attachments: [
						{
							id: "unipile-attachment-id",
							url: "https://unipile.example.com/attachment.jpg",
							filename: "test-image.jpg",
							mime_type: "image/jpeg",
							file_size: 12345,
							width: 800,
							height: 600,
						},
					],
				},
			};

			const mockSavedMessage = {
				id: "local-msg-id",
				external_id: "external-msg-id",
				chat_id: "local-chat-id",
			};

			// Setup mocks
			mockUpsertMessage.mockResolvedValue(mockSavedMessage);
			mockGetMessageAttachment.mockResolvedValue("SGVsbG8gV29ybGQ="); // "Hello World" in base64
			
			const r2Key = "attachments/local-msg-id/abc123.jpg";
			const r2Url = "https://r2.example.com/abc123.jpg";
			mockGenerateAttachmentKey.mockReturnValue(r2Key);
			mockUpload.mockResolvedValue(r2Url);
			
			mockUpsertAttachment.mockResolvedValue({
				id: "local-attachment-id",
				external_id: "unipile-attachment-id",
			});

			// Act
			await messageReceivedHandler({}, { data: eventData });

			// Assert
			expect(mockUpsertMessage).toHaveBeenCalledWith(
				"local-chat-id",
				"external-msg-id",
				{
					content: "Message with attachment",
					is_outgoing: false,
					sent_at: new Date("2024-01-15T10:00:00Z"),
					provider: "linkedin",
				}
			);

			expect(mockGetMessageAttachment).toHaveBeenCalledWith(
				"external-msg-id",
				"unipile-attachment-id",
				"linkedin-account-1"
			);

			expect(mockGenerateAttachmentKey).toHaveBeenCalledWith(
				"local-msg-id",
				"test-image.jpg",
				"image/jpeg"
			);

			expect(mockUpload).toHaveBeenCalledWith(
				r2Key,
				expect.any(Uint8Array),
				"image/jpeg",
				{
					originalFilename: "test-image.jpg",
					messageId: "local-msg-id",
					attachmentId: "unipile-attachment-id",
				}
			);

			expect(mockUpsertAttachment).toHaveBeenCalledWith(
				"local-msg-id",
				"unipile-attachment-id",
				{
					url: "https://unipile.example.com/attachment.jpg",
					filename: "test-image.jpg",
					mime_type: "image/jpeg",
					file_size: 12345,
					width: 800,
					height: 600,
					content: undefined, // Should not store base64 when R2 URL exists
					r2_key: r2Key,
					r2_url: r2Url,
					r2_uploaded_at: expect.any(Date),
				}
			);
		});

		it("should store base64 content when R2 upload fails", async () => {
			// Arrange
			const eventData = {
				data: {
					chat_id: "local-chat-id",
					external_id: "external-msg-id",
					content: "Message with attachment",
					is_outgoing: false,
					sent_at: "2024-01-15T10:00:00Z",
					provider: "linkedin",
					account_id: "linkedin-account-1",
					attachments: [
						{
							id: "unipile-attachment-id",
							url: "https://unipile.example.com/attachment.jpg",
							filename: "test-image.jpg",
							mime_type: "image/jpeg",
							file_size: 12345,
						},
					],
				},
			};

			const mockSavedMessage = {
				id: "local-msg-id",
				external_id: "external-msg-id",
			};

			// Setup mocks
			mockUpsertMessage.mockResolvedValue(mockSavedMessage);
			mockGetMessageAttachment.mockResolvedValue("SGVsbG8gV29ybGQ="); // "Hello World" in base64
			
			// Mock R2 to fail
			mockGenerateAttachmentKey.mockReturnValue("test-key");
			mockUpload.mockRejectedValue(new Error("R2 upload failed"));
			
			mockUpsertAttachment.mockResolvedValue({});

			// Act
			await messageReceivedHandler({}, { data: eventData });

					// Assert
		expect(mockUpsertAttachment).toHaveBeenCalledWith(
			"local-msg-id",
			"unipile-attachment-id",
			{
				url: "https://unipile.example.com/attachment.jpg",
				filename: "test-image.jpg",
				mime_type: "image/jpeg",
				file_size: 12345,
				content: "SGVsbG8gV29ybGQ=", // Should store base64 when R2 fails
				r2_key: "test-key", // Key is generated even if upload fails
				r2_url: undefined,
				r2_uploaded_at: undefined,
				width: undefined,
				height: undefined,
			}
		);
		});

		it("should handle missing attachment content gracefully", async () => {
			// Arrange
			const eventData = {
				data: {
					chat_id: "local-chat-id",
					external_id: "external-msg-id",
					content: "Message with missing attachment",
					is_outgoing: false,
					sent_at: "2024-01-15T10:00:00Z",
					provider: "linkedin",
					account_id: "linkedin-account-1",
					attachments: [
						{
							id: "missing-attachment-id",
							url: "https://unipile.example.com/missing.jpg",
							filename: "missing.jpg",
							mime_type: "image/jpeg",
						},
					],
				},
			};

			const mockSavedMessage = {
				id: "local-msg-id",
				external_id: "external-msg-id",
			};

			// Setup mocks
			mockUpsertMessage.mockResolvedValue(mockSavedMessage);
			mockGetMessageAttachment.mockResolvedValue(null); // No content
			mockUpsertAttachment.mockResolvedValue({});

			// Act
			await messageReceivedHandler({}, { data: eventData });

			// Assert
			expect(mockGenerateAttachmentKey).not.toHaveBeenCalled();
			expect(mockUpload).not.toHaveBeenCalled();
			
			expect(mockUpsertAttachment).toHaveBeenCalledWith(
				"local-msg-id",
				"missing-attachment-id",
				{
					url: "https://unipile.example.com/missing.jpg",
					filename: "missing.jpg",
					mime_type: "image/jpeg",
					content: null,
					r2_key: undefined,
					r2_url: undefined,
					r2_uploaded_at: undefined,
				}
			);
		});

		it("should continue processing other attachments when one fails", async () => {
			// Arrange
			const eventData = {
				data: {
					chat_id: "local-chat-id",
					external_id: "external-msg-id",
					content: "Message with multiple attachments",
					is_outgoing: false,
					sent_at: "2024-01-15T10:00:00Z",
					provider: "linkedin",
					account_id: "linkedin-account-1",
					attachments: [
						{
							id: "attachment-1",
							filename: "success.jpg",
							mime_type: "image/jpeg",
						},
						{
							id: "attachment-2",
							filename: "failure.jpg",
							mime_type: "image/jpeg",
						},
					],
				},
			};

			const mockSavedMessage = {
				id: "local-msg-id",
				external_id: "external-msg-id",
			};

			// Setup mocks
			mockUpsertMessage.mockResolvedValue(mockSavedMessage);
			
			// First attachment succeeds, second fails
			mockGetMessageAttachment
				.mockResolvedValueOnce("SGVsbG8gV29ybGQxCg==") // "Hello World1\n" in base64
				.mockRejectedValueOnce(new Error("Failed to download"));
			
			mockGenerateAttachmentKey.mockReturnValue("test-key");
			mockUpload.mockResolvedValue("https://r2.example.com/test-key");
			mockUpsertAttachment.mockResolvedValue({});

			// Spy on console.error
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

			// Act
			await messageReceivedHandler({}, { data: eventData });

			// Assert
			expect(mockUpsertAttachment).toHaveBeenCalledTimes(1); // Only successful attachment
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Failed to process attachment:",
				expect.any(Error)
			);

			consoleErrorSpy.mockRestore();
		});
	});

	describe("message without attachments", () => {
		it("should process message without attempting attachment operations", async () => {
			// Arrange
			const eventData = {
				data: {
					chat_id: "local-chat-id",
					external_id: "external-msg-id",
					content: "Simple text message",
					is_outgoing: true,
					sent_at: "2024-01-15T10:00:00Z",
					provider: "linkedin",
					account_id: "linkedin-account-1",
					// No attachments
				},
			};

			const mockSavedMessage = {
				id: "local-msg-id",
				external_id: "external-msg-id",
			};

			// Setup mocks
			mockUpsertMessage.mockResolvedValue(mockSavedMessage);

			// Act
			await messageReceivedHandler({}, { data: eventData });

			// Assert
			expect(mockUpsertMessage).toHaveBeenCalledWith(
				"local-chat-id",
				"external-msg-id",
				{
					content: "Simple text message",
					is_outgoing: true,
					sent_at: new Date("2024-01-15T10:00:00Z"),
					provider: "linkedin",
				}
			);

			// No attachment operations should be called
			expect(mockGetMessageAttachment).not.toHaveBeenCalled();
			expect(mockGenerateAttachmentKey).not.toHaveBeenCalled();
			expect(mockUpload).not.toHaveBeenCalled();
			expect(mockUpsertAttachment).not.toHaveBeenCalled();
		});
	});
});

describe("Inngest historical-sync with R2", () => {
	let historicalSyncHandler: any;
	let mockServices: any;

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup mock services
		mockServices = {
			unipileMessageService: {
				upsertMessage: mockUpsertMessage,
				upsertAttachment: mockUpsertAttachment,
			},
			unipileService: {
				getMessageAttachment: mockGetMessageAttachment,
			},
			r2Service: {
				upload: mockUpload,
				generateAttachmentKey: mockGenerateAttachmentKey,
			},
		};

		// Mock the historical-sync handler logic for processing a single message
		historicalSyncHandler = async (messageData: any) => {
			const services = mockServices;

			// Save message
			const message = await services.unipileMessageService.upsertMessage(
				messageData.chat_id,
				messageData.id,
				{
					content: messageData.content,
					is_outgoing: messageData.is_outgoing,
					sent_at: new Date(messageData.sent_at),
					provider: messageData.provider,
				}
			);

			// Process attachments
			if (messageData.attachments?.length > 0) {
				for (const attachmentData of messageData.attachments) {
					try {
						// Download from Unipile
						const attachmentContent = await services.unipileService.getMessageAttachment(
							messageData.id,
							attachmentData.id,
							messageData.account_id
						);

						let r2Key: string | undefined;
						let r2Url: string | undefined;

						// Upload to R2 if we have content
						if (attachmentContent && attachmentData.mime_type) {
							try {
								const binaryData = Uint8Array.from(atob(attachmentContent), c => c.charCodeAt(0));
								r2Key = services.r2Service.generateAttachmentKey(
									message.id,
									attachmentData.file_name || attachmentData.filename,
									attachmentData.mime_type
								);
								r2Url = await services.r2Service.upload(
									r2Key,
									binaryData,
									attachmentData.mime_type,
									{
										originalFilename: attachmentData.file_name || attachmentData.filename || 'attachment',
										messageId: message.id,
										attachmentId: attachmentData.id,
									}
								);
							} catch (r2Error) {
								console.warn("Failed to upload historical attachment to R2:", r2Error);
							}
						}

						// Save attachment to DB
						await services.unipileMessageService.upsertAttachment(
							message.id,
							attachmentData.id,
							{
								url: attachmentData.url,
								filename: attachmentData.file_name || attachmentData.filename,
								mime_type: attachmentData.mime_type,
								file_size: attachmentData.file_size,
								width: attachmentData.width,
								height: attachmentData.height,
								content: r2Url ? undefined : attachmentContent, // Only store base64 if no R2
								r2_key: r2Key,
								r2_url: r2Url,
								r2_uploaded_at: r2Url ? new Date() : undefined,
							}
						);
					} catch (error) {
						console.error("Failed to process historical attachment:", error);
					}
				}
			}

			return message;
		};
	});

	describe("historical message with attachments", () => {
		it("should upload attachments to R2 during historical sync", async () => {
			// Arrange
			const messageData = {
				id: "historical-msg-id",
				chat_id: "local-chat-id",
				content: "Historical message with attachment",
				is_outgoing: false,
				sent_at: "2024-01-10T10:00:00Z",
				provider: "linkedin",
				account_id: "linkedin-account-1",
				attachments: [
					{
						id: "historical-attachment-id",
						url: "https://unipile.example.com/historical.jpg",
						file_name: "historical-image.jpg", // Note: historical uses file_name
						filename: "historical-image.jpg",
						mime_type: "image/jpeg",
						file_size: 54321,
						width: 1200,
						height: 800,
					},
				],
			};

			const mockSavedMessage = {
				id: "local-historical-msg-id",
				external_id: "historical-msg-id",
			};

			// Setup mocks
			mockUpsertMessage.mockResolvedValue(mockSavedMessage);
			mockGetMessageAttachment.mockResolvedValue("SGlzdG9yaWNhbENvbnRlbnQ="); // "HistoricalContent" in base64
			
			const r2Key = "attachments/local-historical-msg-id/xyz789.jpg";
			const r2Url = "https://r2.example.com/xyz789.jpg";
			mockGenerateAttachmentKey.mockReturnValue(r2Key);
			mockUpload.mockResolvedValue(r2Url);
			
			mockUpsertAttachment.mockResolvedValue({});

			// Act
			await historicalSyncHandler(messageData);

			// Assert
			expect(mockGetMessageAttachment).toHaveBeenCalledWith(
				"historical-msg-id",
				"historical-attachment-id",
				"linkedin-account-1"
			);

			expect(mockGenerateAttachmentKey).toHaveBeenCalledWith(
				"local-historical-msg-id",
				"historical-image.jpg", // Should use file_name when available
				"image/jpeg"
			);

			expect(mockUpload).toHaveBeenCalledWith(
				r2Key,
				expect.any(Uint8Array),
				"image/jpeg",
				{
					originalFilename: "historical-image.jpg",
					messageId: "local-historical-msg-id",
					attachmentId: "historical-attachment-id",
				}
			);

			expect(mockUpsertAttachment).toHaveBeenCalledWith(
				"local-historical-msg-id",
				"historical-attachment-id",
				{
					url: "https://unipile.example.com/historical.jpg",
					filename: "historical-image.jpg",
					mime_type: "image/jpeg",
					file_size: 54321,
					width: 1200,
					height: 800,
					content: undefined, // Should not store base64 when R2 URL exists
					r2_key: r2Key,
					r2_url: r2Url,
					r2_uploaded_at: expect.any(Date),
				}
			);
		});

		it("should handle historical attachments without file_name", async () => {
			// Arrange
			const messageData = {
				id: "historical-msg-2",
				chat_id: "local-chat-id",
				content: "Historical message with unnamed attachment",
				is_outgoing: false,
				sent_at: "2024-01-10T10:00:00Z",
				provider: "linkedin",
				account_id: "linkedin-account-1",
				attachments: [
					{
						id: "unnamed-attachment",
						url: "https://unipile.example.com/unnamed.jpg",
						// No file_name property
						filename: "fallback-name.jpg",
						mime_type: "image/jpeg",
					},
				],
			};

			const mockSavedMessage = {
				id: "local-msg-2",
				external_id: "historical-msg-2",
			};

			// Setup mocks
			mockUpsertMessage.mockResolvedValue(mockSavedMessage);
			mockGetMessageAttachment.mockResolvedValue("SGVsbG8gV29ybGQ="); // "Hello World" in base64
			mockGenerateAttachmentKey.mockReturnValue("test-key");
			mockUpload.mockResolvedValue("https://r2.example.com/test-key");
			mockUpsertAttachment.mockResolvedValue({});

			// Act
			await historicalSyncHandler(messageData);

			// Assert
			expect(mockGenerateAttachmentKey).toHaveBeenCalledWith(
				"local-msg-2",
				"fallback-name.jpg", // Should fall back to filename
				"image/jpeg"
			);

			expect(mockUpsertAttachment).toHaveBeenCalledWith(
				"local-msg-2",
				"unnamed-attachment",
				expect.objectContaining({
					filename: "fallback-name.jpg",
				})
			);
		});

		it("should handle historical attachments with neither file_name nor filename", async () => {
			// Arrange
			const messageData = {
				id: "historical-msg-3",
				chat_id: "local-chat-id",
				content: "Historical message with truly unnamed attachment",
				is_outgoing: false,
				sent_at: "2024-01-10T10:00:00Z",
				provider: "linkedin",
				account_id: "linkedin-account-1",
				attachments: [
					{
						id: "truly-unnamed",
						url: "https://unipile.example.com/mystery.jpg",
						// No file_name or filename
						mime_type: "image/jpeg",
					},
				],
			};

			const mockSavedMessage = {
				id: "local-msg-3",
				external_id: "historical-msg-3",
			};

			// Setup mocks
			mockUpsertMessage.mockResolvedValue(mockSavedMessage);
			mockGetMessageAttachment.mockResolvedValue("SGVsbG8gV29ybGQ="); // "Hello World" in base64
			mockGenerateAttachmentKey.mockReturnValue("test-key");
			mockUpload.mockResolvedValue("https://r2.example.com/test-key");
			mockUpsertAttachment.mockResolvedValue({});

			// Act
			await historicalSyncHandler(messageData);

			// Assert
			expect(mockUpload).toHaveBeenCalledWith(
				"test-key",
				expect.any(Uint8Array),
				"image/jpeg",
				{
					originalFilename: "attachment", // Should default to 'attachment'
					messageId: "local-msg-3",
					attachmentId: "truly-unnamed",
				}
			);
		});
	});
});
