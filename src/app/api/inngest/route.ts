import { serve } from "inngest/next";
import { inngest } from "~/services/inngest";
import {
	userCreated,
	userDeleted,
	userUpdated,
} from "~/services/inngest/clerk-sync";
import {
	scheduleProfileViewsSync,
	syncProfileViewsForAllUsers,
} from "~/services/inngest/profile-views-sync";
import {
	unipileAccountConnected,
	unipileAccountDisconnected,
	unipileAccountStatusUpdate,
	unipileBulkMessageSync,
	unipileHistoricalMessageSync,
	unipileMessageDeleted,
	unipileMessageEdited,
	unipileMessageReaction,
	unipileMessageRead,
	unipileMessageReceived,
	unipileProfileView,
} from "~/services/inngest/unipile-sync/index";

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
		// Profile views sync functions
		scheduleProfileViewsSync,
		syncProfileViewsForAllUsers,
	],
});
