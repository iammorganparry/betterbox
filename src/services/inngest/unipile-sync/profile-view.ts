import { unipileProfileViews } from "~/db/schema";
import { inngest } from "../../inngest";
import {
	createEnrichedContactFromSender,
	createUnipileService,
	getCurrentSyncConfig,
	normalizeProvider,
} from "./shared";

/**
 * Handle LinkedIn profile views from Unipile (real-time)
 */
export const unipileProfileView = inngest.createFunction(
	{ id: "unipile-profile-view" },
	{ event: "unipile/profile.view" },
	async ({ event, step, services }) => {
		const { data } = event;
		const syncConfig = getCurrentSyncConfig();

		const { account_id, provider = "linkedin", viewer, viewed_at } = data;
		const {
			unipileAccountService: accountService,
			unipileContactService: contactService,
		} = services;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await accountService.findUnipileAccountByProvider(
				account_id,
				provider,
				{ include_user: true },
			);
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		// Create the profile view record (keeping raw Prisma for this specific model)
		const profileView = await step.run("create-profile-view", async () => {
			return await services.db
				.insert(unipileProfileViews)
				.values({
					...data,
					user_id: unipileAccount.user_id,
					viewer_profile_id: viewer?.id,
					viewer_name: viewer?.display_name || viewer?.name,
					viewer_headline: viewer?.headline,
					viewer_image_url: viewer?.profile_picture_url || viewer?.avatar_url,
					viewed_at: viewed_at ? new Date(viewed_at) : new Date(),
					provider: normalizeProvider(provider),
				})
				.returning();
		});

		// Also upsert the viewer as a contact using enriched profile data
		if (viewer?.id) {
			await step.run("upsert-viewer-contact", async () => {
				// Create Unipile service instance for profile fetching if enabled
				if (!syncConfig.enableProfileEnrichment) {
					// Fallback to basic contact creation if profile enrichment is disabled
					return await contactService.upsertContact(
						unipileAccount.id,
						viewer.id,
						{
							full_name: viewer.display_name || viewer.name,
							first_name: viewer.first_name,
							last_name: viewer.last_name,
							headline: viewer.headline,
							profile_image_url:
								viewer.profile_picture_url || viewer.avatar_url,
							provider_url: viewer.profile_url,
							last_interaction: new Date(),
						},
					);
				}

				if (!process.env.UNIPILE_API_KEY || !process.env.UNIPILE_DSN) {
					throw new Error(
						"Unipile credentials missing but profile enrichment is enabled",
					);
				}

				const unipileService = createUnipileService({
					apiKey: process.env.UNIPILE_API_KEY,
					dsn: process.env.UNIPILE_DSN,
				});

				return await createEnrichedContactFromSender(
					unipileService,
					contactService,
					unipileAccount.id,
					account_id,
					viewer.id,
					viewer.display_name || viewer.name,
				);
			});
		}

		return { profileView, message: "Profile view recorded successfully" };
	},
);
