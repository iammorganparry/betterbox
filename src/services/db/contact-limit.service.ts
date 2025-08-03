import { and, eq, sql } from "drizzle-orm";
import {
	type SubscriptionPlan,
	getContactLimitForPlan,
} from "~/config/contact-limits.config";
import type { db } from "~/db";
import {
	subscriptions,
	unipileAccounts,
	type unipileChatAttendees,
	type unipileChats,
	unipileContacts,
	unipileMessages,
} from "~/db/schema";
import type { ChatWithDetails } from "./unipile-chat.service";

export interface ContactLimitStatus {
	limit: number;
	count: number;
	isExceeded: boolean;
	remainingContacts: number;
}

export class ContactLimitService {
	constructor(private drizzleDb: typeof db) {}

	/**
	 * Get contact limit for a subscription plan
	 */
	getContactLimit(plan: SubscriptionPlan): number {
		return getContactLimitForPlan(plan);
	}

	/**
	 * Count contacts for a user based on the definition:
	 * "A contact is a profile that messages or profile views us"
	 */
	async countUserContacts(userId: string): Promise<number> {
		// Get all contacts that have either:
		// 1. Sent messages to the user
		// 2. Viewed the user's profile

		// Import required tables

		const result = await this.drizzleDb
			.select({
				count: sql<number>`COUNT(DISTINCT ${unipileContacts.id})`,
			})
			.from(unipileContacts)
			.innerJoin(
				unipileAccounts,
				eq(unipileContacts.unipile_account_id, unipileAccounts.id),
			)
			.innerJoin(
				unipileMessages,
				eq(unipileMessages.sender_id, unipileContacts.external_id),
			)
			.where(
				and(
					eq(unipileAccounts.user_id, userId),
					eq(unipileAccounts.is_deleted, false),
					eq(unipileContacts.is_deleted, false),
					eq(unipileMessages.is_deleted, false),
					eq(unipileMessages.is_outgoing, false),
				),
			);

		return (result[0] as { count: number })?.count || 0;
	}

	/**
	 * Get contact limit status for a user
	 */
	async getContactLimitStatus(userId: string): Promise<ContactLimitStatus> {
		// Get user's subscription plan
		const result = await this.drizzleDb
			.select({ plan: subscriptions.plan, status: subscriptions.status })
			.from(subscriptions)
			.where(eq(subscriptions.user_id, userId))
			.limit(1);

		const subscription = result[0];
		const plan = subscription?.plan || "FREE";
		const limit = this.getContactLimit(plan as SubscriptionPlan);
		const count = await this.countUserContacts(userId);

		return {
			limit,
			count,
			isExceeded: count > limit,
			remainingContacts: Math.max(0, limit - count),
		};
	}

	/**
	 * Check if a user has exceeded their contact limit
	 */
	async hasExceededLimit(userId: string): Promise<boolean> {
		const status = await this.getContactLimitStatus(userId);
		return status.isExceeded;
	}

	/**
	 * Obfuscate chat data when contact limit is exceeded
	 */
	obfuscateChat(
		chat: ChatWithDetails,
		contactIndex: number,
		limit: number,
	): ChatWithDetails {
		if (contactIndex <= limit) {
			return chat; // Return original chat if within limit
		}

		// Obfuscate the chat
		return {
			...chat,
			name: "Premium Contact",
			unipileChatAttendees: chat.unipileChatAttendees?.map((attendee) => ({
				...attendee,
				contact: attendee.contact
					? {
							...attendee.contact,
							full_name: "Premium Contact",
							first_name: "Premium",
							last_name: "Contact",
							headline: "Upgrade to view this contact",
							profile_image_url: null,
							provider_url: null,
							occupation: null,
							location: null,
						}
					: attendee.contact,
			})),
			// Obfuscate recent messages
			unipileMessages: chat.unipileMessages?.map((message) => ({
				...message,
				content: "Upgrade to view messages from premium contacts",
				sender_urn: null,
			})),
		};
	}

	/**
	 * Apply contact limits to a list of chats
	 * Strategy: Show established (older) contacts, obfuscate newest contacts to create FOMO
	 */
	async applyContactLimitsToChats(
		userId: string,
		chats: ChatWithDetails[],
	): Promise<ChatWithDetails[]> {
		const limitStatus = await this.getContactLimitStatus(userId);

		if (!limitStatus.isExceeded) {
			return chats; // Return original chats if within limit
		}

		// Group chats by contact and find the most recent message time for each contact
		const contactToLatestTime = new Map<string, number>();
		const contactToChats = new Map<string, ChatWithDetails[]>();

		for (const chat of chats) {
			const contactId = this.getChatContactId(chat);
			const messageTime = new Date(chat.last_message_at || 0).getTime();

			if (!contactId) {
				continue;
			}

			// Track the latest message time for this contact
			const currentLatest = contactToLatestTime.get(contactId) || 0;

			// Always track contacts, even with zero timestamps (>= instead of >)
			if (messageTime >= currentLatest) {
				contactToLatestTime.set(contactId, messageTime);
			}

			// Group chats by contact
			if (!contactToChats.has(contactId)) {
				contactToChats.set(contactId, []);
			}
			contactToChats.get(contactId)?.push(chat);
		}

		// Sort contacts by their latest message time (oldest conversations first)
		// This means we'll show established relationships and obfuscate new exciting contacts
		const sortedContacts = Array.from(contactToLatestTime.entries())
			.sort((a, b) => a[1] - b[1]) // Oldest first (ascending by timestamp)
			.map(([contactId]) => contactId);

		// Determine which contacts should be obfuscated (the newest ones that exceed limit)
		const obfuscatedContacts = new Set(
			sortedContacts.slice(limitStatus.limit), // Take contacts beyond the limit
		);

		// Apply obfuscation to chats from obfuscated contacts
		return chats.map((chat) => {
			const contactId = this.getChatContactId(chat);

			if (contactId && obfuscatedContacts.has(contactId)) {
				// Calculate the contact's position for obfuscation message
				const contactPosition = sortedContacts.indexOf(contactId) + 1;
				return this.obfuscateChat(chat, contactPosition, limitStatus.limit);
			}

			return chat;
		});
	}

	/**
	 * Get the primary contact ID from a chat
	 */
	private getChatContactId(chat: ChatWithDetails): string | null {
		// For direct chats, get the non-self attendee
		const nonSelfAttendee = chat.unipileChatAttendees?.find(
			(attendee) => attendee.is_self === 0,
		);

		return (
			nonSelfAttendee?.contact?.external_id ||
			nonSelfAttendee?.external_id ||
			null
		);
	}
}
