"use client";

import { useRouter } from "@bprogress/next";
import { useSignUp } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "~/components/ui/input-otp";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

const signUpSchema = z.object({
	firstName: z
		.string()
		.min(1, "First name is required")
		.min(2, "First name must be at least 2 characters"),
	lastName: z
		.string()
		.min(1, "Last name is required")
		.min(2, "Last name must be at least 2 characters"),
	email: z.string().min(1, "Email is required").email("Invalid email address"),
	password: z
		.string()
		.min(1, "Password is required")
		.min(8, "Password must be at least 8 characters"),
});

const verificationSchema = z.object({
	code: z
		.string()
		.min(1, "Verification code is required")
		.length(6, "Verification code must be exactly 6 digits"),
});

type SignUpFormData = z.infer<typeof signUpSchema>;
type VerificationFormData = z.infer<typeof verificationSchema>;

export function SignUpForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	const { isLoaded, signUp, setActive } = useSignUp();
	const [isLoading, setIsLoading] = useState(false);
	const [pendingVerification, setPendingVerification] = useState(false);
	const [userEmail, setUserEmail] = useState("");
	const router = useRouter();

	const signUpForm = useForm<SignUpFormData>({
		resolver: zodResolver(signUpSchema),
	});

	const verificationForm = useForm<VerificationFormData>({
		resolver: zodResolver(verificationSchema),
	});

	const onSubmit = async (data: SignUpFormData) => {
		if (!isLoaded) return;

		setIsLoading(true);

		try {
			const signUpAttempt = await signUp.create({
				firstName: data.firstName,
				lastName: data.lastName,
				emailAddress: data.email,
				password: data.password,
			});

			if (signUpAttempt.status === "complete") {
				await setActive({ session: signUpAttempt.createdSessionId });
				toast.success("Account created successfully!", {
					description: "Welcome to our platform!",
				});
				router.push("/dashboard");
			} else if (signUpAttempt.status === "missing_requirements") {
				toast.error("Please fill in all required fields.");
			} else {
				// Check if email verification is needed
				if (signUpAttempt.unverifiedFields.includes("email_address")) {
					setPendingVerification(true);
					setUserEmail(data.email);
					toast.success("Account created!", {
						description: "Please check your email for a verification code.",
					});
					await signUpAttempt.prepareEmailAddressVerification({
						strategy: "email_code",
					});
				}
			}
		} catch (err: unknown) {
			const error = err as { errors?: Array<{ message: string }> };
			toast.error(
				error.errors?.[0]?.message || "An error occurred. Please try again.",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const onVerificationSubmit = async (data: VerificationFormData) => {
		if (!isLoaded) return;

		setIsLoading(true);

		try {
			const completeSignUp = await signUp.attemptEmailAddressVerification({
				code: data.code,
			});

			if (completeSignUp.status === "complete") {
				await setActive({ session: completeSignUp.createdSessionId });
				toast.success("Email verified successfully!", {
					description: "Welcome to our platform!",
				});
				router.push("/dashboard");
			} else {
				toast.error("Verification failed. Please try again.");
			}
		} catch (err: unknown) {
			const error = err as { errors?: Array<{ message: string }> };
			toast.error(
				error.errors?.[0]?.message || "Verification failed. Please try again.",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleOAuthSignUp = async (
		strategy: "oauth_google" | "oauth_linkedin_oidc",
	) => {
		if (!isLoaded) return;

		setIsLoading(true);
		try {
			await signUp.authenticateWithRedirect({
				strategy,
				redirectUrl: "/dashboard",
				redirectUrlComplete: "/dashboard",
			});
		} catch (err: unknown) {
			const error = err as { errors?: Array<{ message: string }> };
			toast.error(
				error.errors?.[0]?.message || "OAuth sign up failed. Please try again.",
			);
			setIsLoading(false);
		}
	};

	if (!isLoaded) {
		return (
			<div className={cn("flex flex-col gap-6", className)}>
				<div className="flex items-center justify-center p-8">
					<div className="h-8 w-8 animate-spin rounded-full border-gray-900 border-b-2" />
				</div>
			</div>
		);
	}

	if (pendingVerification) {
		return (
			<div className={cn("flex flex-col gap-6", className)} {...props}>
				<div className="flex flex-col items-center gap-2 text-center">
					<h1 className="font-bold text-2xl">Verify your email</h1>
					<p className="text-balance text-muted-foreground text-sm">
						We sent a verification code to {userEmail}
					</p>
				</div>
				<form
					onSubmit={verificationForm.handleSubmit(onVerificationSubmit)}
					className="grid gap-6"
				>
					<div className="grid gap-3">
						<Label htmlFor="code">Verification Code</Label>
						<div className="flex justify-center">
							<Controller
								name="code"
								control={verificationForm.control}
								render={({ field }) => (
									<InputOTP
										maxLength={6}
										value={field.value || ""}
										onChange={field.onChange}
										disabled={isLoading}
									>
										<InputOTPGroup>
											<InputOTPSlot index={0} />
											<InputOTPSlot index={1} />
											<InputOTPSlot index={2} />
											<InputOTPSlot index={3} />
											<InputOTPSlot index={4} />
											<InputOTPSlot index={5} />
										</InputOTPGroup>
									</InputOTP>
								)}
							/>
						</div>
						{verificationForm.formState.errors.code && (
							<p className="text-center text-red-600 text-sm">
								{verificationForm.formState.errors.code.message}
							</p>
						)}
					</div>
					<Button type="submit" className="w-full" disabled={isLoading}>
						{isLoading ? "Verifying..." : "Verify Email"}
					</Button>
				</form>
				<div className="text-center text-sm">
					<button
						type="button"
						onClick={() => setPendingVerification(false)}
						className="underline underline-offset-4 hover:text-primary"
					>
						← Back to sign up
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<div className="flex flex-col items-center gap-2 text-center">
				<h1 className="font-bold text-2xl">Create your account</h1>
				<p className="text-balance text-muted-foreground text-sm">
					Enter your details below to create your account
				</p>
			</div>
			<form onSubmit={signUpForm.handleSubmit(onSubmit)} className="grid gap-6">
				<div className="grid grid-cols-2 gap-4">
					<div className="grid gap-3">
						<Label htmlFor="firstName">First Name</Label>
						<Input
							id="firstName"
							type="text"
							placeholder="John"
							{...signUpForm.register("firstName")}
							disabled={isLoading}
						/>
						{signUpForm.formState.errors.firstName && (
							<p className="text-red-600 text-sm">
								{signUpForm.formState.errors.firstName.message}
							</p>
						)}
					</div>
					<div className="grid gap-3">
						<Label htmlFor="lastName">Last Name</Label>
						<Input
							id="lastName"
							type="text"
							placeholder="Doe"
							{...signUpForm.register("lastName")}
							disabled={isLoading}
						/>
						{signUpForm.formState.errors.lastName && (
							<p className="text-red-600 text-sm">
								{signUpForm.formState.errors.lastName.message}
							</p>
						)}
					</div>
				</div>
				<div className="grid gap-3">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						type="email"
						placeholder="john@example.com"
						{...signUpForm.register("email")}
						disabled={isLoading}
					/>
					{signUpForm.formState.errors.email && (
						<p className="text-red-600 text-sm">
							{signUpForm.formState.errors.email.message}
						</p>
					)}
				</div>
				<div className="grid gap-3">
					<Label htmlFor="password">Password</Label>
					<Input
						id="password"
						type="password"
						placeholder="Create a strong password"
						{...signUpForm.register("password")}
						disabled={isLoading}
					/>
					{signUpForm.formState.errors.password && (
						<p className="text-red-600 text-sm">
							{signUpForm.formState.errors.password.message}
						</p>
					)}
				</div>
				<Button type="submit" className="w-full" disabled={isLoading}>
					{isLoading ? "Creating account..." : "Create Account"}
				</Button>
				{/* Clerk CAPTCHA container - required for Smart CAPTCHA */}
				<div id="clerk-captcha" className="flex justify-center" />
				<div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-border after:border-t">
					<span className="relative z-10 bg-background px-2 text-muted-foreground">
						Or continue with
					</span>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<Button
						variant="outline"
						type="button"
						onClick={() => handleOAuthSignUp("oauth_google")}
						disabled={isLoading}
						className="w-full"
					>
						<svg
							className="mr-2 h-4 w-4"
							aria-hidden="true"
							focusable="false"
							data-prefix="fab"
							data-icon="google"
							role="img"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 488 512"
						>
							<path
								fill="currentColor"
								d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h240z"
							/>
						</svg>
						Google
					</Button>
					<Button
						variant="outline"
						type="button"
						onClick={() => handleOAuthSignUp("oauth_linkedin_oidc")}
						disabled={isLoading}
						className="w-full"
					>
						<svg
							className="mr-2 h-4 w-4"
							aria-hidden="true"
							focusable="false"
							role="img"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 448 512"
						>
							<path
								fill="currentColor"
								d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z"
							/>
						</svg>
						LinkedIn
					</Button>
				</div>
			</form>
			<div className="text-center text-sm">
				Already have an account?{" "}
				<button
					type="button"
					onClick={() => router.push("/login")}
					className="underline underline-offset-4 hover:text-primary"
				>
					Sign in
				</button>
			</div>
		</div>
	);
}
