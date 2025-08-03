// Export all enums
export * from "./enums";

// Export all tables
export * from "./tables";
export * from "./tables2";

// Export all relations
export * from "./relations";

// Re-export for convenience
import {
	messages,
	posts,
	profileViews,
	profiles,
	unipileAccounts,
	unipileChats,
	unipileContacts,
	users,
} from "./tables";

import {
	chatFolderAssignments,
	chatFolders,
	paymentMethods,
	subscriptions,
	unipileChatAttendees,
	unipileMessageAttachments,
	unipileMessages,
	unipileProfileViews,
} from "./tables2";

export const schema = {
	// Basic tables
	posts,
	users,
	profiles,
	profileViews,
	messages,

	// Unipile tables
	unipileAccounts,
	unipileChats,
	unipileContacts,
	unipileChatAttendees,
	unipileMessages,
	unipileMessageAttachments,
	unipileProfileViews,

	// Organization tables
	chatFolders,
	chatFolderAssignments,

	// Subscription tables
	subscriptions,
	paymentMethods,
} as const;
