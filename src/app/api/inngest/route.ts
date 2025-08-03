import { serve } from "inngest/next";
import { inngest } from "~/services/inngest";
import {
	userCreated,
	userDeleted,
	userUpdated,
} from "~/services/inngest/clerk-sync";
import {
	unipileAccountConnected,
	unipileAccountDisconnected,
	unipileAccountStatusUpdate,
	unipileBulkMessageSync,
	unipileHistoricalMessageSync,
	unipileMessageReceived,
	unipileProfileView,
	unipileMessageDeleted,
	unipileMessageEdited,
	unipileMessageReaction,
	unipileMessageRead,
} from "~/services/inngest/unipile-sync";

// Create an API that serves all sync functions
export const { GET, POST, PUT } = serve({
	streaming: "allow",
	signingKey: process.env.INNGEST_SIGNING_KEY,
	client: inngest,
	functions: [
		// Clerk sync functions
		userCreated,
		userUpdated,
		userDeleted,
		// Unipile sync functions
		unipileAccountStatusUpdate,
		unipileMessageReceived,
		unipileProfileView,
		unipileHistoricalMessageSync,
		unipileBulkMessageSync,
		unipileAccountConnected,
		unipileAccountDisconnected,
		unipileMessageDeleted,
		unipileMessageEdited,
		unipileMessageReaction,
		unipileMessageRead,
	],
});
