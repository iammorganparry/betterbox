import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnipileService } from "../unipile.service";
import type {
	UnipileApiPatchChatRequest,
	UnipileApiPatchChatResponse,
} from "~/types/unipile-api";

// Mock the HTTP client
vi.mock("~/lib/http", () => ({
	createUnipileClient: vi.fn(() => ({
		patch: vi.fn(),
		get: vi.fn(),
		post: vi.fn(),
		defaults: {
			baseURL: "https://mock-api.unipile.com",
		},
	})),
}));

describe("UnipileService - patchChat", () => {
	let unipileService: UnipileService;
	let mockClient: any;

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks();

		// Create service instance
		unipileService = new UnipileService({
			apiKey: "test-api-key",
			dsn: "test-dsn",
		});

		// Get the mock client
		mockClient = (unipileService as any).client;
	});

	describe("patchChat", () => {
		it("should successfully set chat read status", async () => {
			// Arrange
			const chatId = "test-chat-id";
			const accountId = "test-account-id";
			const request: UnipileApiPatchChatRequest = {
				action: "setReadStatus",
				value: true, // Required boolean value for setReadStatus
			};

			const expectedResponse: UnipileApiPatchChatResponse = {
				object: "ChatPatched",
			};

			mockClient.patch.mockResolvedValue({ data: expectedResponse });

			// Act
			const result = await unipileService.patchChat(chatId, request, accountId);

			// Assert
			expect(mockClient.patch).toHaveBeenCalledTimes(1);
			expect(mockClient.patch).toHaveBeenCalledWith(
				`/chats/${chatId}?account_id=${accountId}`,
				request,
			);
			expect(result).toEqual(expectedResponse);
		});

		it("should successfully set chat unread status", async () => {
			// Arrange
			const chatId = "test-chat-id";
			const accountId = "test-account-id";
			const request: UnipileApiPatchChatRequest = {
				action: "setReadStatus",
				value: false, // Mark as unread
			};

			const expectedResponse: UnipileApiPatchChatResponse = {
				object: "ChatPatched",
			};

			mockClient.patch.mockResolvedValue({ data: expectedResponse });

			// Act
			const result = await unipileService.patchChat(chatId, request, accountId);

			// Assert
			expect(result).toEqual(expectedResponse);
		});

		it("should handle API errors gracefully", async () => {
			// Arrange
			const chatId = "test-chat-id";
			const accountId = "test-account-id";
			const request: UnipileApiPatchChatRequest = {
				action: "setReadStatus",
				value: true,
			};

			const error = new Error("API Error: Chat not found");
			mockClient.patch.mockRejectedValue(error);

			// Act & Assert
			await expect(
				unipileService.patchChat(chatId, request, accountId),
			).rejects.toThrow("API Error: Chat not found");
		});

		it("should properly encode URL parameters", async () => {
			// Arrange
			const chatId = "test-chat-id";
			const accountId = "test account with spaces";
			const request: UnipileApiPatchChatRequest = {
				action: "setReadStatus",
				value: true,
			};

			const expectedResponse: UnipileApiPatchChatResponse = {
				object: "ChatPatched",
			};

			mockClient.patch.mockResolvedValue({ data: expectedResponse });

			// Act
			await unipileService.patchChat(chatId, request, accountId);

			// Assert
			expect(mockClient.patch).toHaveBeenCalledWith(
				`/chats/${chatId}?account_id=test+account+with+spaces`,
				request,
			);
		});
	});
});
