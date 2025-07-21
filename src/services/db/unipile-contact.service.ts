import type { Prisma, PrismaClient } from "../../../generated/prisma";
import type { UnipileContact } from "../../../generated/prisma";

// Use Prisma's generated types
export type CreateContactData = Prisma.UnipileContactCreateInput;
export type UpdateContactData = Prisma.UnipileContactUpdateInput;

// Contact with various include options
export type ContactWithAccount = Prisma.UnipileContactGetPayload<{
	include: { unipile_account: true };
}>;

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
	constructor(private readonly db: PrismaClient) {}

	/**
	 * Find contact by external ID
	 */
	async findContactByExternalId(
		unipileAccountId: string,
		externalId: string,
		includeDeleted = false,
	): Promise<UnipileContact | null> {
		return await this.db.unipileContact.findFirst({
			where: {
				unipile_account_id: unipileAccountId,
				external_id: externalId,
				...(includeDeleted ? {} : { is_deleted: false }),
			},
		});
	}

	/**
	 * Create or update a contact
	 */
	async upsertContact(
		unipileAccountId: string,
		externalId: string,
		updateData: Partial<UpdateContactData>,
		createData?: Partial<Prisma.UnipileContactCreateWithoutUnipile_accountInput>,
	): Promise<UnipileContact> {
		return await this.db.unipileContact.upsert({
			where: {
				unipile_account_id_external_id: {
					unipile_account_id: unipileAccountId,
					external_id: externalId,
				},
			},
			update: {
				...updateData,
				updated_at: new Date(),
			},
			create: {
				unipile_account: {
					connect: { id: unipileAccountId },
				},
				external_id: externalId,
				is_connection: false,
				...createData,
			},
		});
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

		return await this.db.unipileContact.findMany({
			where: {
				unipile_account_id: unipileAccountId,
				...(include_deleted ? {} : { is_deleted: false }),
				...(is_connection !== undefined ? { is_connection } : {}),
			},
			include: {
				...(include_account ? { unipile_account: true } : {}),
			},
			orderBy: { [order_by]: order_direction },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {}),
		});
	}

	/**
	 * Get contacts for a user across all accounts
	 */
	async getContactsByUser(
		userId: string,
		provider?: string,
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

		return await this.db.unipileContact.findMany({
			where: {
				unipile_account: {
					user_id: userId,
					...(provider ? { provider } : {}),
					is_deleted: false,
				},
				...(include_deleted ? {} : { is_deleted: false }),
				...(is_connection !== undefined ? { is_connection } : {}),
			},
			include: {
				...(include_account ? { unipile_account: true } : {}),
			},
			orderBy: { [order_by]: order_direction },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {}),
		});
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

		return await this.db.unipileContact.findMany({
			where: {
				unipile_account_id: unipileAccountId,
				is_deleted: false,
				OR: [
					{
						full_name: {
							contains: searchTerm,
							mode: "insensitive",
						},
					},
					{
						first_name: {
							contains: searchTerm,
							mode: "insensitive",
						},
					},
					{
						last_name: {
							contains: searchTerm,
							mode: "insensitive",
						},
					},
					{
						headline: {
							contains: searchTerm,
							mode: "insensitive",
						},
					},
				],
			},
			orderBy: { last_interaction: "desc" },
			take: limit,
		});
	}

	/**
	 * Update last interaction timestamp
	 */
	async updateLastInteraction(
		contactId: string,
		interactionDate = new Date(),
	): Promise<UnipileContact> {
		return await this.db.unipileContact.update({
			where: { id: contactId },
			data: {
				last_interaction: interactionDate,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Update connection status
	 */
	async updateConnectionStatus(
		contactId: string,
		isConnection: boolean,
	): Promise<UnipileContact> {
		return await this.db.unipileContact.update({
			where: { id: contactId },
			data: {
				is_connection: isConnection,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Get recent contacts based on last interaction
	 */
	async getRecentContacts(
		unipileAccountId: string,
		limit = 10,
	): Promise<UnipileContact[]> {
		return await this.db.unipileContact.findMany({
			where: {
				unipile_account_id: unipileAccountId,
				is_deleted: false,
				last_interaction: { not: null },
			},
			orderBy: { last_interaction: "desc" },
			take: limit,
		});
	}

	/**
	 * Get contacts that are connections
	 */
	async getConnections(
		unipileAccountId: string,
		limit?: number,
	): Promise<UnipileContact[]> {
		return await this.db.unipileContact.findMany({
			where: {
				unipile_account_id: unipileAccountId,
				is_deleted: false,
				is_connection: true,
			},
			orderBy: { full_name: "asc" },
			...(limit ? { take: limit } : {}),
		});
	}

	/**
	 * Mark contact as deleted (soft delete)
	 */
	async markContactAsDeleted(contactId: string): Promise<UnipileContact> {
		return await this.db.unipileContact.update({
			where: { id: contactId },
			data: {
				is_deleted: true,
				updated_at: new Date(),
			},
		});
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
		const [stats] = await this.db.$queryRaw<
			[
				{
					total_contacts: number;
					connections: number;
					recently_interacted: number;
					with_profile_images: number;
				},
			]
		>`
			SELECT 
				COUNT(*)::int as total_contacts,
				COUNT(*) FILTER (WHERE is_connection = true)::int as connections,
				COUNT(*) FILTER (WHERE last_interaction > NOW() - INTERVAL '30 days')::int as recently_interacted,
				COUNT(*) FILTER (WHERE profile_image_url IS NOT NULL)::int as with_profile_images
			FROM "UnipileContact"
			WHERE unipile_account_id = ${unipileAccountId} AND is_deleted = false
		`;

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
		contactsData: Prisma.UnipileContactCreateManyInput[],
	): Promise<Prisma.BatchPayload> {
		return await this.db.unipileContact.createMany({
			data: contactsData,
			skipDuplicates: true,
		});
	}

	/**
	 * Bulk update last interaction for multiple contacts
	 */
	async bulkUpdateLastInteraction(
		contactIds: string[],
		interactionDate = new Date(),
	): Promise<Prisma.BatchPayload> {
		return await this.db.unipileContact.updateMany({
			where: {
				id: { in: contactIds },
				is_deleted: false,
			},
			data: {
				last_interaction: interactionDate,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Find or create contact (convenience method)
	 */
	async findOrCreateContact(
		unipileAccountId: string,
		externalId: string,
		contactData: Partial<Prisma.UnipileContactCreateWithoutUnipile_accountInput>,
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
		const contact = await this.db.unipileContact.findUnique({
			where: { id: contactId },
		});

		if (!contact) return null;

		const messageCount = await this.db.unipileMessage.count({
			where: {
				OR: [
					{ sender_id: contact.external_id },
					{ recipient_id: contact.external_id },
				],
				is_deleted: false,
			},
		});

		return { ...contact, messageCount };
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

		return await this.db.unipileContact.findMany({
			where: {
				unipile_account_id: unipileAccountId,
				is_deleted: false,
				last_interaction: {
					gte: cutoffDate,
				},
			},
			orderBy: { last_interaction: "desc" },
			take: limit,
		});
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
		return await this.db.unipileContact.update({
			where: { id: contactId },
			data: {
				...profileData,
				updated_at: new Date(),
			},
		});
	}
}
