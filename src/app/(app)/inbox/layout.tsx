"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "~/components/app-header";
import InboxSidebar from "~/components/inbox-sidebar";
import { SidebarInset } from "~/components/ui/sidebar";

export default function InboxLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	// Don't show header for chat pages since they handle their own breadcrumbs
	const isChatPage = pathname.match(/^\/inbox\/[^\/]+$/);

	return (
		<>
			<InboxSidebar />
			<SidebarInset>
				{!isChatPage && (
					<AppHeader
						breadcrumbLabels={{
							inbox: "Inbox",
						}}
					/>
				)}
				{children}
			</SidebarInset>
		</>
	);
}
