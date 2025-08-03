import type { ClerkSchemas } from "./clerk";
import type { UnipileSchemas } from "./unipile";
import type { RealtimeSchemas } from "./realtime";

// Export individual schema types for easier access
export type { ClerkSchemas } from "./clerk";
export type { UnipileSchemas } from "./unipile";
export type { RealtimeSchemas } from "./realtime";

// Combined schemas type for Inngest
export type AppSchemas = ClerkSchemas & UnipileSchemas & RealtimeSchemas;
