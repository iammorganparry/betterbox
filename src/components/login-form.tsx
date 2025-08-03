"use client";

import { useRouter } from "@bprogress/next";
import { useSignIn } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

const loginSchema = z.object({
	email: z.string().min(1, "Email is required").email("Invalid email address"),
	password: z
		.string()
		.min(1, "Password is required")
		.min(8, "Password must be at least 8 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	const { isLoaded, signIn, setActive } = useSignIn();
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginFormData>({
		resolver: zodResolver(loginSchema),
	});

	const onSubmit = async (data: LoginFormData) => {
		if (!isLoaded) return;

		setIsLoading(true);

		try {
			const signInAttempt = await signIn.create({
				identifier: data.email,
				password: data.password,
			});

			if (signInAttempt.status === "complete") {
				await setActive({ session: signInAttempt.createdSessionId });
				toast.success("Welcome back!", {
					description: "You have been successfully signed in.",
				});
				router.push("/dashboard");
			} else {
				toast.error("Sign in failed. Please try again.");
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

	const handleOAuthSignIn = async (
		strategy: "oauth_google" | "oauth_linkedin_oidc",
	) => {
		if (!isLoaded) return;

		setIsLoading(true);
		try {
			await signIn.authenticateWithRedirect({
				strategy,
				redirectUrl: "/dashboard",
				redirectUrlComplete: "/dashboard",
			});
		} catch (err: unknown) {
			const error = err as { errors?: Array<{ message: string }> };
			toast.error(
				error.errors?.[0]?.message || "OAuth sign in failed. Please try again.",
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

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<div className="flex flex-col items-center gap-2 text-center">
				<h1 className="font-bold text-2xl">Login to your account</h1>
				<p className="text-balance text-muted-foreground text-sm">
					Enter your email below to login to your account
				</p>
			</div>
			<form onSubmit={handleSubmit(onSubmit)} className="grid gap-6">
				<div className="grid gap-3">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						type="email"
						placeholder="m@example.com"
						{...register("email")}
						disabled={isLoading}
					/>
					{errors.email && (
						<p className="text-red-600 text-sm">{errors.email.message}</p>
					)}
				</div>
				<div className="grid gap-3">
					<div className="flex items-center">
						<Label htmlFor="password">Password</Label>
						<button
							type="button"
							className="ml-auto text-primary text-sm underline-offset-4 hover:underline"
							onClick={() => router.push("/forgot-password")}
						>
							Forgot your password?
						</button>
					</div>
					<Input
						id="password"
						type="password"
						placeholder="Enter your password"
						{...register("password")}
						disabled={isLoading}
					/>
					{errors.password && (
						<p className="text-red-600 text-sm">{errors.password.message}</p>
					)}
				</div>
				<Button type="submit" className="w-full" disabled={isLoading}>
					{isLoading ? "Signing in..." : "Login"}
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
						onClick={() => handleOAuthSignIn("oauth_google")}
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
						onClick={() => handleOAuthSignIn("oauth_linkedin_oidc")}
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
				Don&apos;t have an account?{" "}
				<button
					type="button"
					onClick={() => router.push("/sign-up")}
					className="underline underline-offset-4 hover:text-primary"
				>
					Sign up
				</button>
			</div>
		</div>
	);
}
