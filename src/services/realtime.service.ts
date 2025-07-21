import type { PrismaClient } from "generated/prisma";
import type {
	UserTopics,
	MessageNewEvent,
	MessageSyncEvent,
	AccountStatusEvent,
	ProfileViewEvent,
	ContactUpdateEvent,
} from "~/types/realtime";
import { getUserChannelId } from "~/types/realtime";

export class RealtimeService {
	constructor(private readonly db: PrismaClient) {}

	/**
	 * Helper function to publish a new message event
	 * Called from Inngest functions when new messages are received
	 */
	public createMessageNewEvent(data: {
		messageId: string;
		content: string | null;
		senderName: string | null;
		senderImageUrl: string | null;
		chatId: string | null;
		provider: string;
		sentAt: Date;
		isOutgoing: boolean;
		accountId: string;
		accountProvider: string;
		accountExternalId: string;
	}): MessageNewEvent {
		return {
			message: {
				id: data.messageId,
				content: data.content,
				sender_name: data.senderName,
				sender_image_url: data.senderImageUrl,
				chat_id: data.chatId,
				provider: data.provider,
				sent_at: data.sentAt.toISOString(),
				is_outgoing: data.isOutgoing,
			},
			account: {
				id: data.accountId,
				provider: data.accountProvider,
				account_id: data.accountExternalId,
			},
		};
	}

	/**
	 * Helper function to publish a message sync status event
	 */
	public createMessageSyncEvent(data: {
		status: "started" | "progress" | "completed" | "failed";
		accountId: string;
		provider: string;
		totalProcessed?: number;
		totalMessages?: number;
		error?: string;
	}): MessageSyncEvent {
		return {
			status: data.status,
			account_id: data.accountId,
			provider: data.provider,
			total_processed: data.totalProcessed,
			total_messages: data.totalMessages,
			error: data.error,
		};
	}

	/**
	 * Helper function to publish an account status event
	 */
	public createAccountStatusEvent(data: {
		accountId: string;
		provider: string;
		status: "connected" | "disconnected" | "error" | "pending";
		errorMessage?: string;
	}): AccountStatusEvent {
		return {
			account_id: data.accountId,
			provider: data.provider,
			status: data.status,
			error_message: data.errorMessage,
		};
	}

	/**
	 * Helper function to publish a profile view event
	 */
	public createProfileViewEvent(data: {
		viewerName: string | null;
		viewerHeadline: string | null;
		viewerImageUrl: string | null;
		viewedAt: Date;
		provider: string;
	}): ProfileViewEvent {
		return {
			viewer_name: data.viewerName,
			viewer_headline: data.viewerHeadline,
			viewer_image_url: data.viewerImageUrl,
			viewed_at: data.viewedAt.toISOString(),
			provider: data.provider,
		};
	}

	/**
	 * Helper function to publish a contact update event
	 */
	public createContactUpdateEvent(data: {
		contactId: string;
		fullName: string | null;
		headline: string | null;
		profileImageUrl: string | null;
		isConnection: boolean;
		accountId: string;
		provider: string;
		action: "new" | "updated" | "connected";
	}): ContactUpdateEvent {
		return {
			contact: {
				id: data.contactId,
				full_name: data.fullName,
				headline: data.headline,
				profile_image_url: data.profileImageUrl,
				is_connection: data.isConnection,
			},
			account_id: data.accountId,
			provider: data.provider,
			action: data.action,
		};
	}

	/**
	 * Get available topics for a user subscription
	 */
	public getAvailableTopics(): UserTopics[] {
		return [
			"messages:new",
			"messages:sync",
			"profile:view",
			"account:status",
			"contacts:update",
		];
	}

	/**
	 * Get channel ID for a user
	 */
	public getUserChannel(userId: string): string {
		return getUserChannelId(userId);
	}

	/**
	 * Create realtime event data for Inngest step.sendEvent
	 */
	public createRealtimeEventData(
		channel: string,
		topic: UserTopics,
		payload:
			| MessageNewEvent
			| MessageSyncEvent
			| AccountStatusEvent
			| ProfileViewEvent
			| ContactUpdateEvent,
	) {
		return {
			name: "realtime/publish",
			data: {
				channel,
				topic,
				payload,
			},
		};
	}
}
