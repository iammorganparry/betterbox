import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		DATABASE_URL: z.string().url(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		CLERK_SECRET_KEY: z.string().min(1),
		UNIPILE_API_KEY: z.string().min(1),
		UNIPILE_DSN: z.string().min(1),
		UNIPILE_WEBHOOK_SECRET: z.string().optional(),
		STRIPE_SECRET_KEY: z.string().min(1),
		STRIPE_WEBHOOK_SECRET: z.string().optional(),

	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		NEXT_PUBLIC_STRIPE_PRO_PRODUCT_ID: z.string().min(1),
		NEXT_PUBLIC_STRIPE_STANDARD_PRODUCT_ID: z.string().min(1),
		NEXT_PUBLIC_STRIPE_STARTER_PRODUCT_ID: z.string().min(1),
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
		NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
		NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z.string().optional(),
		NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL: z.string().optional(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		DATABASE_URL: process.env.DATABASE_URL,
		NODE_ENV: process.env.NODE_ENV,
		CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
		UNIPILE_API_KEY: process.env.UNIPILE_API_KEY,
		UNIPILE_DSN: process.env.UNIPILE_DSN,
		UNIPILE_WEBHOOK_SECRET: process.env.UNIPILE_WEBHOOK_SECRET,
		STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
		STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
			process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
		NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
			process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
		NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL:
			process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
		NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL:
			process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL,
		NEXT_PUBLIC_STRIPE_PRO_PRODUCT_ID:
			process.env.NEXT_PUBLIC_STRIPE_PRO_PRODUCT_ID,
		NEXT_PUBLIC_STRIPE_STANDARD_PRODUCT_ID:
			process.env.NEXT_PUBLIC_STRIPE_STANDARD_PRODUCT_ID,
		NEXT_PUBLIC_STRIPE_STARTER_PRODUCT_ID:
			process.env.NEXT_PUBLIC_STRIPE_STARTER_PRODUCT_ID,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
