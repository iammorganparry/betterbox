import type { Prisma, PrismaClient } from "../../../generated/prisma";
import { getContactLimitForPlan, type SubscriptionPlan } from "~/config/contact-limits.config";

export interface ContactLimitStatus {
	limit: number;
	count: number;
	isExceeded: boolean;
	remainingContacts: number;
}

export class ContactLimitService {
	constructor(private db: PrismaClient) {}

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
		const [contactsFromMessages, contactsFromViews] = await Promise.all([
			// Count unique contacts from incoming messages
			this.db.$queryRaw<[{ count: number }]>`
				SELECT COUNT(DISTINCT uc.external_id)::int as count
				FROM "UnipileContact" uc
				INNER JOIN "UnipileAccount" ua ON uc.unipile_account_id = ua.id
				INNER JOIN "UnipileMessage" um ON um.sender_id = uc.external_id
				WHERE ua.user_id = ${userId}
				  AND ua.is_deleted = false
				  AND uc.is_deleted = false
				  AND um.is_deleted = false
				  AND um.is_outgoing = false
			`,
			
			// Count unique contacts from profile views
			this.db.$queryRaw<[{ count: number }]>`
				SELECT COUNT(DISTINCT viewer_profile_id)::int as count
				FROM "UnipileProfileView"
				WHERE user_id = ${userId}
				  AND viewer_profile_id IS NOT NULL
				  AND is_deleted = false
			`
		]);

		// Use a UNION to get the total unique count across both sources
		const [uniqueContacts] = await this.db.$queryRaw<[{ count: number }]>`
			SELECT COUNT(DISTINCT contact_id)::int as count
			FROM (
				-- Contacts from incoming messages
				SELECT DISTINCT uc.external_id as contact_id
				FROM "UnipileContact" uc
				INNER JOIN "UnipileAccount" ua ON uc.unipile_account_id = ua.id
				INNER JOIN "UnipileMessage" um ON um.sender_id = uc.external_id
				WHERE ua.user_id = ${userId}
				  AND ua.is_deleted = false
				  AND uc.is_deleted = false
				  AND um.is_deleted = false
				  AND um.is_outgoing = false
				
				UNION
				
				-- Contacts from profile views
				SELECT DISTINCT viewer_profile_id as contact_id
				FROM "UnipileProfileView"
				WHERE user_id = ${userId}
				  AND viewer_profile_id IS NOT NULL
				  AND is_deleted = false
			) combined_contacts
		`;

		return uniqueContacts?.count || 0;
	}

	/**
	 * Get contact limit status for a user
	 */
	async getContactLimitStatus(userId: string): Promise<ContactLimitStatus> {
		// Get user's subscription plan
		const subscription = await this.db.subscription.findUnique({
			where: { user_id: userId },
			select: { plan: true, status: true }
		});

		const plan = subscription?.plan || 'FREE';
		const limit = this.getContactLimit(plan as SubscriptionPlan);
		const count = await this.countUserContacts(userId);

		return {
			limit,
			count,
			isExceeded: count > limit,
			remainingContacts: Math.max(0, limit - count)
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
	obfuscateChat(chat: any, contactIndex: number, limit: number): any {
		if (contactIndex <= limit) {
			return chat; // Return original chat if within limit
		}

		// Obfuscate the chat
		return {
			...chat,
			name: "Premium Contact",
			UnipileChatAttendee: chat.UnipileChatAttendee?.map((attendee: any) => ({
				...attendee,
				contact: attendee.contact ? {
					...attendee.contact,
					full_name: "Premium Contact",
					first_name: "Premium",
					last_name: "Contact", 
					headline: "Upgrade to view this contact",
					profile_image_url: null,
					provider_url: null,
					occupation: null,
					location: null
				} : attendee.contact
			})),
			// Obfuscate recent messages
			UnipileMessage: chat.UnipileMessage?.map((message: any) => ({
				...message,
				content: "Upgrade to view messages from premium contacts",
				sender_urn: null
			}))
		};
	}

	/**
	 * Apply contact limits to a list of chats
	 */
	async applyContactLimitsToChats(userId: string, chats: any[]): Promise<any[]> {
		const limitStatus = await this.getContactLimitStatus(userId);
		
		if (!limitStatus.isExceeded) {
			return chats; // Return original chats if within limit
		}

		// Sort chats by last message time to prioritize recent contacts
		const sortedChats = [...chats].sort((a, b) => {
			const aTime = new Date(a.last_message_at || 0).getTime();
			const bTime = new Date(b.last_message_at || 0).getTime();
			return bTime - aTime; // Most recent first
		});

		// Track unique contacts and apply obfuscation
		const seenContacts = new Set<string>();
		let contactCount = 0;

		return sortedChats.map(chat => {
			// Get the contact identifier from the chat
			const contactId = this.getChatContactId(chat);
			
			if (contactId && !seenContacts.has(contactId)) {
				seenContacts.add(contactId);
				contactCount++;
			}

			// Apply obfuscation if this contact exceeds the limit
			if (contactCount > limitStatus.limit) {
				return this.obfuscateChat(chat, contactCount, limitStatus.limit);
			}

			return chat;
		});
	}

	/**
	 * Get the primary contact ID from a chat
	 */
	private getChatContactId(chat: any): string | null {
		// For direct chats, get the non-self attendee
		const nonSelfAttendee = chat.UnipileChatAttendee?.find(
			(attendee: any) => attendee.is_self === 0
		);
		
		return nonSelfAttendee?.contact?.external_id || nonSelfAttendee?.external_id || null;
	}
} 