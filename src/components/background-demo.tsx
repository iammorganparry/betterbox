"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

/**
 * Demo component showing how the persistent gradient background
 * works throughout the app with frosted glass elements
 */
export function BackgroundDemo() {
	const [showContent, setShowContent] = React.useState(false);

	return (
		<div className="min-h-screen space-y-8 p-8">
			{/* Demo Header */}
			<div className="space-y-4 text-center">
				<h1 className="font-bold text-4xl">Persistent Background Demo</h1>
				<p className="mx-auto max-w-2xl text-muted-foreground">
					The subtle gradient orbs are now persistent throughout the entire app.
					They appear as a fixed background on the body element, creating a
					beautiful atmospheric effect behind all content.
				</p>
			</div>

			{/* Interactive Demo */}
			<div className="mx-auto max-w-4xl space-y-6">
				<Card className="p-6">
					<h2 className="mb-4 font-semibold text-2xl">Frosted Glass Cards</h2>
					<p className="mb-4 text-muted-foreground">
						These cards use the frosted glass effect with backdrop-blur,
						allowing the background gradients to show through beautifully.
					</p>
					<Button
						onClick={() => setShowContent(!showContent)}
						className="glass-subtle hover:glass transition-all duration-300"
					>
						{showContent ? "Hide" : "Show"} More Content
					</Button>
				</Card>

				{showContent && (
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						<Card className="p-6">
							<h3 className="mb-2 font-semibold text-lg">Dashboard</h3>
							<p className="text-muted-foreground text-sm">
								Main app dashboard with analytics and overview
							</p>
						</Card>

						<Card className="p-6">
							<h3 className="mb-2 font-semibold text-lg">Inbox</h3>
							<p className="text-muted-foreground text-sm">
								Message management and communication center
							</p>
						</Card>

						<Card className="p-6">
							<h3 className="mb-2 font-semibold text-lg">Settings</h3>
							<p className="text-muted-foreground text-sm">
								User preferences and configuration options
							</p>
						</Card>
					</div>
				)}

				{/* Background Information */}
				<Card className="glass-strong p-6">
					<h3 className="mb-4 font-semibold text-lg">
						Background Implementation
					</h3>
					<div className="space-y-3 text-muted-foreground text-sm">
						<div className="flex items-start gap-3">
							<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-pink-400" />
							<div>
								<strong className="text-foreground">Fixed Attachment:</strong>{" "}
								Background stays in place during scrolling
							</div>
						</div>
						<div className="flex items-start gap-3">
							<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-purple-400" />
							<div>
								<strong className="text-foreground">Global Coverage:</strong>{" "}
								Applied to body element for app-wide visibility
							</div>
						</div>
						<div className="flex items-start gap-3">
							<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" />
							<div>
								<strong className="text-foreground">
									Transparent Containers:
								</strong>{" "}
								Main content areas have transparent backgrounds
							</div>
						</div>
						<div className="flex items-start gap-3">
							<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
							<div>
								<strong className="text-foreground">Glass Effects:</strong>{" "}
								Frosted glass components enhance the background visibility
							</div>
						</div>
					</div>
				</Card>

				{/* Color Palette */}
				<Card className="p-6">
					<h3 className="mb-4 font-semibold text-lg">Gradient Color Palette</h3>
					<div className="grid grid-cols-3 gap-4">
						<div className="space-y-2 text-center">
							<div className="gradient-orb-pink h-16 w-full rounded-lg opacity-80" />
							<p className="font-medium text-sm">Pink Gradient</p>
							<p className="text-muted-foreground text-xs">
								Bottom left (20%, 80%)
							</p>
						</div>
						<div className="space-y-2 text-center">
							<div className="gradient-orb-purple h-16 w-full rounded-lg opacity-80" />
							<p className="font-medium text-sm">Purple Gradient</p>
							<p className="text-muted-foreground text-xs">
								Top right (80%, 20%)
							</p>
						</div>
						<div className="space-y-2 text-center">
							<div className="gradient-orb-blue h-16 w-full rounded-lg opacity-80" />
							<p className="font-medium text-sm">Blue Gradient</p>
							<p className="text-muted-foreground text-xs">Center (40%, 40%)</p>
						</div>
					</div>
				</Card>
			</div>

			{/* Utility Info */}
			<div className="mx-auto max-w-2xl">
				<Card className="glass-subtle p-6">
					<h3 className="mb-3 font-semibold">Available Utilities</h3>
					<div className="space-y-2 text-sm">
						<code className="rounded bg-muted px-2 py-1">.app-background</code>
						<span className="text-muted-foreground">
							{" "}
							- Apply background to any element
						</span>
						<br />
						<code className="rounded bg-muted px-2 py-1">.glass</code>
						<span className="text-muted-foreground">
							{" "}
							- Standard frosted glass effect
						</span>
						<br />
						<code className="rounded bg-muted px-2 py-1">.glass-strong</code>
						<span className="text-muted-foreground">
							{" "}
							- Enhanced glass effect
						</span>
						<br />
						<code className="rounded bg-muted px-2 py-1">.glass-subtle</code>
						<span className="text-muted-foreground"> - Light glass effect</span>
					</div>
				</Card>
			</div>
		</div>
	);
}
