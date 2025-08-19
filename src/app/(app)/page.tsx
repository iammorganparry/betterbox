"use client";

import { Linkedin, Loader2, MessageCircle, RefreshCw, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { AppHeader } from "~/components/app-header";
import InboxSidebar from "~/components/inbox-sidebar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { SidebarInset } from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

export default function Home() {
	const [syncStatusPollingInterval, setSyncStatusPollingInterval] = useState<
		number | undefined
	>(5000);

	// Get sync status and account stats
	const { data: syncStatus, isLoading: syncStatusLoading } =
		api.inbox.getSyncStatus.useQuery(undefined, {
			refetchInterval: syncStatusPollingInterval,
		});
	const { data: accountStats, isLoading: statsLoading } =
		api.inbox.getAccountStats.useQuery();
	const { data: chatsData, isLoading: chatsLoading } =
		api.inbox.getChats.useQuery({ limit: 1 });

	// Check if any account is syncing
	const syncingAccount = syncStatus?.find(
		(account) => account.status === "syncing",
	);
	const isSyncing = Boolean(syncingAccount);
	const hasChats = Boolean(chatsData?.chats?.length);

	// Stop polling when no accounts are syncing
	useEffect(() => {
		if (!isSyncing) {
			setSyncStatusPollingInterval(undefined);
		} else {
			setSyncStatusPollingInterval(5000);
		}
	}, [isSyncing]);

	// Loading state
	if (syncStatusLoading || statsLoading || chatsLoading) {
		return (
			<>
				<InboxSidebar />
				<SidebarInset>
					<AppHeader
						breadcrumbLabels={{
							inbox: "Inbox",
						}}
					/>
					<div className="flex h-full flex-col">
						<div className="flex h-full items-center justify-center">
							<div className="w-full max-w-md space-y-4">
								<Skeleton className="mx-auto h-16 w-16 rounded-full" />
								<Skeleton className="mx-auto h-4 w-48" />
								<Skeleton className="mx-auto h-3 w-64" />
							</div>
						</div>
					</div>
				</SidebarInset>
			</>
		);
	}

	// Syncing state
	if (isSyncing && syncingAccount) {
		const progress = syncingAccount.sync_progress as any;
		const progressPercentage = progress?.total_chats
			? Math.round((progress.chats_processed / progress.total_chats) * 100)
			: 0;

		return (
			<>
				<InboxSidebar />
				<SidebarInset>
					<AppHeader
						breadcrumbLabels={{
							inbox: "Inbox",
						}}
					/>
					<div className="flex h-full flex-col">
						<div className="flex h-full items-center justify-center">
							<Card className="w-full max-w-md">
								<CardHeader className="text-center">
									<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 backdrop-blur-sm">
										<RefreshCw className="h-8 w-8 animate-spin text-primary" />
									</div>
									<CardTitle className="text-xl">
										Syncing Your LinkedIn Inbox
									</CardTitle>
									<CardDescription>
										We're importing your conversations and contacts. This may
										take a few minutes.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-6">
									{/* Progress Bar */}
									<div className="space-y-2">
										<div className="flex justify-between text-sm">
											<span className="text-muted-foreground">Progress</span>
											<span className="font-medium">{progressPercentage}%</span>
										</div>
										<Progress value={progressPercentage} className="h-2" />
									</div>

									{/* Stats */}
									{progress && (
										<div className="grid grid-cols-3 gap-4 text-center">
											<div className="space-y-1">
												<div className="font-semibold text-lg">
													{progress.chats_processed || 0}
												</div>
												<div className="text-muted-foreground text-xs">
													Chats
												</div>
											</div>
											<div className="space-y-1">
												<div className="font-semibold text-lg">
													{progress.messages_processed || 0}
												</div>
												<div className="text-muted-foreground text-xs">
													Messages
												</div>
											</div>
											<div className="space-y-1">
												<div className="font-semibold text-lg">
													{progress.attendees_processed || 0}
												</div>
												<div className="text-muted-foreground text-xs">
													Contacts
												</div>
											</div>
										</div>
									)}

									{/* Current Step */}
									{progress?.current_step && (
										<div className="glass-subtle rounded-lg p-3 text-center">
											<p className="text-sm">{progress.current_step}</p>
										</div>
									)}

									{/* Provider Icon */}
									<div className="flex items-center justify-center space-x-2 text-primary">
										<Linkedin className="h-5 w-5" />
										<span className="font-medium text-sm">LinkedIn</span>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				</SidebarInset>
			</>
		);
	}

	// Empty state (no chats)
	if (!hasChats) {
		return (
			<>
				<InboxSidebar />
				<SidebarInset>
					<AppHeader
						breadcrumbLabels={{
							inbox: "Inbox",
						}}
					/>
					<div className="flex h-full flex-col">
						<div className="flex h-full items-center justify-center">
							<Card className="w-full max-w-md">
								<CardHeader className="text-center">
									<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/20 backdrop-blur-sm">
										<MessageCircle className="h-8 w-8 text-muted-foreground" />
									</div>
									<CardTitle className="text-xl">Your Inbox is Empty</CardTitle>
									<CardDescription>
										{accountStats?.syncingAccounts
											? "We're still syncing your messages. Check back in a few minutes."
											: accountStats?.connectedAccounts
												? "No conversations found. Start a conversation on LinkedIn to see it here."
												: "Connect your LinkedIn account to start syncing your messages."}
									</CardDescription>
								</CardHeader>
								<CardContent className="text-center">
									{accountStats && (
										<div className="space-y-4">
											{/* Account Stats */}
											<div className="grid grid-cols-2 gap-4 text-center">
												<div className="space-y-1">
													<div className="font-semibold text-lg">
														{accountStats.connectedAccounts}
													</div>
													<div className="text-muted-foreground text-xs">
														Connected
													</div>
												</div>
												<div className="space-y-1">
													<div className="font-semibold text-lg">
														{accountStats.totalAccounts}
													</div>
													<div className="text-muted-foreground text-xs">
														Total Accounts
													</div>
												</div>
											</div>

											{/* Status */}
											{accountStats.syncingAccounts > 0 && (
												<div className="flex items-center justify-center space-x-2 text-primary">
													<Loader2 className="h-4 w-4 animate-spin" />
													<span className="text-sm">
														Syncing in progress...
													</span>
												</div>
											)}
										</div>
									)}
								</CardContent>
							</Card>
						</div>
					</div>
				</SidebarInset>
			</>
		);
	}

	// Default state (select conversation)
	return (
		<>
			<InboxSidebar />
			<SidebarInset>
				<AppHeader
					breadcrumbLabels={{
						inbox: "Inbox",
					}}
				/>
				<div className="flex h-full flex-col">
					<div className="flex h-full items-center justify-center">
						<Card className="w-full max-w-md">
							<CardHeader className="text-center">
								<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/20 backdrop-blur-sm">
									<MessageCircle className="h-8 w-8 text-muted-foreground" />
								</div>
								<CardTitle className="text-xl">Select a Conversation</CardTitle>
								<CardDescription>
									Choose a chat from your inbox to view and respond to messages
								</CardDescription>
							</CardHeader>
							<CardContent className="text-center">
								{accountStats && (
									<div className="space-y-4">
										{/* Quick Stats */}
										<div className="grid grid-cols-2 gap-4 text-center">
											<div className="space-y-1">
												<div className="font-semibold text-lg">
													{chatsData?.chats?.length || 0}
												</div>
												<div className="text-muted-foreground text-xs">
													Conversations
												</div>
											</div>
											<div className="space-y-1">
												<div className="font-semibold text-lg">
													{accountStats.connectedAccounts}
												</div>
												<div className="text-muted-foreground text-xs">
													Connected
												</div>
											</div>
										</div>

										{/* Tip */}
										<div className="glass-subtle rounded-lg p-3">
											<div className="flex items-center justify-center space-x-2 text-primary">
												<Zap className="h-4 w-4" />
												<span className="font-medium text-sm">
													Tip: Use the sidebar to browse conversations
												</span>
											</div>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</SidebarInset>
		</>
	);
}
