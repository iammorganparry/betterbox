import { AppSidebar } from "~/components/app-sidebar";
import { SidebarProvider } from "~/components/ui/sidebar";
import { MessagesProvider } from "~/contexts/messages-context";

export default function AppLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<MessagesProvider>
			<SidebarProvider
				style={
					{
						"--sidebar-width": "350px",
					} as React.CSSProperties
				}
			>
				<AppSidebar>{children}</AppSidebar>
			</SidebarProvider>
		</MessagesProvider>
	);
}
