"use client";

import {
	BarChart3,
	Calendar,
	Eye,
	Loader2,
	RefreshCw,
	Users,
} from "lucide-react";
import { useMemo } from "react";

import { AppHeader } from "~/components/app-header";
import { GoldProtection } from "~/components/billing-protection";
import { Badge } from "~/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { SidebarInset } from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

import { type ProfileViewRow, columns } from "./columns";
import { DataTable } from "./data-table";

export default function ProfileViewsPage() {
	// Fetch profile views with analytics
	const {
		data: profileViewsData,
		isLoading: profileViewsLoading,
		error: profileViewsError,
	} = api.inbox.getProfileViews.useQuery({
		limit: 1000, // Get more data for better table experience
		offset: 0,
	});

	// Fetch analytics summary
	const {
		data: analyticsData,
		isLoading: analyticsLoading,
		error: analyticsError,
	} = api.inbox.getProfileViewsAnalytics.useQuery();

	// Transform data for TanStack Table
	const tableData: ProfileViewRow[] = useMemo(() => {
		if (!profileViewsData?.profileViews) return [];

		return profileViewsData.profileViews.map((view) => ({
			id: view.id,
			viewer_profile_id: view.viewer_profile_id,
			viewer_name: view.viewer_name,
			viewer_headline: view.viewer_headline,
			viewer_image_url: view.viewer_image_url,
			viewed_at: new Date(view.viewed_at),
			provider: view.provider,
			created_at: new Date(view.created_at),
			visit_count: view.visit_count,
			first_visit: view.first_visit ? new Date(view.first_visit) : null,
			last_visit: view.last_visit ? new Date(view.last_visit) : null,
			isRepeatVisitor: view.isRepeatVisitor,
			visitFrequency: view.visitFrequency,
			trend: view.trend,
			daysSinceFirst: view.daysSinceFirst,
			daysSinceLast: view.daysSinceLast,
		}));
	}, [profileViewsData]);

	// Statistics derived from table data
	const tableStats = useMemo(() => {
		const totalViews = tableData.length;
		const uniqueViewers = new Set(
			tableData.map((view) => view.viewer_profile_id),
		).size;
		const repeatVisitors = tableData.filter(
			(view) => view.isRepeatVisitor,
		).length;
		const repeatVisitorRate =
			uniqueViewers > 0
				? ((repeatVisitors / uniqueViewers) * 100).toFixed(1)
				: "0";

		// Views in last 7 days
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		const recentViews = tableData.filter(
			(view) => new Date(view.viewed_at) > sevenDaysAgo,
		).length;

		return {
			totalViews,
			uniqueViewers,
			repeatVisitors,
			repeatVisitorRate,
			recentViews,
		};
	}, [tableData]);

	return (
		<SidebarInset>
			<AppHeader
				breadcrumbLabels={{
					"profile-views": "Profile Views",
				}}
			/>
			<GoldProtection>
				<main className="flex-1 space-y-6 p-6">
					{/* Header */}
					<div className="flex items-center gap-4">
						<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
							<Eye className="h-6 w-6 text-primary" />
						</div>
						<div>
							<h1 className="font-bold text-3xl">Profile Views</h1>
							<p className="text-muted-foreground">
								See who has viewed your LinkedIn profile with advanced analytics
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
											<p className="font-bold text-2xl">
												{tableStats.totalViews}
											</p>
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
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<BarChart3 className="h-5 w-5" />
										Profile Views Analytics
									</CardTitle>
									<CardDescription>
										Detailed breakdown of who viewed your profile with
										engagement insights
									</CardDescription>
								</div>
								<Badge variant="secondary" className="text-sm">
									{tableData.length} total views
								</Badge>
							</div>
						</CardHeader>
						<CardContent>
							{profileViewsLoading ? (
								<div className="flex h-64 items-center justify-center">
									<div className="text-center">
										<Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-primary" />
										<p className="text-muted-foreground text-sm">
											Loading profile views...
										</p>
									</div>
								</div>
							) : profileViewsError ? (
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
							) : tableData.length === 0 ? (
								<div className="flex h-64 items-center justify-center">
									<div className="text-center">
										<Eye className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
										<p className="font-medium">No profile views yet</p>
										<p className="text-muted-foreground text-sm">
											When people view your LinkedIn profile, they'll appear
											here
										</p>
									</div>
								</div>
							) : (
								<DataTable columns={columns} data={tableData} />
							)}
						</CardContent>
					</Card>
				</main>
			</GoldProtection>
		</SidebarInset>
	);
}
