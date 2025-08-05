"use client";

import { format } from "date-fns";
import {
	Activity,
	BarChart3,
	Calendar,
	Eye,
	RefreshCw,
	TrendingDown,
	TrendingUp,
	User,
	Users,
} from "lucide-react";
import { useState } from "react";
import { AppHeader } from "~/components/app-header";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { SidebarInset } from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";

export default function ProfileViewsPage() {
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 20;
	const offset = (currentPage - 1) * itemsPerPage;

	// Fetch profile views
	const {
		data: profileViewsData,
		isLoading,
		error,
	} = api.inbox.getProfileViews.useQuery({
		limit: itemsPerPage,
		offset,
	});

	// Fetch analytics
	const {
		data: analyticsData,
		isLoading: analyticsLoading,
		error: analyticsError,
	} = api.inbox.getProfileViewsAnalytics.useQuery();

	const profileViews = profileViewsData?.profileViews || [];
	const totalCount = profileViewsData?.totalCount || 0;
	const hasMore = profileViewsData?.hasMore || false;
	const totalPages = Math.ceil(totalCount / itemsPerPage);

	const handlePreviousPage = () => {
		setCurrentPage((prev) => Math.max(prev - 1, 1));
	};

	const handleNextPage = () => {
		setCurrentPage((prev) => (hasMore ? prev + 1 : prev));
	};

	const getInitials = (name: string | null) => {
		if (!name) return "?";
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	const formatViewedAt = (date: Date) => {
		return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
	};

	// Helper functions for rendering badges and trends
	const getTrendBadge = (trend: string) => {
		switch (trend) {
			case "new":
				return (
					<Badge variant="secondary" className="bg-blue-100 text-blue-800">
						New
					</Badge>
				);
			case "returning":
				return (
					<Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
						Returning
					</Badge>
				);
			case "engaged":
				return (
					<Badge variant="secondary" className="bg-green-100 text-green-800">
						Engaged
					</Badge>
				);
			default:
				return <Badge variant="outline">Unknown</Badge>;
		}
	};

	const getFrequencyBadge = (frequency: string, visitCount: number) => {
		switch (frequency) {
			case "single":
				return <Badge variant="outline">Single Visit</Badge>;
			case "occasional":
				return (
					<Badge variant="secondary" className="bg-orange-100 text-orange-800">
						Occasional ({visitCount}x)
					</Badge>
				);
			case "regular":
				return (
					<Badge variant="secondary" className="bg-purple-100 text-purple-800">
						Regular ({visitCount}x)
					</Badge>
				);
			case "frequent":
				return (
					<Badge variant="secondary" className="bg-red-100 text-red-800">
						Frequent ({visitCount}x)
					</Badge>
				);
			default:
				return <Badge variant="outline">{visitCount}x</Badge>;
		}
	};

	return (
		<SidebarInset>
			<AppHeader
				breadcrumbLabels={{
					"profile-views": "Profile Views",
				}}
			/>
			<main className="flex-1 space-y-6 p-6">
				{/* Header */}
				<div className="flex items-center gap-4">
					<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
						<Eye className="h-6 w-6 text-primary" />
					</div>
					<div>
						<h1 className="font-bold text-3xl">Profile Views</h1>
						<p className="text-muted-foreground">
							See who has viewed your LinkedIn profile
						</p>
					</div>
				</div>

				{/* Analytics Cards */}
				{analyticsLoading ? (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{[...Array(4)].map((_, i) => (
							<Card key={`analytics-skeleton-${i}`}>
								<CardContent className="p-6">
									<Skeleton className="mb-2 h-4 w-20" />
									<Skeleton className="h-8 w-16" />
								</CardContent>
							</Card>
						))}
					</div>
				) : analyticsData ? (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<Card>
							<CardContent className="p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium text-muted-foreground text-sm">
											Total Views
										</p>
										<p className="font-bold text-2xl">
											{analyticsData.totalViews}
										</p>
									</div>
									<Eye className="h-8 w-8 text-blue-600" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium text-muted-foreground text-sm">
											Last 30 Days
										</p>
										<p className="font-bold text-2xl">
											{analyticsData.viewsLast30Days}
										</p>
									</div>
									<Calendar className="h-8 w-8 text-green-600" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium text-muted-foreground text-sm">
											Unique Viewers
										</p>
										<p className="font-bold text-2xl">
											{analyticsData.uniqueViewers}
										</p>
									</div>
									<Users className="h-8 w-8 text-purple-600" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium text-muted-foreground text-sm">
											Repeat Visitors
										</p>
										<p className="font-bold text-2xl">
											{analyticsData.repeatVisitors}
										</p>
										<p className="text-muted-foreground text-xs">
											{analyticsData.repeatVisitorRate}% of viewers
										</p>
									</div>
									<RefreshCw className="h-8 w-8 text-orange-600" />
								</div>
							</CardContent>
						</Card>
					</div>
				) : (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<Card>
							<CardContent className="p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium text-muted-foreground text-sm">
											Total Views
										</p>
										<p className="font-bold text-2xl">{totalCount}</p>
									</div>
									<Eye className="h-8 w-8 text-blue-600" />
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-6">
								<div className="text-center text-muted-foreground">
									Analytics loading...
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-6">
								<div className="text-center text-muted-foreground">
									Analytics loading...
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-6">
								<div className="text-center text-muted-foreground">
									Analytics loading...
								</div>
							</CardContent>
						</Card>
					</div>
				)}

				{/* Profile Views Table */}
				<Card>
					<CardHeader>
						<CardTitle>Profile Views</CardTitle>
						<CardDescription>
							{totalCount > 0
								? `Showing ${offset + 1}-${Math.min(offset + itemsPerPage, totalCount)} of ${totalCount} profile views`
								: "No profile views yet"}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="flex h-64 items-center justify-center">
								<div className="text-center">
									<div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
									<p className="text-muted-foreground text-sm">
										Loading profile views...
									</p>
								</div>
							</div>
						) : error ? (
							<div className="flex h-64 items-center justify-center">
								<div className="text-center">
									<p className="font-medium text-destructive">
										Failed to load profile views
									</p>
									<p className="text-muted-foreground text-sm">
										Please try again later
									</p>
								</div>
							</div>
						) : profileViews.length === 0 ? (
							<div className="flex h-64 items-center justify-center">
								<div className="text-center">
									<Eye className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
									<p className="font-medium">No profile views yet</p>
									<p className="text-muted-foreground text-sm">
										When people view your LinkedIn profile, they'll appear here
									</p>
								</div>
							</div>
						) : (
							<>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Viewer</TableHead>
											<TableHead>Headline</TableHead>
											<TableHead>Visit Frequency</TableHead>
											<TableHead>Trend</TableHead>
											<TableHead>Provider</TableHead>
											<TableHead>Viewed At</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{profileViews.map((view) => (
											<TableRow key={view.id}>
												<TableCell>
													<div className="flex items-center gap-3">
														<Avatar className="h-8 w-8">
															<AvatarImage
																src={view.viewer_image_url || undefined}
																alt={view.viewer_name || "Unknown viewer"}
															/>
															<AvatarFallback className="bg-muted text-xs">
																{getInitials(view.viewer_name)}
															</AvatarFallback>
														</Avatar>
														<div className="min-w-0 flex-1">
															<p className="font-medium text-sm">
																{view.viewer_name || "Anonymous Viewer"}
															</p>
															{view.viewer_profile_id && (
																<p className="text-muted-foreground text-xs">
																	ID: {view.viewer_profile_id.slice(0, 20)}...
																</p>
															)}
														</div>
													</div>
												</TableCell>
												<TableCell>
													<p className="max-w-xs truncate text-sm">
														{view.viewer_headline || "No headline available"}
													</p>
												</TableCell>
												<TableCell>
													{getFrequencyBadge(
														view.visitFrequency,
														view.visit_count,
													)}
												</TableCell>
												<TableCell>{getTrendBadge(view.trend)}</TableCell>
												<TableCell>
													<Badge variant="secondary" className="capitalize">
														{view.provider}
													</Badge>
												</TableCell>
												<TableCell>
													<p className="text-sm">
														{formatViewedAt(view.viewed_at)}
													</p>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>

								{/* Pagination */}
								{totalPages > 1 && (
									<div className="flex items-center justify-between border-t pt-4">
										<div className="text-muted-foreground text-sm">
											Page {currentPage} of {totalPages}
										</div>
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={handlePreviousPage}
												disabled={currentPage === 1}
											>
												Previous
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={handleNextPage}
												disabled={!hasMore}
											>
												Next
											</Button>
										</div>
									</div>
								)}
							</>
						)}
					</CardContent>
				</Card>
			</main>
		</SidebarInset>
	);
}
