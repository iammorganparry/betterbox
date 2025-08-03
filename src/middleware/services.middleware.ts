import type { Database } from "~/db";
import { db } from "~/db";
import { ChatFolderService } from "~/services/db/chat-folder.service";
import { UnipileAccountService } from "~/services/db/unipile-account.service";
import { UnipileChatService } from "~/services/db/unipile-chat.service";
import { UnipileContactService } from "~/services/db/unipile-contact.service";
import { UnipileMessageService } from "~/services/db/unipile-message.service";
import { UserService } from "~/services/db/user.service";

import { InngestMiddleware } from "inngest";
import { RealtimeService } from "~/services/realtime.service";

/**
 * Services that will be injected into Inngest functions
 */
export interface Services {
	db: Database;
	userService: UserService;
	unipileAccountService: UnipileAccountService;
	unipileChatService: UnipileChatService;
	unipileMessageService: UnipileMessageService;
	unipileContactService: UnipileContactService;
	chatFolderService: ChatFolderService;

	realtimeService: RealtimeService;
}

/**
 * Initialize services with database dependency injection
 */
function createServices(database: Database): Services {
	return {
		db: database,
		userService: new UserService(database),
		unipileAccountService: new UnipileAccountService(database),
		unipileChatService: new UnipileChatService(database),
		unipileMessageService: new UnipileMessageService(database),
		unipileContactService: new UnipileContactService(database),
		chatFolderService: new ChatFolderService(database),

		realtimeService: new RealtimeService(),
	};
}

/**
 * Creates services middleware for Inngest
 *
 * Usage:
 * ```typescript
 * const inngest = new Inngest({
 *   id: "my-app",
 *   middleware: [servicesMiddleware()]
 * });
 *
 * export const myFunction = inngest.createFunction(
 *   { id: "my-function" },
 *   { event: "my/event" },
 *   async ({ event, step, ctx }) => {
 *     const user = await ctx.services.userService.findById(event.data.userId);
 *     // ... use other services
 *   }
 * );
 * ```
 */

export function servicesMiddleware(options: { db?: Database } = {}) {
	const database = options.db || db;
	const services = createServices(database);

	return new InngestMiddleware({
		name: "Services Middleware",
		init() {
			return {
				onFunctionRun() {
					return {
						transformInput({ ctx }: { ctx: Record<string, unknown> }) {
							return {
								ctx: {
									...ctx,
									services,
								},
							};
						},
					};
				},
			};
		},
	});
}

/**
 * Default services middleware instance
 * Uses the default database connection
 */
export const defaultServicesMiddleware = servicesMiddleware();
