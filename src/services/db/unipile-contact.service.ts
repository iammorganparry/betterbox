import {
	eq,
	and,
	or,
	desc,
	asc,
	count,
	getTableColumns,
	not,
	isNotNull,
	inArray,
	gte,
	sql,
} from "drizzle-orm";
import type { db } from "~/db";
import {
	unipileContacts,
	type unipileAccounts,
	unipileMessages,
} from "~/db/schema";

// Use Drizzle's inferred types
export type UnipileContact = typeof unipileContacts.$inferSelect;
export type CreateContactData = typeof unipileContacts.$inferInsert;
export type UpdateContactData = Partial<CreateContactData>;

// Contact with various include options
export type ContactWithAccount = UnipileContact & {
	unipile_account: typeof unipileAccounts.$inferSelect;
};

// Note: UnipileContact doesn't have direct message relations in the schema
// Messages reference contacts via sender_id/recipient_id fields

export interface FindContactOptions {
	include_account?: boolean;
	include_deleted?: boolean;
	limit?: number;
	offset?: number;
	order_by?: "created_at" | "updated_at" | "last_interaction";
	order_direction?: "asc" | "desc";
	is_connection?: boolean;
}

export class UnipileContactService {
	constructor(private readonly drizzleDb: typeof db) {}

	/**
	 * Find contact by external ID
	 */
	async findContactByExternalId(
		unipileAccountId: string,
		externalId: string,
		includeDeleted = false,
	): Promise<UnipileContact | null> {
		const whereConditions = [
			eq(unipileContacts.unipile_account_id, unipileAccountId),
			eq(unipileContacts.external_id, externalId),
		];

		if (!includeDeleted) {
			whereConditions.push(eq(unipileContacts.is_deleted, false));
		}

		const result = await this.drizzleDb
			.select()
			.from(unipileContacts)
			.where(and(...whereConditions))
			.limit(1);

		return result[0] || null;
	}

	/**
	 * Create or update a contact
	 */
	async upsertContact(
		unipileAccountId: string,
		externalId: string,
		updateData: Partial<UpdateContactData>,
		createData?: Partial<CreateContactData>,
	): Promise<UnipileContact> {
		const insertData: CreateContactData = {
			unipile_account_id: unipileAccountId,
			external_id: externalId,
			is_connection: false,
			is_deleted: false,
			created_at: new Date(),
			updated_at: new Date(),
			...updateData,
			...createData,
		};

		const result = await this.drizzleDb
			.insert(unipileContacts)
			.values(insertData)
			.onConflictDoUpdate({
				target: [
					unipileContacts.unipile_account_id,
					unipileContacts.external_id,
				],
				set: {
					...updateData,
					updated_at: new Date(),
				},
			})
			.returning();

		if (!result[0]) {
			throw new Error("Failed to upsert contact");
		}
		return result[0];
	}

	/**
	 * Get contacts for a Unipile account
	 */
	async getContactsByAccount(
		unipileAccountId: string,
		options: FindContactOptions = {},
	): Promise<UnipileContact[]> {
		const {
			include_account = false,
			include_deleted = false,
			limit,
			offset,
			order_by = "last_interaction",
			order_direction = "desc",
			is_connection,
		} = options;

		const result = await this.drizzleDb
			.select()
			.from(unipileContacts)
			.where(and(eq(unipileContacts.unipile_account_id, unipileAccountId)))
			.limit(limit ?? 100)
			.offset(offset ?? 0)
			.orderBy(
				order_by === "last_interaction"
					? desc(unipileContacts.last_interaction)
					: asc(unipileContacts[order_by]),
			);

		return result;
	}

