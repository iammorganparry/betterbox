import { type NextRequest, NextResponse } from "next/server";
import { inngest } from "~/services/inngest";

// Check if mock mode is enabled
const MOCK_ENABLED = process.env.USE_MOCK_UNIPILE === "1";

export async function POST(request: NextRequest) {
	// Guard against accidental usage in production
	if (!MOCK_ENABLED) {
		console.warn(
			"[Mock Webhook] Attempted to use mock webhook in non-mock environment",
		);
		return NextResponse.json(
			{ error: "Mock webhook not enabled" },
			{ status: 403 },
		);
	}

	try {
		const body = await request.json();
		const { event, data } = body;

		if (!event || !data) {
			console.error("[Mock Webhook] Invalid webhook payload:", { event, data });
			return NextResponse.json(
				{ error: "Invalid webhook payload. Expected { event, data }" },
				{ status: 400 },
			);
		}

		console.log("[Mock Webhook] Received webhook:", {
			event,
			dataKeys: Object.keys(data),
		});

		// Forward the event to Inngest
		const result = await inngest.send({
			name: event,
			data,
		});

		console.log("[Mock Webhook] Successfully forwarded to Inngest:", {
			event,
			inngestResult: result,
		});

		return NextResponse.json({
			status: "success",
			message: "Webhook forwarded to Inngest",
			event,
		});
	} catch (error) {
		console.error("[Mock Webhook] Failed to process webhook:", error);

		return NextResponse.json(
			{
				error: "Failed to process webhook",
				message: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}

// Handle preflight requests for CORS
export async function OPTIONS() {
	return new NextResponse(null, {
		status: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
}

// Log any other methods for debugging
export async function GET() {
	if (!MOCK_ENABLED) {
		return NextResponse.json(
			{ error: "Mock webhook not enabled" },
			{ status: 403 },
		);
	}

	return NextResponse.json({
		message: "Mock Unipile Webhook Endpoint",
		status: "ready",
		timestamp: new Date().toISOString(),
	});
}
