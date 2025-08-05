import Link from "next/link";
import { AppHeader } from "~/components/app-header";
import { SidebarInset } from "~/components/ui/sidebar";

export default function DashboardPage() {
	return (
		<SidebarInset>
			<AppHeader />
			<main className="p-4">
				<div className="space-y-6">
					<div>
						<h1 className="font-bold text-3xl">Dashboard</h1>
						<p className="text-muted-foreground">
							This page demonstrates automatic breadcrumb generation
						</p>
					</div>

					<div className="space-y-4">
						<h2 className="font-semibold text-xl">Navigate to nested routes</h2>
						<div className="flex flex-wrap gap-4">
							<Link
								href="/dashboard/user-settings"
								className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
							>
								User Settings
							</Link>
							<Link
								href="/dashboard/profile-views"
								className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
							>
								Profile Views
							</Link>
							<Link
								href="/dashboard/api-keys"
								className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
							>
								API Keys
							</Link>
							<Link
								href="/dashboard/billing/invoices"
								className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
							>
								Billing Invoices
							</Link>
						</div>
						<p className="text-muted-foreground text-sm">
							Notice how the breadcrumbs will automatically update:
						</p>
						<ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
							<li>Home → Dashboard</li>
							<li>Home → Dashboard → User Settings</li>
							<li>Home → Dashboard → Profile Views</li>
							<li>Home → Dashboard → Api Keys</li>
							<li>Home → Dashboard → Billing → Invoices</li>
						</ul>
					</div>
				</div>
			</main>
		</SidebarInset>
	);
}
