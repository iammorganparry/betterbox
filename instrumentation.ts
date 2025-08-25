/**
 * Next.js Instrumentation
 *
 * This file is called once when the Next.js server starts.
 * Perfect place to initialize Mock Service Worker for development.
 *
 * @see https://nextjs.org/docs/pages/guides/instrumentation
 */

export async function register() {
	// Only initialize MSW in server environments when mock mode is enabled
	if (
		process.env.NEXT_RUNTIME === "nodejs" &&
		process.env.USE_MOCK_UNIPILE === "1"
	) {
		console.log(
			"[Instrumentation] Initializing Mock Service Worker for development...",
		);

		// Dynamic import to avoid loading MSW in production
		const { server } = await import("./src/mocks/server");

		server.listen({
			onUnhandledRequest: "bypass",
		});

		console.log("[MSW] Mock Service Worker server started via instrumentation");
	}
}
