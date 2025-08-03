import { PricingTable } from "@clerk/nextjs";
import { AppHeader } from "~/components/app-header";
import { SidebarInset } from "~/components/ui/sidebar";

export default function PricingPage() {
	return (
		<SidebarInset>
			<AppHeader />
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8 text-center">
					<h1 className="mb-2 font-bold text-3xl tracking-tight">
						Choose Your Plan
					</h1>
					<p className="text-muted-foreground">
						Select the perfect plan for your LinkedIn messaging needs
					</p>
				</div>

				<div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 1rem" }}>
					<PricingTable />
				</div>
			</div>
		</SidebarInset>
	);
}
