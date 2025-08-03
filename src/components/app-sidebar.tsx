"use client";

import { Command } from "lucide-react";
import type * as React from "react";

import Link from "next/link";
import { NavUser } from "~/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "~/components/ui/sidebar";
import { sidebarConfig } from "./config/sidebar";

export function AppSidebar({
	children,
	...props
}: React.ComponentProps<typeof Sidebar> & { children: React.ReactNode }) {
	const { setOpen } = useSidebar();

	return (
		<Sidebar
			collapsible="icon"
			className="w-screen overflow-hidden *:data-[sidebar=sidebar]:flex-row"
			{...props}
		>
			{/* This is the first sidebar */}
			{/* We disable collapsible and adjust width to icon. */}
			{/* This will make the sidebar appear as icons. */}
			<Sidebar
				collapsible="none"
				className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
			>
				<SidebarHeader>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
								<a href="/">
									<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
										<Command className="size-4" />
									</div>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">Acme Inc</span>
										<span className="truncate text-xs">Enterprise</span>
									</div>
								</a>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent className="px-1.5 md:px-0">
							<SidebarMenu>
								{sidebarConfig.map((item) => (
									<Link href={item.url} key={item.title}>
										<SidebarMenuItem key={item.title}>
											<SidebarMenuButton
												tooltip={{
													children: item.title,
													hidden: false,
												}}
												onClick={() => {
													setOpen(true);
												}}
												isActive={item.isActive}
												className="px-2.5 md:px-2"
											>
												<item.icon />
												<span>{item.title}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									</Link>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
				<SidebarFooter>
					<NavUser />
				</SidebarFooter>
			</Sidebar>
			{children}
		</Sidebar>
	);
}
