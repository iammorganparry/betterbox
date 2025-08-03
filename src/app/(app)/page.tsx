import {
	SignInButton,
	SignUpButton,
	SignedIn,
	SignedOut,
	UserButton,
} from "@clerk/nextjs";
import Link from "next/link";

import { AppHeader } from "~/components/app-header";
import { SidebarInset } from "~/components/ui/sidebar";
import { HydrateClient, api } from "~/trpc/server";

export default async function Home() {
	return (
		<SidebarInset>
			<AppHeader />
			<HydrateClient>
				<main className="p-4">
					<div className="space-y-6">
						<div>
							<h1 className="font-bold text-3xl">Welcome Home</h1>
							<p className="text-muted-foreground">
								This is the home page with automatic breadcrumbs
							</p>
						</div>

						<div className="space-y-4">
							<SignedOut>
								<div className="flex gap-4">
									<SignInButton>
										<button
											type="button"
											className="rounded bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
										>
											Sign in
										</button>
									</SignInButton>
									<SignUpButton>
										<button
											type="button"
											className="rounded bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
										>
											Sign up
										</button>
									</SignUpButton>
								</div>
							</SignedOut>
							<SignedIn>
								<div className="flex items-center gap-4">
									<UserButton />
									<span>You are signed in!</span>
								</div>
							</SignedIn>
						</div>

						<div className="space-y-4">
							<h2 className="font-semibold text-xl">Navigation Examples</h2>
							<div className="flex flex-wrap gap-4">
								<Link
									href="/inbox"
									className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
								>
									Go to Inbox
								</Link>
								<Link
									href="/login"
									className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
								>
									Go to Login
								</Link>
								<Link
									href="/sign-up"
									className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
								>
									Go to Sign Up
								</Link>
							</div>
							<p className="text-muted-foreground text-sm">
								Click these links to see how the breadcrumbs automatically
								update based on the route
							</p>
						</div>
					</div>
				</main>
			</HydrateClient>
		</SidebarInset>
	);
}
