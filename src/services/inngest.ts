import { EventSchemas, Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime";
import { servicesMiddleware } from "~/middleware/services.middleware";
import type { AppSchemas } from "./inngest/schemas";

// Create a client to send and receive events with realtime support and service injection
export const inngest = new Inngest({
	id: "linkedin-messages",
	schemas: new EventSchemas().fromRecord<AppSchemas>(),
	middleware: [realtimeMiddleware(), servicesMiddleware()],
});
