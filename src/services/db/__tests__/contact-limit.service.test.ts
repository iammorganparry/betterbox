import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContactLimitService } from '../contact-limit.service';
import { CONTACT_LIMITS_CONFIG } from '~/config/contact-limits.config';

// Mock PrismaClient
const mockDb = {
	subscription: {
		findUnique: vi.fn(),
	},
	$queryRaw: vi.fn(),
} as any;

describe('ContactLimitService', () => {
	let service: ContactLimitService;

	beforeEach(() => {
		service = new ContactLimitService(mockDb);
		vi.clearAllMocks();
	});

	describe('getContactLimit', () => {
		it('should return correct limits for each plan', () => {
			expect(service.getContactLimit('FREE')).toBe(CONTACT_LIMITS_CONFIG.FREE.contactLimit);
			expect(service.getContactLimit('STARTER')).toBe(CONTACT_LIMITS_CONFIG.STARTER.contactLimit);
			expect(service.getContactLimit('PROFESSIONAL')).toBe(CONTACT_LIMITS_CONFIG.PROFESSIONAL.contactLimit);
			expect(service.getContactLimit('ENTERPRISE')).toBe(CONTACT_LIMITS_CONFIG.ENTERPRISE.contactLimit);
			expect(service.getContactLimit('GOLD')).toBe(CONTACT_LIMITS_CONFIG.GOLD.contactLimit);
		});

		it('should default to FREE limit for unknown plans', () => {
			expect(service.getContactLimit('UNKNOWN' as any)).toBe(CONTACT_LIMITS_CONFIG.FREE.contactLimit);
		});
	});

	describe('getContactLimitStatus', () => {
		it('should return correct status when within limit', async () => {
			// Mock subscription
			mockDb.subscription.findUnique.mockResolvedValue({
				plan: 'STARTER',
				status: 'ACTIVE'
			});

			// Mock contact count
			mockDb.$queryRaw.mockResolvedValue([{ count: 500 }]);

			const status = await service.getContactLimitStatus('user1');

			expect(status).toEqual({
				limit: CONTACT_LIMITS_CONFIG.STARTER.contactLimit,
				count: 500,
				isExceeded: false,
				remainingContacts: CONTACT_LIMITS_CONFIG.STARTER.contactLimit - 500
			});
		});

		it('should return correct status when exceeded', async () => {
			// Mock subscription  
			mockDb.subscription.findUnique.mockResolvedValue({
				plan: 'FREE',
				status: 'ACTIVE'
			});

			// Mock contact count
			mockDb.$queryRaw.mockResolvedValue([{ count: 150 }]);

			const status = await service.getContactLimitStatus('user1');

			expect(status).toEqual({
				limit: CONTACT_LIMITS_CONFIG.FREE.contactLimit,
				count: 150,
				isExceeded: true,
				remainingContacts: 0
			});
		});

		it('should default to FREE plan when no subscription', async () => {
			// Mock no subscription
			mockDb.subscription.findUnique.mockResolvedValue(null);

			// Mock contact count
			mockDb.$queryRaw.mockResolvedValue([{ count: 50 }]);

			const status = await service.getContactLimitStatus('user1');

			expect(status).toEqual({
				limit: CONTACT_LIMITS_CONFIG.FREE.contactLimit,
				count: 50,
				isExceeded: false,
				remainingContacts: CONTACT_LIMITS_CONFIG.FREE.contactLimit - 50
			});
		});
	});

	describe('obfuscateChat', () => {
		const mockChat = {
			id: 'chat1',
			name: 'John Doe',
			external_id: 'ext-chat-1',
			unipile_account_id: 'account-1',
			is_deleted: false,
			created_at: new Date(),
			updated_at: new Date(),
			last_message_at: new Date(),
			chat_type: 'direct',
			provider: 'linkedin',
			status: 'active',
			metadata: {},
			UnipileChatAttendee: [{
				id: 'attendee-1',
				unipile_chat_id: 'chat1',
				external_id: 'ext-attendee-1',
				is_self: 0,
				created_at: new Date(),
				updated_at: new Date(),
				contact: {
					id: 'contact-1',
					first_name: 'John',
					last_name: 'Doe',
					is_deleted: false,
					created_at: new Date(),
					updated_at: new Date(),
					unipile_account_id: 'account-1',
					external_id: 'ext-contact-1',
					email: 'john@example.com',
					phone: null,
					full_name: 'John Doe',
					headline: 'Software Engineer',
					profile_image_url: 'http://example.com/image.jpg',
					provider_url: 'http://linkedin.com/in/johndoe',
					occupation: 'Engineer',
					location: 'San Francisco',
					company: 'Tech Co',
					industry: 'Technology',
					total_connections: null,
					contact_info: {}
				}
			}],
			UnipileMessage: [{
				id: 'message-1',
				unipile_account_id: 'account-1',
				external_id: 'ext-message-1',
				is_deleted: false,
				created_at: new Date(),
				updated_at: new Date(),
				chat_id: 'chat1',
				hidden: 0,
				sent_at: new Date(),
				is_outgoing: false,
				is_read: true,
				message_type: 'text',
				seen: 1,
				deleted: 0,
				edited: 0,
				is_event: 0,
				delivered: 1,
				behavior: 0,
				event_type: 0,
				replies: 0,
				sender_urn: 'urn:li:person:123',
				attendee_type: null,
				attendee_distance: null,
				subject: null,
				parent: null,
				metadata: {},
				external_chat_id: 'ext-chat-1',
				content: 'Hello there!',
				sender_id: null,
				recipient_id: null,
				unipile_account: null
			}]
		} as any;

		it('should return original chat when within limit', () => {
			const result = service.obfuscateChat(mockChat, 50, 100);
			expect(result).toEqual(mockChat);
		});

		it('should obfuscate chat when exceeding limit', () => {
			const result = service.obfuscateChat(mockChat, 150, 100);
			
			expect(result.name).toBe('Premium Contact');
			expect(result.UnipileChatAttendee[0].contact.full_name).toBe('Premium Contact');
			expect(result.UnipileChatAttendee[0].contact.headline).toBe('Upgrade to view this contact');
			expect(result.UnipileChatAttendee[0].contact.profile_image_url).toBeNull();
			expect(result.UnipileMessage[0].content).toBe('Upgrade to view messages from premium contacts');
			expect(result.UnipileMessage[0].sender_urn).toBeNull();
		});
	});

	describe('getChatContactId', () => {
		it('should get contact ID from non-self attendee', () => {
			const mockChat = {
				UnipileChatAttendee: [
					{ is_self: 1, contact: { external_id: 'self1' } },
					{ is_self: 0, contact: { external_id: 'contact1' } }
				]
			};

			const contactId = (service as any).getChatContactId(mockChat);
			expect(contactId).toBe('contact1');
		});

		it('should return null when no non-self attendees', () => {
			const mockChat = {
				UnipileChatAttendee: [
					{ is_self: 1, contact: { external_id: 'self1' } }
				]
			};

			const contactId = (service as any).getChatContactId(mockChat);
			expect(contactId).toBeNull();
		});
	});
}); 