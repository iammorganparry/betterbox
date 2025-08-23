import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Import the helper functions we want to test
import {
	isOrganizationUrn,
	isCompanyAttendee,
	isCompanyMessage,
} from "../unipile-sync/shared";

// Mock the sync config
vi.mock("../../../config/sync.config", () => ({
	getCurrentSyncConfig: vi.fn(() => ({
		includeCompanyMessages: false, // Default to filtering company messages
		enableDetailedLogging: false,
	})),
}));

import { getCurrentSyncConfig } from "../../../config/sync.config";

describe("Company Message Filtering", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("isOrganizationUrn", () => {
		it("should return true for organization URNs", () => {
			expect(isOrganizationUrn("urn:li:organization:12345")).toBe(true);
			expect(isOrganizationUrn("URN:LI:ORGANIZATION:67890")).toBe(true);
			expect(isOrganizationUrn("urn:li:Organization:54321")).toBe(true);
		});

		it("should return false for person URNs", () => {
			expect(isOrganizationUrn("urn:li:person:12345")).toBe(false);
			expect(isOrganizationUrn("urn:li:member:67890")).toBe(false);
		});

		it("should return false for undefined/null/empty values", () => {
			expect(isOrganizationUrn(undefined)).toBe(false);
			expect(isOrganizationUrn(null as any)).toBe(false);
			expect(isOrganizationUrn("")).toBe(false);
		});

		it("should return false for non-URN strings", () => {
			expect(isOrganizationUrn("not-a-urn")).toBe(false);
			expect(isOrganizationUrn("12345")).toBe(false);
		});
	});

	describe("isCompanyAttendee", () => {
		it("should return true when attendee_type is 'organization'", () => {
			const attendee = {
				attendee_type: "organization",
				attendee_provider_id: "some-id",
			};
			expect(isCompanyAttendee(attendee)).toBe(true);
		});

		it("should return true when attendee_provider_id is organization URN", () => {
			const attendee = {
				attendee_type: "person",
				attendee_provider_id: "urn:li:organization:12345",
			};
			expect(isCompanyAttendee(attendee)).toBe(true);
		});

		it("should return false for personal attendees", () => {
			const attendee = {
				attendee_type: "person",
				attendee_provider_id: "urn:li:person:12345",
			};
			expect(isCompanyAttendee(attendee)).toBe(false);
		});

		it("should return false for empty/undefined attendee", () => {
			expect(isCompanyAttendee({})).toBe(false);
			expect(isCompanyAttendee({ attendee_type: undefined })).toBe(false);
		});
	});

	describe("isCompanyMessage", () => {
		describe("when includeCompanyMessages is true", () => {
			beforeEach(() => {
				(getCurrentSyncConfig as any).mockReturnValue({
					includeCompanyMessages: true,
					enableDetailedLogging: false,
				});
			});

			it("should return false even for company messages", () => {
				const companyMessageData = {
					sender: {
						attendee_type: "organization",
						attendee_provider_id: "urn:li:organization:12345",
					},
					attendees: [
						{
							attendee_type: "organization",
							attendee_provider_id: "urn:li:organization:12345",
						},
					],
				};
				expect(isCompanyMessage(companyMessageData)).toBe(false);
			});
		});

		describe("when includeCompanyMessages is false", () => {
			beforeEach(() => {
				(getCurrentSyncConfig as any).mockReturnValue({
					includeCompanyMessages: false,
					enableDetailedLogging: false,
				});
			});

			it("should return true when sender has organization type", () => {
				const data = {
					sender: {
						attendee_type: "organization",
						attendee_provider_id: "some-id",
					},
				};
				expect(isCompanyMessage(data)).toBe(true);
			});

			it("should return true when sender has organization URN", () => {
				const data = {
					sender: {
						attendee_type: "person",
						attendee_provider_id: "urn:li:organization:12345",
					},
				};
				expect(isCompanyMessage(data)).toBe(true);
			});

			it("should return true when sender_urn is organization URN", () => {
				const data = {
					sender_urn: "urn:li:organization:12345",
				};
				expect(isCompanyMessage(data)).toBe(true);
			});

			it("should return true when sender_id is organization URN", () => {
				const data = {
					sender_id: "urn:li:organization:54321",
				};
				expect(isCompanyMessage(data)).toBe(true);
			});

			it("should return true when more than half attendees are organizations", () => {
				const data = {
					attendees: [
						{
							attendee_type: "organization",
							attendee_provider_id: "urn:li:organization:12345",
						},
						{
							attendee_type: "organization", 
							attendee_provider_id: "urn:li:organization:67890",
						},
						{
							attendee_type: "person",
							attendee_provider_id: "urn:li:person:11111",
						},
					],
				};
				expect(isCompanyMessage(data)).toBe(true);
			});

			it("should return false when less than half attendees are organizations", () => {
				const data = {
					attendees: [
						{
							attendee_type: "organization",
							attendee_provider_id: "urn:li:organization:12345",
						},
						{
							attendee_type: "person",
							attendee_provider_id: "urn:li:person:11111",
						},
						{
							attendee_type: "person",
							attendee_provider_id: "urn:li:person:22222",
						},
					],
				};
				expect(isCompanyMessage(data)).toBe(false);
			});

			it("should return false for personal messages", () => {
				const data = {
					sender: {
						attendee_type: "person",
						attendee_provider_id: "urn:li:person:12345",
					},
					attendees: [
						{
							attendee_type: "person",
							attendee_provider_id: "urn:li:person:12345",
						},
						{
							attendee_type: "person",
							attendee_provider_id: "urn:li:person:67890",
						},
					],
				};
				expect(isCompanyMessage(data)).toBe(false);
			});

			it("should return false for empty data", () => {
				expect(isCompanyMessage({})).toBe(false);
			});
		});
	});

	describe("Integration scenarios", () => {
		beforeEach(() => {
			(getCurrentSyncConfig as any).mockReturnValue({
				includeCompanyMessages: false,
				enableDetailedLogging: false,
			});
		});

		it("should filter LinkedIn company page messages", () => {
			const linkedinCompanyMessage = {
				sender: {
					attendee_type: "organization",
					attendee_provider_id: "urn:li:organization:1337",
				},
				attendees: [
					{
						attendee_type: "organization",
						attendee_provider_id: "urn:li:organization:1337",
					},
					{
						attendee_type: "person",
						attendee_provider_id: "urn:li:person:54321",
					},
				],
			};
			expect(isCompanyMessage(linkedinCompanyMessage)).toBe(true);
		});

		it("should allow personal LinkedIn messages", () => {
			const personalMessage = {
				sender: {
					attendee_type: "person",
					attendee_provider_id: "urn:li:person:12345",
				},
				attendees: [
					{
						attendee_type: "person",
						attendee_provider_id: "urn:li:person:12345",
					},
					{
						attendee_type: "person",
						attendee_provider_id: "urn:li:person:67890",
					},
				],
			};
			expect(isCompanyMessage(personalMessage)).toBe(false);
		});

		it("should handle mixed group chats appropriately", () => {
			const mixedGroupChat = {
				sender: {
					attendee_type: "person",
					attendee_provider_id: "urn:li:person:12345",
				},
				attendees: [
					{
						attendee_type: "person",
						attendee_provider_id: "urn:li:person:12345",
					},
					{
						attendee_type: "person", 
						attendee_provider_id: "urn:li:person:67890",
					},
					{
						attendee_type: "organization",
						attendee_provider_id: "urn:li:organization:1337",
					},
				],
			};
			// Should return false since less than half are organizations
			expect(isCompanyMessage(mixedGroupChat)).toBe(false);
		});

		it("should handle historical sync chat data format", () => {
			const historicalChatData = {
				sender_urn: "urn:li:organization:1337",
				attendees: [
					{
						attendee_type: "organization",
						attendee_provider_id: "urn:li:organization:1337",
					},
				],
			};
			expect(isCompanyMessage(historicalChatData)).toBe(true);
		});

		it("should handle webhook message data format", () => {
			const webhookMessageData = {
				sender: {
					attendee_type: "organization",
					attendee_provider_id: "urn:li:organization:1337",
				},
				attendees: [
					{
						attendee_type: "organization",
						attendee_provider_id: "urn:li:organization:1337",
					},
				],
			};
			expect(isCompanyMessage(webhookMessageData)).toBe(true);
		});
	});
});
