"use client";

import { ProgressProvider } from "@bprogress/next/app";
import { useEffect } from "react";

const Providers = ({ children }: { children: React.ReactNode }) => {
	// Initialize Mock Service Worker in browser when enabled
	useEffect(() => {
		if (
			process.env.NEXT_PUBLIC_USE_MOCK_UNIPILE === "1" &&
			typeof window !== "undefined"
		) {
			console.log("[MSW] Initializing Mock Service Worker...");

			import("~/mocks/browser").then(({ startMockServiceWorker }) => {
				startMockServiceWorker().catch(console.error);
			});
		}
	}, []);

	return (
		<ProgressProvider
			height="4px"
			color="#2563eb"
			options={{ showSpinner: false }}
			shallowRouting
		>
			{children}
		</ProgressProvider>
	);
};

export default Providers;
