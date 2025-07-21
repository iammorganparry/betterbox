import { type NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { inngest } from "~/services/inngest";

interface UnipileAccountData {
	account_id: string;
	provider: string;
	status?: string;
	user_identifier: string;
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();

		// Log the webhook data for debugging
		console.log("Unipile webhook received:", body);

		// Verify webhook signature if needed (Unipile specific)
		// const signature = headers().get("x-unipile-signature");
		// TODO: Add signature verification for production

		// Handle webhook events
		const { event, data } = body;

		switch (event) {
			case "account.connected":
			case "account.updated":
				await inngest.send({
					name: "unipile/account.connected",
					data: data,
				});
				break;

			case "account.disconnected":
				await inngest.send({
					name: "unipile/account.disconnected",
					data: data,
				});
				break;

			default:
				console.log(`Unhandled webhook event: ${event}`);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Webhook processing error:", error);
		return NextResponse.json(
			{ error: "Webhook processing failed" },
			{ status: 500 },
		);
	}
}
