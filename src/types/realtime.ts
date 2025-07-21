// Inngest Realtime Channel and Topic Types

import type { getSubscriptionToken } from "@inngest/realtime";

// User channel topics interface
export interface UserChannelTopics {
	// New messages received
	"messages:new": {
		message: {
			id: string;
			content: string | null;
			sender_name: string | null;
			sender_image_url: string | null;
			chat_id: string | null;
			provider: string;
			sent_at: string; // ISO string
			is_outgoing: boolean;
		};
		account: {
			id: string;
			provider: string;
			account_id: string;
		};
	};

	// Message sync status updates
	"messages:sync": {
		status: "started" | "progress" | "completed" | "failed";
		account_id: string;
		provider: string;
		total_processed?: number;
		total_messages?: number;
		error?: string;
	};

	// New profile views
	"profile:view": {
		viewer_name: string | null;
		viewer_headline: string | null;
		viewer_image_url: string | null;
		viewed_at: string; // ISO string
		provider: string;
	};

	// Account connection status changes
	"account:status": {
		account_id: string;
		provider: string;
		status: "connected" | "disconnected" | "error" | "pending";
		error_message?: string;
	};

	// Contact updates (new connections, etc.)
	"contacts:update": {
		contact: {
			id: string;
			full_name: string | null;
			headline: string | null;
			profile_image_url: string | null;
			is_connection: boolean;
		};
		account_id: string;
		provider: string;
		action: "new" | "updated" | "connected";
	};
}

// System channel topics interface
export interface SystemChannelTopics {
	maintenance: {
		message: string;
		scheduled_at?: string;
		duration?: number;
	};
	announcements: {
		title: string;
		message: string;
		priority: "low" | "medium" | "high";
	};
}

// Combined channels interface for Inngest
export interface RealtimeChannels {
	// Global system channel
	system: SystemChannelTopics;
}

// Helper types for publishing events
export type UserTopics = keyof UserChannelTopics;
export type SystemTopics = keyof SystemChannelTopics;

// Event payload types for easier typing when publishing
export type MessageNewEvent = UserChannelTopics["messages:new"];
export type MessageSyncEvent = UserChannelTopics["messages:sync"];
export type ProfileViewEvent = UserChannelTopics["profile:view"];
export type AccountStatusEvent = UserChannelTopics["account:status"];
export type ContactUpdateEvent = UserChannelTopics["contacts:update"];

// Subscription token request types
export interface SubscriptionTokenRequest {
	user_id: string;
	topics?: UserTopics[]; // If not provided, subscribes to all topics
}

export interface SubscriptionTokenResponse {
	token: Awaited<ReturnType<typeof getSubscriptionToken>>;
	channel: string;
	topics: UserTopics[];
	expires_at: string; // ISO string, tokens expire in 1 minute
}

// Helper functions for channel names
export const getUserChannelId = (userId: string): string => `user:${userId}`;
export const getSystemChannelId = (): string => "system";

// Type guards for channels
export const isUserChannel = (channel: string): boolean =>
	channel.startsWith("user:");
export const isSystemChannel = (channel: string): boolean =>
	channel === "system";
