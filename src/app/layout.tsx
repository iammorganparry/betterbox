import "~/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { OnboardingGuard } from "~/components/onboarding-guard";
import { Toaster } from "~/components/ui/sonner";
import { TRPCReactProvider } from "~/trpc/react";
import Providers from "./providers";

export const metadata: Metadata = {
	title: "betterbox",
	description: "betterbox",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<ClerkProvider>
			<html lang="en" className={`${geist.variable}`}>
				<body>
					<Providers>
						<TRPCReactProvider>
							<OnboardingGuard>{children}</OnboardingGuard>
						</TRPCReactProvider>
						<Toaster />
					</Providers>
				</body>
			</html>
		</ClerkProvider>
	);
}
