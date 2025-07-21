import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime";
import { servicesMiddleware } from "~/middleware/services.middleware";

// Create a client to send and receive events with realtime support and service injection
export const inngest = new Inngest({
	id: "linkedin-messages",
	middleware: [realtimeMiddleware(), servicesMiddleware()],
});
