import { env } from "~/env";
import { createUnipileClient } from "~/lib/http";

export interface LinkedInCredentials {
	username: string;
	password: string;
}

export interface LinkedInCookieAuth {
	access_token: string;
	user_agent: string;
}

export interface LinkedInAuthResponse {
	success: boolean;
	account_id?: string;
	status?: string;
	checkpoint_type?: string;
	checkpoint_id?: string;
	error?: string;
	message?: string;
}

export interface CheckpointResponse {
	success: boolean;
	account_id?: string;
	status?: string;
	error?: string;
	message?: string;
}

enum Provider {
	LINKEDIN = "LINKEDIN",
}

// Type for error responses from axios
type ErrorWithResponse = {
	response?: {
		data?: {
			message?: string;
		};
	};
	message?: string;
};

export class LinkedInAuthService {
	private unipileClient;

	constructor() {
		this.unipileClient = createUnipileClient(
			env.UNIPILE_API_KEY,
			env.UNIPILE_DSN,
		);
	}

	/**
	 * Authenticate LinkedIn account with username/password
	 */
	async authenticateWithCredentials(
		credentials: LinkedInCredentials,
	): Promise<LinkedInAuthResponse> {
		try {
			const response = await this.unipileClient.post("/accounts", {
				provider: "linkedin",
				username: credentials.username,
				password: credentials.password,
			});

			return {
				success: true,
				account_id: response.data.account_id,
				status: response.data.status,
				checkpoint_type: response.data.checkpoint_type,
				checkpoint_id: response.data.checkpoint_id,
			};
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const responseError = (error as ErrorWithResponse)?.response?.data
				?.message;
			return {
				success: false,
				error: responseError || errorMessage,
				message: "Failed to authenticate LinkedIn account",
			};
		}
	}

	/**
	 * Authenticate LinkedIn account with cookies (li_at token)
	 */
	async authenticateWithCookies(
		cookieAuth: LinkedInCookieAuth,
	): Promise<LinkedInAuthResponse> {
		try {
			console.log(
				`[LinkedInAuthService] Authenticating with cookies: ${cookieAuth.access_token}`,
			);
			const response = await this.unipileClient.post("/accounts", {
				provider: Provider.LINKEDIN,
				access_token: cookieAuth.access_token,
				user_agent: cookieAuth.user_agent,
			});

			console.log(
				`[LinkedInAuthService] Response: ${JSON.stringify(response.data)}`,
			);

			return {
				success: true,
				account_id: response.data.account_id,
				status: response.data.status,
				checkpoint_type: response.data.checkpoint_type,
				checkpoint_id: response.data.checkpoint_id,
			};
		} catch (error: unknown) {
			console.log(
				`[LinkedInAuthService] Error authenticating with cookies: ${error}`,
			);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const responseError = (error as ErrorWithResponse)?.response?.data
				?.message;
			return {
				success: false,
				error: responseError || errorMessage,
				message: "Failed to authenticate LinkedIn account with cookies",
			};
		}
	}

	/**
	 * Handle checkpoint resolution (2FA, OTP, CAPTCHA, etc.)
	 */
	async resolveCheckpoint(
		checkpointId: string,
		checkpointType: string,
		value: string,
	): Promise<CheckpointResponse> {
		try {
			const response = await this.unipileClient.post(
				`/accounts/checkpoints/${checkpointId}`,
				{
					type: checkpointType,
					value: value,
				},
			);

			return {
				success: true,
				account_id: response.data.account_id,
				status: response.data.status,
			};
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const responseError = (error as ErrorWithResponse)?.response?.data
				?.message;
			return {
				success: false,
				error: responseError || errorMessage,
				message: "Failed to resolve checkpoint",
			};
		}
	}

	/**
	 * Get account status
	 */
	async getAccountStatus(accountId: string) {
		try {
			const response = await this.unipileClient.get(`/accounts/${accountId}`);
			return {
				success: true,
				account: response.data,
			};
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const responseError = (error as ErrorWithResponse)?.response?.data
				?.message;
			return {
				success: false,
				error: responseError || errorMessage,
			};
		}
	}

	/**
	 * Disconnect LinkedIn account
	 */
	async disconnectAccount(accountId: string) {
		try {
			await this.unipileClient.delete(`/accounts/${accountId}`);
			return {
				success: true,
				message: "Account disconnected successfully",
			};
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const responseError = (error as ErrorWithResponse)?.response?.data
				?.message;
			return {
				success: false,
				error: responseError || errorMessage,
				message: "Failed to disconnect account",
			};
		}
	}

	/**
	 * Get checkpoint types and their descriptions
	 */
	getCheckpointTypeInfo(checkpointType: string) {
		const checkpointTypes: Record<
			string,
			{ title: string; description: string; inputType: string }
		> = {
			TWO_FACTOR_AUTH: {
				title: "Two-Factor Authentication",
				description: "Enter the 6-digit code from your authenticator app",
				inputType: "numeric",
			},
			CAPTCHA: {
				title: "Captcha Verification",
				description: "Complete the captcha to continue",
				inputType: "text",
			},
			PHONE_REGISTER: {
				title: "Phone Verification",
				description: "Enter your phone number for verification",
				inputType: "tel",
			},
			IN_APP_VALIDATION: {
				title: "LinkedIn App Verification",
				description:
					"Please approve the login request in your LinkedIn mobile app",
				inputType: "none",
			},
			EMAIL_VERIFICATION: {
				title: "Email Verification",
				description: "Enter the verification code sent to your email",
				inputType: "numeric",
			},
		};

		return (
			checkpointTypes[checkpointType] || {
				title: "Additional Verification",
				description: "Please complete the verification step",
				inputType: "text",
			}
		);
	}
}