	/**
	 * Get contacts for a user across all accounts
	 */
	async getContactsByUser(
		unipileAccountId: string,
		options: FindContactOptions = {},
	): Promise<UnipileContact[]> {
		const {
			include_account = false,
			include_deleted = false,
			limit,
			offset,
			order_by = "last_interaction",
			order_direction = "desc",
			is_connection,
		} = options;

		const result = await this.drizzleDb
			.select()
			.from(unipileContacts)
			.where(and(eq(unipileContacts.unipile_account_id, unipileAccountId)))
			.limit(limit ?? 100)
			.offset(offset ?? 0)
			.orderBy(desc(unipileContacts.last_interaction));

		return result;
	}

	/**
	 * Search contacts by name or headline
	 */
	async searchContacts(
		unipileAccountId: string,
		searchTerm: string,
		options: FindContactOptions = {},
	): Promise<UnipileContact[]> {
		const { limit = 50 } = options;

		const result = await this.drizzleDb
			.select()
			.from(unipileContacts)
			.where(and(eq(unipileContacts.unipile_account_id, unipileAccountId)))
			.limit(limit ?? 100)
			.orderBy(desc(unipileContacts.last_interaction));

		return result;
	}

	/**
	 * Update last interaction timestamp
	 */
	async updateLastInteraction(
		contactId: string,
		interactionDate = new Date(),
	): Promise<UnipileContact> {
		const result = await this.drizzleDb
			.update(unipileContacts)
			.set({
				last_interaction: interactionDate,
				updated_at: new Date(),
			})
			.where(eq(unipileContacts.id, contactId))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to update last interaction");
		}
		return result[0];
	}

	/**
	 * Update connection status
	 */
	async updateConnectionStatus(
		contactId: string,
		isConnection: boolean,
	): Promise<UnipileContact> {
		const result = await this.drizzleDb
			.update(unipileContacts)
			.set({
				is_connection: isConnection,
				updated_at: new Date(),
			})
			.where(eq(unipileContacts.id, contactId))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to update connection status");
		}
		return result[0];
	}

	/**
	 * Get recent contacts based on last interaction
	 */
	async getRecentContacts(
		unipileAccountId: string,
		limit = 10,
	): Promise<UnipileContact[]> {
		const result = await this.drizzleDb
			.select()
			.from(unipileContacts)
			.where(
				and(
					eq(unipileContacts.unipile_account_id, unipileAccountId),
					eq(unipileContacts.is_deleted, false),
					isNotNull(unipileContacts.last_interaction),
				),
			)
			.orderBy(desc(unipileContacts.last_interaction))
			.limit(limit);

		return result;
	}

	/**
	 * Get contacts that are connections
	 */
	async getConnections(
		unipileAccountId: string,
		limit?: number,
		offset?: number,
	): Promise<UnipileContact[]> {
		const result = await this.drizzleDb
			.select()
			.from(unipileContacts)
			.where(
				and(
					eq(unipileContacts.unipile_account_id, unipileAccountId),
					eq(unipileContacts.is_deleted, false),
					eq(unipileContacts.is_connection, true),
				),
			)
			.orderBy(asc(unipileContacts.full_name))
			.limit(limit ?? 100)
			.offset(offset ?? 0);

		return result;
	}

	/**
	 * Mark contact as deleted (soft delete)
	 */
	async markContactAsDeleted(contactId: string): Promise<UnipileContact> {
		const result = await this.drizzleDb
			.update(unipileContacts)
			.set({
				is_deleted: true,
				updated_at: new Date(),
			})
			.where(eq(unipileContacts.id, contactId))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to mark contact as deleted");
		}
		return result[0];
	}

	/**
	 * Get contact statistics
	 */
	async getContactStats(unipileAccountId: string): Promise<{
		totalContacts: number;
		connections: number;
		recentlyInteracted: number;
		withProfileImages: number;
	}> {
		const [stats] = await this.drizzleDb.execute<{
			total_contacts: number;
			connections: number;
			recently_interacted: number;
			with_profile_images: number;
		}>(sql`
			SELECT 
				COUNT(*)::int as total_contacts,
				COUNT(*) FILTER (WHERE is_connection = true)::int as connections,
				COUNT(*) FILTER (WHERE last_interaction > NOW() - INTERVAL '30 days')::int as recently_interacted,
				COUNT(*) FILTER (WHERE profile_image_url IS NOT NULL)::int as with_profile_images
			FROM unipile_contacts
			WHERE unipile_account_id = ${unipileAccountId} AND is_deleted = false
		`);

		return {
			totalContacts: stats?.total_contacts || 0,
			connections: stats?.connections || 0,
			recentlyInteracted: stats?.recently_interacted || 0,
			withProfileImages: stats?.with_profile_images || 0,
		};
	}

	/**
	 * Bulk create contacts
	 */
	async bulkCreateContacts(
		contactsData: CreateContactData[],
	): Promise<UnipileContact[]> {
		const result = await this.drizzleDb
			.insert(unipileContacts)
			.values(contactsData)
			.onConflictDoUpdate({
				target: [
					unipileContacts.unipile_account_id,
					unipileContacts.external_id,
				],
				set: {
					updated_at: new Date(),
				},
			})
			.returning();

		return result;
	}

	/**
	 * Bulk update last interaction for multiple contacts
	 */
	async bulkUpdateLastInteraction(
		contactIds: string[],
		interactionDate = new Date(),
	): Promise<UnipileContact[]> {
		const result = await this.drizzleDb
			.update(unipileContacts)
			.set({
				last_interaction: interactionDate,
				updated_at: new Date(),
			})
			.where(
				and(
					inArray(unipileContacts.id, contactIds),
					eq(unipileContacts.is_deleted, false),
				),
			)
			.returning();

		return result;
	}

	/**
	 * Find or create contact (convenience method)
	 */
	async findOrCreateContact(
		unipileAccountId: string,
		externalId: string,
		contactData: Partial<CreateContactData>,
	): Promise<UnipileContact> {
		const existingContact = await this.findContactByExternalId(
			unipileAccountId,
			externalId,
		);

		if (existingContact) {
			return existingContact;
		}

		return await this.upsertContact(
			unipileAccountId,
			externalId,
			contactData,
			contactData,
		);
	}

	/**
	 * Get contact with message count
	 */
	async getContactWithMessageCount(
		contactId: string,
	): Promise<(UnipileContact & { messageCount: number }) | null> {
		const [contact] = await this.drizzleDb
			.select()
			.from(unipileContacts)
			.where(eq(unipileContacts.id, contactId))
			.limit(1);

		if (!contact) return null;

		const messageCount = await this.drizzleDb
			.select({ count: count() })
			.from(unipileMessages)
			.where(
				and(
					or(
						eq(unipileMessages.sender_id, contact.external_id),
						eq(unipileMessages.recipient_id, contact.external_id),
					),
					eq(unipileMessages.is_deleted, false),
				),
			);

		return { ...contact, messageCount: messageCount[0]?.count || 0 };
	}

	/**
	 * Get active contacts (contacts with recent interactions)
	 */
	async getActiveContacts(
		unipileAccountId: string,
		daysSinceLastInteraction = 30,
		limit = 20,
	): Promise<UnipileContact[]> {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastInteraction);

		return await this.drizzleDb
			.select()
			.from(unipileContacts)
			.where(
				and(
					eq(unipileContacts.unipile_account_id, unipileAccountId),
					eq(unipileContacts.is_deleted, false),
					gte(unipileContacts.last_interaction, cutoffDate),
				),
			)
			.orderBy(desc(unipileContacts.last_interaction))
			.limit(limit);
	}

	/**
	 * Update contact profile information
	 */
	async updateContactProfile(
		contactId: string,
		profileData: {
			full_name?: string;
			first_name?: string;
			last_name?: string;
			headline?: string;
			profile_image_url?: string;
			provider_url?: string;
		},
	): Promise<UnipileContact> {
		const result = await this.drizzleDb
			.update(unipileContacts)
			.set({
				...profileData,
				updated_at: new Date(),
			})
			.where(eq(unipileContacts.id, contactId))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to update contact profile");
		}
		return result[0];
	}
}
