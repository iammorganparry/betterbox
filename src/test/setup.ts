import "@testing-library/jest-dom";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { server } from "~/mocks/server"; // Import MSW server

vi.stubEnv("USE_MOCK_UNIPILE", "1"); // Set env var for tests
export { server }; // Export server for test files to control

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: vi.fn(),
		replace: vi.fn(),
		back: vi.fn(),
		forward: vi.fn(),
		refresh: vi.fn(),
		prefetch: vi.fn(),
	}),
	useParams: () => ({
		chatId: "test-chat-id",
	}),
	usePathname: () => "/test-path",
	useSearchParams: () => new URLSearchParams(),
}));

// Mock tRPC
vi.mock("~/trpc/react", () => ({
	api: {
		inbox: {
			getChats: {
				useQuery: vi.fn(),
			},
			getChatDetails: {
				useQuery: vi.fn(),
			},
			getChatMessages: {
				useQuery: vi.fn(),
			},
			sendMessage: {
				useMutation: vi.fn(),
			},
			deleteMessage: {
				useMutation: vi.fn(),
			},
			markChatAsRead: {
				useMutation: vi.fn(),
			},
		},
	},
}));

// Mock Sonner toast
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

// Mock environment variables
vi.mock("~/env", () => ({
	env: {
		UNIPILE_API_KEY: "test-api-key",
		UNIPILE_DSN: "test-dsn",
	},
}));

import { type DeepMockProxy, mockDeep, mockReset } from "vitest-mock-extended";
import type { db } from "~/db";

const drizzleMock: DeepMockProxy<typeof db> = mockDeep();

vi.mock("~/db", (req) => {
	const actual = req();
	return {
		__esModule: true,
		...actual,
		db: drizzleMock,
	};
});

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
	mockReset(drizzleMock);
});

export default drizzleMock;
