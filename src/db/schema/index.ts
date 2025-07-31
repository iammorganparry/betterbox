// Export all enums
export * from './enums';

// Export all tables
export * from './tables';
export * from './tables2';

// Export all relations
export * from './relations';

// Re-export for convenience
import {
  posts,
  users,
  profiles,
  profileViews,
  messages,
  unipileAccounts,
  unipileChats,
  unipileContacts,
  chatFolders,
  chatFolderAssignments,
  unipileProfileViews,
  subscriptions,
  paymentMethods
} from './tables';

import {
  unipileChatAttendees,
  unipileMessages,
  unipileMessageAttachments
} from './tables2';

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
  paymentMethods
} as const;