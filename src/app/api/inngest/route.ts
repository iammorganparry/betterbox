import { serve } from "inngest/next";
import { inngest } from "~/services/inngest";
import {
	userCreated,
	userUpdated,
	userDeleted,
} from "~/services/inngest/clerk-sync";
import {
	unipileAccountStatusUpdate,
	unipileNewMessage,
	unipileProfileView,
	unipileHistoricalMessageSync,
	unipileBulkMessageSync,
	unipileAccountConnected,
	unipileAccountDisconnected,
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
		unipileNewMessage,
		unipileProfileView,
		unipileHistoricalMessageSync,
		unipileBulkMessageSync,
		unipileAccountConnected,
		unipileAccountDisconnected,
	],
});
