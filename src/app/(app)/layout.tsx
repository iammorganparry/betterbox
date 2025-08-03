import { AppSidebar } from "~/components/app-sidebar";
import { SidebarProvider } from "~/components/ui/sidebar";

export default function AppLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<SidebarProvider
			style={
				{
					"--sidebar-width": "350px",
				} as React.CSSProperties
			}
		>
			<AppSidebar>{children}</AppSidebar>
		</SidebarProvider>
	);
}
