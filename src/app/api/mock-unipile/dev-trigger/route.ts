import { type NextRequest, NextResponse } from "next/server";
import {
	DEV_TRIGGERS_ENABLED,
	triggerMockConversationBurst,
	triggerMockIncomingMessage,
} from "~/mocks/dev-triggers";

export async function POST(request: NextRequest) {
	// Guard against usage in non-development environments
	if (!DEV_TRIGGERS_ENABLED) {
		console.warn(
			"[Dev Trigger API] Attempted to use dev triggers in non-development environment",
		);
		return NextResponse.json(
			{ error: "Dev triggers not enabled" },
			{ status: 403 },
		);
	}

	try {
		const body = await request.json();
		const { action, chatId, accountId, customText, messageCount } = body;

		if (!action || !chatId || !accountId) {
			return NextResponse.json(
				{ error: "Missing required parameters: action, chatId, accountId" },
				{ status: 400 },
			);
		}

		console.log("[Dev Trigger API] Processing trigger:", {
			action,
			chatId,
			accountId,
		});

		let success = false;

		switch (action) {
			case "incoming_message":
				success = await triggerMockIncomingMessage(
					chatId,
					accountId,
					customText,
				);
				break;

			case "conversation_burst":
				success = await triggerMockConversationBurst(
					chatId,
					accountId,
					messageCount || 3,
				);
				break;

			default:
				return NextResponse.json(
					{ error: `Unknown action: ${action}` },
					{ status: 400 },
				);
		}

		if (success) {
			return NextResponse.json({
				status: "success",
				message: `${action} triggered successfully`,
				chatId,
				accountId,
			});
		}

		return NextResponse.json(
			{ error: `Failed to trigger ${action}` },
			{ status: 500 },
		);
	} catch (error) {
		console.error("[Dev Trigger API] Failed to process trigger:", error);

		return NextResponse.json(
			{
				error: "Failed to process dev trigger",
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
	if (!DEV_TRIGGERS_ENABLED) {
		return NextResponse.json(
			{ error: "Dev triggers not enabled" },
			{ status: 403 },
		);
	}

	return NextResponse.json({
		message: "Mock Unipile Dev Trigger Endpoint",
		status: "ready",
		actions: ["incoming_message", "conversation_burst"],
		timestamp: new Date().toISOString(),
	});
}
