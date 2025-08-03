"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle, LinkedinIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "~/components/ui/input-otp";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";

// Types
type UnipileAccount = {
	id: string;
	account_id: string;
	status: string;
	is_deleted: boolean;
	created_at: Date | string;
	updated_at: Date | string;
	provider: string;
};

type AuthMethod = "credentials" | "cookies";

// Form schemas
const credentialsSchema = z.object({
	username: z.string().min(1, "Email is required"),
	password: z.string().min(1, "Password is required"),
});

const cookieSchema = z.object({
	access_token: z.string().min(1, "LinkedIn access token is required"),
});

const checkpointSchema = z.object({
	value: z.string().min(1, "Verification code is required"),
});

type CredentialsForm = z.infer<typeof credentialsSchema>;
type CookieForm = z.infer<typeof cookieSchema>;
type CheckpointForm = z.infer<typeof checkpointSchema>;

interface CheckpointInfo {
	checkpointId: string;
	checkpointType: string;
	title: string;
	description: string;
	inputType: string;
}

interface AuthResult {
	success: boolean;
	checkpoint_type?: string;
	checkpoint_id?: string;
	error?: string;
}

interface LinkedInConnectionCardProps {
	userId: string;
}

export function LinkedInConnectionCard({
	userId,
}: LinkedInConnectionCardProps) {
	const [authMethod, setAuthMethod] = useState<AuthMethod>("credentials");
	const [checkpointInfo, setCheckpointInfo] = useState<CheckpointInfo | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);

	// Data fetching
	const {
		data: accountsData,
		refetch: refetchAccounts,
		isLoading,
		error: fetchError,
	} = api.linkedin.getLinkedinAccount.useQuery(undefined, {
		retry: 3,
		retryDelay: 1000,
	});

	// Forms
	const credentialsForm = useForm<CredentialsForm>({
		resolver: zodResolver(credentialsSchema),
		defaultValues: { username: "", password: "" },
	});

	const cookieForm = useForm<CookieForm>({
		resolver: zodResolver(cookieSchema),
		defaultValues: { access_token: "" },
	});

	const checkpointForm = useForm<CheckpointForm>({
		resolver: zodResolver(checkpointSchema),
		defaultValues: { value: "" },
	});

	// Derived state
	const connectedAccount = accountsData?.accounts?.find(
		(account: UnipileAccount) =>
			account.status === "connected" && !account.is_deleted,
	);

	const isConnected = !!connectedAccount;
	const hasError = !!error || !!fetchError;
	const showCheckpoint = !!checkpointInfo;

	// Mutation success handler
	const handleAuthSuccess = (result: AuthResult) => {
		if (result?.success) {
			if (result.checkpoint_type && result.checkpoint_id) {
				// Handle checkpoint - set basic info, detailed info will be fetched separately
				setCheckpointInfo({
					checkpointId: result.checkpoint_id,
					checkpointType: result.checkpoint_type,
					title: "Verification Required",
					description: "Please enter the verification code",
					inputType: "text",
				});
			} else {
				// Success - reset state and refetch
				setCheckpointInfo(null);
				setError(null);
				credentialsForm.reset();
				cookieForm.reset();
				checkpointForm.reset();
				refetchAccounts();
			}
		} else {
			setError(result?.error || "Authentication failed");
		}
	};

	// Mutation error handler
	const handleAuthError = (error: { message?: string }) => {
		setError(error?.message || "An error occurred");
	};

	// Mutations
	const authenticateWithCredentials =
		api.linkedin.authenticateWithCredentials.useMutation({
			onSuccess: handleAuthSuccess,
			onError: handleAuthError,
		});

	const authenticateWithCookies =
		api.linkedin.authenticateWithCookies.useMutation({
			onSuccess: handleAuthSuccess,
			onError: handleAuthError,
		});

	const resolveCheckpoint = api.linkedin.resolveCheckpoint.useMutation({
		onSuccess: handleAuthSuccess,
		onError: handleAuthError,
	});

	const disconnect = api.linkedin.disconnect.useMutation({
		onSuccess: () => {
			setError(null);
			refetchAccounts();
		},
		onError: handleAuthError,
	});

	// Loading states
	const isAuthenticating =
		authenticateWithCredentials.isPending ||
		authenticateWithCookies.isPending ||
		resolveCheckpoint.isPending;

	const isDisconnecting = disconnect.isPending;

	// Event handlers
	const handleCredentialsAuth = (data: CredentialsForm) => {
		setError(null);
		authenticateWithCredentials.mutate(data);
	};

	const handleCookieAuth = (data: CookieForm) => {
		setError(null);
		authenticateWithCookies.mutate({
			access_token: data.access_token,
			user_agent: window.navigator.userAgent,
		});
	};

	const handleCheckpointResolution = (data: CheckpointForm) => {
		if (!checkpointInfo) return;
		setError(null);
		resolveCheckpoint.mutate({
			checkpointId: checkpointInfo.checkpointId,
			checkpointType: checkpointInfo.checkpointType,
			value: data.value,
		});
	};

	const handleDisconnect = () => {
		if (!connectedAccount) return;
		disconnect.mutate({ accountId: connectedAccount.account_id });
	};

	const clearError = () => setError(null);

	// Status badge
	const getStatusBadge = () => {
		if (isLoading) {
			return (
				<Badge variant="secondary">
					<Loader2 className="mr-1 h-3 w-3 animate-spin" />
					Loading...
				</Badge>
			);
		}

		if (isConnected) {
			return (
				<Badge variant="secondary" className="bg-green-100 text-green-800">
					<CheckCircle className="mr-1 h-3 w-3" />
					Connected
				</Badge>
			);
		}

		if (isAuthenticating || isDisconnecting) {
			return (
				<Badge variant="secondary">
					<Loader2 className="mr-1 h-3 w-3 animate-spin" />
					{isDisconnecting ? "Disconnecting..." : "Connecting..."}
				</Badge>
			);
		}

		if (showCheckpoint) {
			return (
				<Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
					<AlertCircle className="mr-1 h-3 w-3" />
					Verification Required
				</Badge>
			);
		}

		if (hasError) {
			return (
				<Badge variant="destructive">
					<AlertCircle className="mr-1 h-3 w-3" />
					Error
				</Badge>
			);
		}

		return <Badge variant="outline">Not Connected</Badge>;
	};

	const currentError = error || fetchError?.message;

	return (
		<Card className="!shadow-none">
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<div className="flex items-center rounded-full bg-blue-500 p-2">
						<LinkedinIcon className="h-8 w-8 text-white" />
					</div>
					{getStatusBadge()}
				</CardTitle>
				<CardDescription>
					{isLoading
						? "Checking connection status..."
						: isConnected
							? "Sync your LinkedIn messages and connections"
							: "Connect your LinkedIn account to start syncing messages"}
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Error Alert */}
				{currentError && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							{currentError}
							<Button
								variant="link"
								size="sm"
								className="ml-2 h-auto p-0 text-destructive underline"
								onClick={clearError}
							>
								Try again
							</Button>
						</AlertDescription>
					</Alert>
				)}

				{/* Loading State */}
				{isLoading && (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin" />
						<span className="ml-2 text-muted-foreground text-sm">
							Loading connection status...
						</span>
					</div>
				)}

				{/* Connected State */}
				{isConnected && connectedAccount && (
					<div className="space-y-4">
						<div className="rounded-lg bg-muted/50 p-4">
							<h4 className="mb-2 font-medium text-sm">Connected Account</h4>
							<div className="space-y-1 text-muted-foreground text-sm">
								<p>Account ID: {connectedAccount.account_id}</p>
								<p>
									Connected:{" "}
									{new Date(connectedAccount.created_at).toLocaleDateString()}
								</p>
								<p>Status: {connectedAccount.status}</p>
							</div>
						</div>
						<Button
							variant="outline"
							onClick={handleDisconnect}
							disabled={isDisconnecting}
						>
							{isDisconnecting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Disconnecting...
								</>
							) : (
								"Disconnect Account"
							)}
						</Button>
					</div>
				)}

				{/* Checkpoint Verification */}
				{showCheckpoint && checkpointInfo && (
					<Form {...checkpointForm}>
						<form
							onSubmit={checkpointForm.handleSubmit(handleCheckpointResolution)}
							className="space-y-4"
						>
							<div className="space-y-2">
								<h4 className="font-medium">{checkpointInfo.title}</h4>
								<p className="text-muted-foreground text-sm">
									{checkpointInfo.description}
								</p>
							</div>

							<FormField
								control={checkpointForm.control}
								name="value"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Verification Code</FormLabel>
										<FormControl>
											{checkpointInfo.inputType === "numeric" ? (
												<InputOTP maxLength={6} {...field}>
													<InputOTPGroup>
														<InputOTPSlot index={0} />
														<InputOTPSlot index={1} />
														<InputOTPSlot index={2} />
														<InputOTPSlot index={3} />
														<InputOTPSlot index={4} />
														<InputOTPSlot index={5} />
													</InputOTPGroup>
												</InputOTP>
											) : checkpointInfo.inputType === "none" ? (
												<div className="rounded-md bg-muted p-4 text-sm">
													Please check your LinkedIn mobile app and approve the
													login request.
												</div>
											) : (
												<Input
													type={checkpointInfo.inputType}
													placeholder="Enter verification code"
													{...field}
												/>
											)}
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							{checkpointInfo.inputType !== "none" && (
								<Button type="submit" disabled={isAuthenticating}>
									{isAuthenticating ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Verifying...
										</>
									) : (
										"Verify"
									)}
								</Button>
							)}
						</form>
					</Form>
				)}

				{/* Authentication Forms */}
				{!isConnected && !isLoading && !showCheckpoint && (
					<div className="space-y-4">
						{/* Auth Method Toggle */}
						<div className="flex items-center space-x-2">
							<Button
								variant={authMethod === "credentials" ? "default" : "outline"}
								size="sm"
								onClick={() => setAuthMethod("credentials")}
							>
								Username & Password
							</Button>
							<Button
								variant={authMethod === "cookies" ? "default" : "outline"}
								size="sm"
								onClick={() => setAuthMethod("cookies")}
							>
								Cookie Token
							</Button>
						</div>

						<Separator />

						{/* Credentials Form */}
						{authMethod === "credentials" && (
							<Form {...credentialsForm}>
								<form
									onSubmit={credentialsForm.handleSubmit(handleCredentialsAuth)}
									className="space-y-4"
								>
									<FormField
										control={credentialsForm.control}
										name="username"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Email</FormLabel>
												<FormControl>
													<Input
														type="email"
														placeholder="your.email@example.com"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={credentialsForm.control}
										name="password"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Password</FormLabel>
												<FormControl>
													<Input
														type="password"
														placeholder="Your LinkedIn password"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<Button
										type="submit"
										disabled={isAuthenticating}
										className="w-full"
									>
										{isAuthenticating ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Connecting...
											</>
										) : (
											"Connect LinkedIn"
										)}
									</Button>
								</form>
							</Form>
						)}

						{/* Cookie Form */}
						{authMethod === "cookies" && (
							<Form {...cookieForm}>
								<form
									onSubmit={cookieForm.handleSubmit(handleCookieAuth)}
									className="space-y-4"
								>
									<FormField
										control={cookieForm.control}
										name="access_token"
										render={({ field }) => (
											<FormItem>
												<FormLabel>LinkedIn Access Token</FormLabel>
												<FormControl>
													<Input
														type="text"
														placeholder="AQEDATXNiYMAAAGK..."
														{...field}
													/>
												</FormControl>
												<FormDescription>
													Open LinkedIn in your browser, go to DevTools →
													Application → Cookies, and copy the li_at value.
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<Button
										type="submit"
										disabled={isAuthenticating}
										className="w-full"
									>
										{isAuthenticating ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Connecting...
											</>
										) : (
											"Connect with Cookies"
										)}
									</Button>
								</form>
							</Form>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
