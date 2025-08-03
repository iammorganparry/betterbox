import type {
	UserTopics,
	MessageNewEvent,
	MessageSyncEvent,
	AccountStatusEvent,
	ProfileViewEvent,
	ContactUpdateEvent,
} from "~/types/realtime";

// Realtime publish event data schema
export interface RealtimePublishEventData {
	channel: string;
	topic: UserTopics;
	payload:
		| MessageNewEvent
		| MessageSyncEvent
		| AccountStatusEvent
		| ProfileViewEvent
		| ContactUpdateEvent;
}

// Realtime schemas for Inngest
export type RealtimeSchemas = {
	"realtime/publish": {
		data: RealtimePublishEventData;
	};
};
