"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Activity, TrendingUp } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
// Profile view row type that matches the data returned from the service
export type ProfileViewRow = {
	id: string;
	viewer_profile_id: string | null;
	viewer_name: string | null;
	viewer_headline: string | null;
	viewer_image_url: string | null;
	viewed_at: Date;
	provider: "linkedin" | "whatsapp" | "telegram" | "instagram" | "facebook";
	created_at: Date;
	visit_count: number;
	first_visit: Date | null;
	last_visit: Date | null;
	isRepeatVisitor: boolean;
	visitFrequency: "single" | "occasional" | "regular" | "frequent";
	trend: "new" | "returning" | "engaged";
	daysSinceFirst: number;
	daysSinceLast: number | null;
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

const getTrendBadge = (trend: string) => {
	switch (trend) {
		case "new":
			return (
				<Badge
					variant="secondary"
					className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
				>
					<Activity className="mr-1 h-3 w-3" />
					New
				</Badge>
			);
		case "returning":
			return (
				<Badge
					variant="secondary"
					className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
				>
					<TrendingUp className="mr-1 h-3 w-3" />
					Returning
				</Badge>
			);
		case "engaged":
			return (
				<Badge
					variant="secondary"
					className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
				>
					<TrendingUp className="mr-1 h-3 w-3" />
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
				<Badge
					variant="secondary"
					className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
				>
					Occasional ({visitCount}x)
				</Badge>
			);
		case "regular":
			return (
				<Badge
					variant="secondary"
					className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
				>
					Regular ({visitCount}x)
				</Badge>
			);
		case "frequent":
			return (
				<Badge
					variant="secondary"
					className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
				>
					Frequent ({visitCount}x)
				</Badge>
			);
		default:
			return <Badge variant="outline">{visitCount}x</Badge>;
	}
};

export const columns: ColumnDef<ProfileViewRow>[] = [
	{
		accessorKey: "viewer",
		header: "Viewer",
		cell: ({ row }) => {
			const viewer = row.original;
			return (
				<div className="flex items-center gap-3">
					<Avatar className="h-8 w-8">
						<AvatarImage
							src={viewer.viewer_image_url || undefined}
							alt={viewer.viewer_name || "Unknown viewer"}
						/>
						<AvatarFallback className="bg-muted text-xs">
							{getInitials(viewer.viewer_name)}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<p className="truncate font-medium text-sm">
							{viewer.viewer_name || "Anonymous Viewer"}
						</p>
						{viewer.viewer_profile_id && (
							<p className="truncate text-muted-foreground text-xs">
								ID: {viewer.viewer_profile_id.slice(0, 20)}...
							</p>
						)}
					</div>
				</div>
			);
		},
		size: 250,
	},
	{
		accessorKey: "viewer_headline",
		header: "Headline",
		cell: ({ row }) => {
			const headline = row.getValue("viewer_headline") as string | null;
			return (
				<div className="max-w-xs">
					<p className="truncate text-sm">
						{headline || "No headline available"}
					</p>
				</div>
			);
		},
		size: 200,
	},
	{
		accessorKey: "visitFrequency",
		header: "Visit Frequency",
		cell: ({ row }) => {
			const { visitFrequency, visit_count } = row.original;
			return getFrequencyBadge(visitFrequency, visit_count);
		},
		size: 150,
	},
	{
		accessorKey: "trend",
		header: "Trend",
		cell: ({ row }) => {
			const trend = row.getValue("trend") as string;
			return getTrendBadge(trend);
		},
		size: 120,
	},
	{
		accessorKey: "provider",
		header: "Provider",
		cell: ({ row }) => {
			const provider = row.getValue("provider") as string;
			return (
				<Badge variant="secondary" className="capitalize">
					{provider}
				</Badge>
			);
		},
		size: 100,
	},
	{
		accessorKey: "viewed_at",
		header: "Viewed At",
		cell: ({ row }) => {
			const viewedAt = row.getValue("viewed_at") as Date;
			return (
				<div className="text-sm">
					<p>{format(new Date(viewedAt), "MMM d, yyyy")}</p>
					<p className="text-muted-foreground text-xs">
						{format(new Date(viewedAt), "h:mm a")}
					</p>
				</div>
			);
		},
		size: 120,
	},
	{
		accessorKey: "visit_count",
		header: "Visits",
		cell: ({ row }) => {
			const visitCount = row.getValue("visit_count") as number;
			const { daysSinceFirst } = row.original;
			return (
				<div className="text-center">
					<p className="font-medium text-sm">{visitCount}</p>
					{visitCount > 1 && (
						<p className="text-muted-foreground text-xs">
							over {daysSinceFirst}d
						</p>
					)}
				</div>
			);
		},
		size: 80,
	},
];
