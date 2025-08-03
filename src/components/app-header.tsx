"use client";

import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";

interface AppHeaderProps {
	/** Override breadcrumb labels for specific paths */
	breadcrumbLabels?: Record<string, string>;
	/** Custom className for the header */
	className?: string;
	/** Additional content to render in the header */
	children?: React.ReactNode;
}

// Default labels for common paths
const defaultBreadcrumbLabels: Record<string, string> = {
	"": "Home",
	inbox: "Inbox",
	login: "Login",
	"sign-up": "Sign Up",
	dashboard: "Dashboard",
	settings: "Settings",
	profile: "Profile",
};

/**
 * Formats a URL segment into a human-readable label
 * @param segment - The URL segment to format
 * @returns Formatted label
 *
 * @example
 * formatSegment("user-profile") // "User Profile"
 * formatSegment("[id]") // "ID"
 * formatSegment("my_settings") // "My Settings"
 */
function formatSegment(segment: string): string {
	// Handle dynamic routes [id], [slug], etc.
	if (segment.startsWith("[") && segment.endsWith("]")) {
		return segment.slice(1, -1).toUpperCase();
	}

	// Convert kebab-case and snake_case to Title Case
	return segment
		.split(/[-_]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * Generates breadcrumb items based on the current pathname
 * @param pathname - Current pathname from usePathname()
 * @param customLabels - Custom labels to override default formatting
 * @returns Array of breadcrumb items
 */
function generateBreadcrumbs(
	pathname: string,
	customLabels: Record<string, string> = {},
) {
	const labels = { ...defaultBreadcrumbLabels, ...customLabels };

	// Remove leading slash and split by slash
	const segments = pathname.split("/").filter(Boolean);

	// Always start with Home
	const breadcrumbs = [
		{
			label: labels[""] || "Home",
			href: "/",
			isLast: segments.length === 0,
		},
	];

	// Add breadcrumbs for each segment
	segments.forEach((segment, index) => {
		const href = `/${segments.slice(0, index + 1).join("/")}`;
		const isLast = index === segments.length - 1;

		// Use custom label if available, otherwise format the segment
		const label = labels[segment] || formatSegment(segment);

		breadcrumbs.push({
			label,
			href,
			isLast,
		});
	});

	return breadcrumbs;
}

/**
 * A reusable header component that automatically generates breadcrumbs based on the current route.
 *
 * Features:
 * - Automatically generates breadcrumbs from Next.js app router paths
 * - Supports custom labels for specific routes
 * - Includes sidebar trigger for responsive layouts
 * - Handles dynamic routes ([id], [slug], etc.)
 * - Converts kebab-case and snake_case to Title Case
 *
 * @example
 * ```tsx
 * // Basic usage - breadcrumbs will be auto-generated
 * <AppHeader />
 *
 * // With custom labels
 * <AppHeader
 *   breadcrumbLabels={{
 *     "user-settings": "User Settings",
 *     "api-keys": "API Keys"
 *   }}
 * />
 *
 * // With additional content
 * <AppHeader>
 *   <Button>Custom Action</Button>
 * </AppHeader>
 * ```
 *
 * @param breadcrumbLabels - Override default labels for specific path segments
 * @param className - Additional CSS classes
 * @param children - Additional content to render in the header
 */
export function AppHeader({
	breadcrumbLabels = {},
	className = "",
	children,
}: AppHeaderProps) {
	const pathname = usePathname();
	const breadcrumbs = generateBreadcrumbs(pathname, breadcrumbLabels);

	return (
		<header
			className={`sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4 ${className}`}
		>
			<SidebarTrigger className="-ml-1" />
			<Separator
				orientation="vertical"
				className="mr-2 data-[orientation=vertical]:h-4"
			/>
			<Breadcrumb className="flex-1">
				<BreadcrumbList>
					{breadcrumbs.map((breadcrumb, index) => (
						<Fragment key={breadcrumb.href}>
							<BreadcrumbItem className={index === 0 ? "hidden md:block" : ""}>
								{breadcrumb.isLast ? (
									<BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink href={breadcrumb.href}>
										{breadcrumb.label}
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
							{!breadcrumb.isLast && (
								<BreadcrumbSeparator
									className={index === 0 ? "hidden md:block" : ""}
								/>
							)}
						</Fragment>
					))}
				</BreadcrumbList>
			</Breadcrumb>
			{children}
		</header>
	);
}
