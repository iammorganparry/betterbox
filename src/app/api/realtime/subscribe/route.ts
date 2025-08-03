import { auth } from "@clerk/nextjs/server";
import { getSubscriptionToken } from "@inngest/realtime";
import { type NextRequest, NextResponse } from "next/server";
import { inngest } from "~/services/inngest";
import type {
	SubscriptionTokenRequest,
	SubscriptionTokenResponse,
	UserTopics,
} from "~/types/realtime";
import { getUserChannelId } from "~/types/realtime";

export async function POST(request: NextRequest) {
	try {
		// Check authentication
		const authResult = await auth();
		if (!authResult.userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Parse request body
		const body = (await request.json()) as SubscriptionTokenRequest;
		const { user_id, topics } = body;

		// Verify the user can only subscribe to their own channel
		if (user_id !== authResult.userId) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		// Default topics if none specified
		const defaultTopics: UserTopics[] = [
			"messages:new",
			"messages:sync",
			"profile:view",
			"account:status",
			"contacts:update",
		];

		const subscribedTopics = topics || defaultTopics;
		const channel = getUserChannelId(user_id);

		// Generate subscription token (expires in 1 minute)
		const token = await getSubscriptionToken(inngest, {
			channel,
			topics: subscribedTopics,
		});

		const response: SubscriptionTokenResponse = {
			token,
			channel,
			topics: subscribedTopics,
			expires_at: new Date(Date.now() + 60 * 1000).toISOString(), // 1 minute from now
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error("Failed to generate subscription token:", error);
		return NextResponse.json(
			{ error: "Failed to generate subscription token" },
			{ status: 500 },
		);
	}
}

// OPTIONS for CORS
export async function OPTIONS() {
	return NextResponse.json(
		{},
		{
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
			},
		},
	);
}
