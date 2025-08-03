"use client";

import { useRouter } from "@bprogress/next";
import { useClerk, useUser } from "@clerk/nextjs";
import {
	ArrowLeft,
	ArrowRight,
	Building,
	CheckCircle,
	CheckIcon,
	Circle,
	CreditCard,
	Crown,
	MinusIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { LinkedInConnectionCard } from "~/components/linkedin-connection-card";
import PaymentForm from "~/components/payment-form";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { env } from "~/env";
import { api } from "~/trpc/react";
import { completeOnboarding, updateOnboardingStep } from "./_actions";

type OnboardingStep = "linkedin" | "plan" | "payment";

interface StepInfo {
	id: OnboardingStep;
	title: string;
	description: string;
	icon: React.ReactNode;
	completed: boolean;
}

export default function OnboardingPage() {
	const [currentStep, setCurrentStep] =
		React.useState<OnboardingStep>("linkedin");
	const [loading, setLoading] = React.useState(false);
	const [selectedPlan, setSelectedPlan] = React.useState<string>("");
	const [isAnnual, setIsAnnual] = React.useState(false);
	const { user } = useUser();
	const { signOut } = useClerk();
	const router = useRouter();

	// TRPC mutation for completing onboarding
	const completeOnboardingMutation =
		api.subscription.completeOnboarding.useMutation();

	// Validate that all required Stripe product IDs are configured
	React.useEffect(() => {
		const productIds = {
			starter: env.NEXT_PUBLIC_STRIPE_STARTER_PRODUCT_ID,
			standard: env.NEXT_PUBLIC_STRIPE_STANDARD_PRODUCT_ID,
			pro: env.NEXT_PUBLIC_STRIPE_PRO_PRODUCT_ID,
		};

		const missing = Object.entries(productIds).filter(
			([plan, id]) => !id || id.trim() === "",
		);

		if (missing.length > 0) {
			console.error(
				"Missing required Stripe product IDs for plans:",
				missing.map(([plan]) => plan),
			);
			toast.error("Configuration error: Missing Stripe product IDs");
		} else {
			console.log("All Stripe product IDs configured:", productIds);
		}
	}, []);

	// Initialize completion states from user metadata
	const [stepCompletion, setStepCompletion] = React.useState({
		linkedin: false,
		plan: false,
		payment: false,
	});

	// Initialize step completion states from user metadata
	React.useEffect(() => {
		if (user?.publicMetadata) {
			const metadata = user.publicMetadata as {
				linkedinConnected?: boolean;
				stripeSubscribed?: boolean;
				planSelected?: boolean;
				cardDetailsAdded?: boolean;
				paymentMethodAdded?: boolean;
			};
			setStepCompletion({
				linkedin: Boolean(metadata.linkedinConnected),
				plan: Boolean(metadata.stripeSubscribed || metadata.planSelected),
				payment: Boolean(
					metadata.cardDetailsAdded || metadata.paymentMethodAdded,
				),
			});

			// Set current step based on completion
			if (!metadata.linkedinConnected) {
				setCurrentStep("linkedin");
			} else if (!metadata.stripeSubscribed && !metadata.planSelected) {
				setCurrentStep("plan");
			} else if (!metadata.cardDetailsAdded && !metadata.paymentMethodAdded) {
				setCurrentStep("payment");
			} else {
				// All steps completed - show payment completion view
				setCurrentStep("payment");
			}
		}
	}, [user]);

	const steps: StepInfo[] = [
		{
			id: "linkedin",
			title: "Connect LinkedIn",
			description: "Link your LinkedIn account to sync messages",
			icon: <Building className="h-5 w-5" />,
			completed: stepCompletion.linkedin,
		},
		{
			id: "plan",
			title: "Choose Plan",
			description: "Select a subscription plan",
			icon: <Crown className="h-5 w-5" />,
			completed: stepCompletion.plan,
		},
		{
			id: "payment",
			title: "Payment Details",
			description: "Add your payment information",
			icon: <CreditCard className="h-5 w-5" />,
			completed: stepCompletion.payment,
		},
	];

	const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
	const progress = ((currentStepIndex + 1) / steps.length) * 100;

	// Pricing logic
	const pricing = {
		starter: { monthly: 20, annual: 180 }, // 10% discount
		standard: { monthly: 50, annual: 450 }, // 10% discount
		pro: { monthly: 99, annual: 891 }, // 10% discount
	};

	const handlePlanSelection = (planType: string) => {
		setSelectedPlan(planType);
		toast.success(`${planType} plan selected!`);
	};

	const { mutateAsync: completeOnboarding } =
		api.subscription.completeOnboarding.useMutation();

	const handlePaymentSuccess = async (
		paymentMethodId: string,
		productId: string,
	) => {
		try {
			setLoading(true);

			// Here you would call your subscription creation API with the productId
			// For now, we'll simulate the process
			console.log("Payment method ID:", paymentMethodId);
			console.log("Stripe product ID:", productId);
			console.log("Selected plan:", selectedPlan);
			console.log("Is annual:", isAnnual);

			toast.success("Payment method added successfully!");

			// CRITICAL: Mark onboarding as complete in database
			// This is the key step that unlocks app access
			const onboardingResult = await completeOnboardingMutation.mutateAsync({
				paymentMethodId,
				productId,
				selectedPlan,
				isAnnual,
			});

			if (!onboardingResult.success) {
				throw new Error(
					onboardingResult.message ||
						"Failed to complete onboarding in database",
				);
			}

			// Mark payment step as complete and move to final step
			const result = await updateOnboardingStep({
				cardDetailsAdded: true,
				stripeSubscribed: true,
				paymentMethodAdded: true, // Add this flag
			});

			if (result.success) {
				toast.success("Subscription created! Starting your 7-day Gold trial.");
				// Complete onboarding
				await handleCompleteOnboarding();
			} else {
				toast.error(result.error || "Failed to complete setup");
			}
		} catch (error) {
			console.error("Payment success error:", error);
			toast.error("Failed to process payment");
		} finally {
			setLoading(false);
		}
	};

	const handlePaymentError = (error: string) => {
		toast.error(error);
	};

	const handleStepCompletion = async (step: OnboardingStep) => {
		setLoading(true);
		try {
			const updateData = { [`${step}Connected`]: true };
			const result = await updateOnboardingStep(updateData);

			if (result.success) {
				setStepCompletion((prev) => ({ ...prev, [step]: true }));
				toast.success(`${steps.find((s) => s.id === step)?.title} completed!`);

				// Move to next step
				if (step === "linkedin") setCurrentStep("plan");
				else if (step === "plan") setCurrentStep("payment");
				else if (step === "payment") {
					await handleCompleteOnboarding();
				}
			} else {
				toast.error(result.error || "Failed to update step");
			}
		} catch (error) {
			toast.error("An error occurred");
		} finally {
			setLoading(false);
		}
	};

	const handleCompleteOnboarding = async () => {
		setLoading(true);
		try {
			// Onboarding completion is now handled through the TRPC mutation in payment success
			// This function is just for final UI updates and navigation
			await user?.reload();
			toast.success("Onboarding completed! Welcome to BetterBox!");
			router.push("/dashboard");
		} catch (error) {
			console.error("Error completing onboarding flow:", error);
			toast.error("An error occurred during final setup");
		} finally {
			setLoading(false);
		}
	};

	const handleLogout = async () => {
		try {
			await signOut();
			router.push("/sign-in");
		} catch (error) {
			console.error("Error signing out:", error);
			toast.error("Failed to sign out");
		}
	};

	const renderStepContent = () => {
		switch (currentStep) {
			case "linkedin":
				return (
					<div className="w-full space-y-6">
						<div className="text-center">
							<h2 className="font-bold text-2xl">
								Connect your LinkedIn account
							</h2>
							<p className="mt-2 text-muted-foreground">
								Start by connecting your LinkedIn account to sync your messages
								and contacts.
							</p>
						</div>

						<div className="mx-auto max-w-md">
							<LinkedInConnectionCard userId={user?.id || ""} />
						</div>
					</div>
				);

			case "plan":
				return (
					<div className="w-full space-y-6">
						<div className="text-center">
							<h2 className="font-bold text-2xl">Choose your plan</h2>
							<p className="mt-2 text-muted-foreground">
								Select a subscription plan that fits your needs.
							</p>
						</div>

						{/* Monthly/Annual Toggle */}
						<div className="flex items-center justify-center">
							<Label htmlFor="payment-schedule" className="me-3">
								Monthly
							</Label>
							<Switch
								id="payment-schedule"
								checked={isAnnual}
								onCheckedChange={setIsAnnual}
							/>
							<Label htmlFor="payment-schedule" className="relative ms-3">
								Annual
								<span className="-top-10 -end-28 absolute start-auto">
									<span className="flex items-center">
										<svg
											className="-me-6 h-8 w-14"
											width={45}
											height={25}
											viewBox="0 0 45 25"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<title>Arrow pointing to savings badge</title>
											<path
												d="M43.2951 3.47877C43.8357 3.59191 44.3656 3.24541 44.4788 2.70484C44.5919 2.16427 44.2454 1.63433 43.7049 1.52119L43.2951 3.47877ZM4.63031 24.4936C4.90293 24.9739 5.51329 25.1423 5.99361 24.8697L13.8208 20.4272C14.3011 20.1546 14.4695 19.5443 14.1969 19.0639C13.9242 18.5836 13.3139 18.4152 12.8336 18.6879L5.87608 22.6367L1.92723 15.6792C1.65462 15.1989 1.04426 15.0305 0.563943 15.3031C0.0836291 15.5757 -0.0847477 16.1861 0.187863 16.6664L4.63031 24.4936ZM43.7049 1.52119C32.7389 -0.77401 23.9595 0.99522 17.3905 5.28788C10.8356 9.57127 6.58742 16.2977 4.53601 23.7341L6.46399 24.2659C8.41258 17.2023 12.4144 10.9287 18.4845 6.96211C24.5405 3.00476 32.7611 1.27399 43.2951 3.47877L43.7049 1.52119Z"
												fill="currentColor"
												className="text-muted-foreground"
											/>
										</svg>
										<Badge className="mt-3 uppercase">Save up to 10%</Badge>
									</span>
								</span>
							</Label>
						</div>

						{/* Pricing Cards Grid */}
						<div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3 lg:items-center">
							{/* Starter Plan */}
							<Card
								className={`flex flex-col transition-all duration-200 ${
									selectedPlan === "starter"
										? "bg-primary/5 ring-2 ring-primary"
										: "hover:shadow-md"
								}`}
							>
								<CardHeader className="pb-2 text-center">
									<CardTitle className="mb-7">Starter</CardTitle>
									<span className="font-bold text-5xl">
										$
										{isAnnual
											? pricing.starter.annual
											: pricing.starter.monthly}
										{isAnnual && <span className="text-lg">/year</span>}
										{!isAnnual && <span className="text-lg">/month</span>}
									</span>
								</CardHeader>
								<CardDescription className="mx-auto w-11/12 text-center">
									Essential features to get started
								</CardDescription>
								<CardContent className="flex-1">
									<ul className="mt-7 space-y-2.5 text-sm">
										<li className="flex space-x-2">
											<CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
											<span className="text-muted-foreground">
												Unlimited contacts
											</span>
										</li>
										<li className="flex space-x-2">
											<CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
											<span className="text-muted-foreground">
												Basic messaging
											</span>
										</li>
										<li className="flex space-x-2">
											<CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
											<span className="text-muted-foreground">
												Email support
											</span>
										</li>
									</ul>
								</CardContent>
								<CardFooter>
									<Button
										className="w-full"
										variant={selectedPlan === "starter" ? "default" : undefined}
										onClick={() => handlePlanSelection("starter")}
									>
										{selectedPlan === "starter" ? (
											<>
												<CheckIcon className="mr-2 h-4 w-4" />
												Selected
											</>
										) : (
											"Choose Plan"
										)}
									</Button>
								</CardFooter>
							</Card>

							{/* Standard Plan */}
							<Card
								className={`flex flex-col transition-all duration-200 ${
									selectedPlan === "standard"
										? "border-primary bg-primary/5 ring-2 ring-primary"
										: "border-primary hover:shadow-md"
								}`}
							>
								<CardHeader className="pb-2 text-center">
									<Badge className="mb-3 w-max self-center uppercase">
										Most popular
									</Badge>
									<CardTitle className="!mb-7">Standard</CardTitle>
									<span className="font-bold text-5xl">
										$
										{isAnnual
											? pricing.standard.annual
											: pricing.standard.monthly}
										{isAnnual && <span className="text-lg">/year</span>}
										{!isAnnual && <span className="text-lg">/month</span>}
									</span>
								</CardHeader>
								<CardDescription className="mx-auto w-11/12 text-center">
									Perfect for growing professionals
								</CardDescription>
								<CardContent className="flex-1">
									<ul className="mt-7 space-y-2.5 text-sm">
										<li className="flex space-x-2">
											<CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
											<span className="text-muted-foreground">
												Unlimited contacts
											</span>
										</li>
										<li className="flex space-x-2">
											<CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
											<span className="text-muted-foreground">
												Advanced messaging
											</span>
										</li>
										<li className="flex space-x-2">
											<CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
											<span className="text-muted-foreground">
												Priority support
											</span>
										</li>
									</ul>
								</CardContent>
								<CardFooter>
									<Button
										className="w-full"
										variant={
											selectedPlan === "standard" ? "default" : undefined
										}
										onClick={() => handlePlanSelection("standard")}
									>
										{selectedPlan === "standard" ? (
											<>
												<CheckIcon className="mr-2 h-4 w-4" />
												Selected
											</>
										) : (
											"Choose Plan"
										)}
									</Button>
								</CardFooter>
							</Card>

							{/* Pro Plan */}
							<Card
								className={`flex flex-col transition-all duration-200 ${
									selectedPlan === "pro"
										? "bg-primary/5 ring-2 ring-primary"
										: "hover:shadow-md"
								}`}
							>
								<CardHeader className="pb-2 text-center">
									<CardTitle className="mb-7">Pro</CardTitle>
									<span className="font-bold text-5xl">
										${isAnnual ? pricing.pro.annual : pricing.pro.monthly}
										{isAnnual && <span className="text-lg">/year</span>}
										{!isAnnual && <span className="text-lg">/month</span>}
									</span>
								</CardHeader>
								<CardDescription className="mx-auto w-11/12 text-center">
									Advanced features for scaling organizations
								</CardDescription>
								<CardContent>
									<ul className="mt-7 space-y-2.5 text-sm">
										<li className="flex space-x-2">
											<CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
											<span className="text-muted-foreground">
												Unlimited contacts
											</span>
										</li>
										<li className="flex space-x-2">
											<CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
											<span className="text-muted-foreground">
												AI-powered features
											</span>
										</li>
										<li className="flex space-x-2">
											<CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
											<span className="text-muted-foreground">
												Custom integrations
											</span>
										</li>
										<li className="flex space-x-2">
											<CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
											<span className="text-muted-foreground">
												Dedicated support
											</span>
										</li>
									</ul>
								</CardContent>
								<CardFooter>
									<Button
										className="w-full"
										variant={selectedPlan === "pro" ? "default" : "outline"}
										onClick={() => handlePlanSelection("pro")}
									>
										{selectedPlan === "pro" ? (
											<>
												<CheckIcon className="mr-2 h-4 w-4" />
												Selected
											</>
										) : (
											"Choose Plan"
										)}
									</Button>
								</CardFooter>
							</Card>
						</div>

						<div className="text-center">
							{selectedPlan ? (
								<div className="space-y-2">
									<p className="font-medium text-green-600 text-sm">
										✓{" "}
										{selectedPlan.charAt(0).toUpperCase() +
											selectedPlan.slice(1)}{" "}
										plan selected
									</p>
									<p className="text-muted-foreground text-sm">
										You can now continue to payment details to start your 7-day
										Gold trial.
									</p>
								</div>
							) : (
								<p className="text-muted-foreground text-sm">
									Select a plan above to continue to payment details.
								</p>
							)}
						</div>
					</div>
				);

			case "payment": {
				// Check if payment is already completed
				const paymentCompleted = stepCompletion.payment;

				if (paymentCompleted) {
					return (
						<div className="space-y-6">
							<div className="text-center">
								<h2 className="font-bold text-2xl">Payment completed!</h2>
								<p className="mt-2 text-muted-foreground">
									Your 7-day Gold trial has started! You'll be charged for your
									selected plan after the trial ends.
								</p>
							</div>

							<Card className="mx-auto max-w-md">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<CheckCircle
											className="h-5 w-5 text-green-600"
											data-testid="setup-complete-check"
										/>
										Setup Complete
									</CardTitle>
									<CardDescription>
										Your subscription is now active and ready to use.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-3">
										<div className="flex items-center gap-2 text-sm">
											<CheckCircle
												className="h-4 w-4 text-green-600"
												data-testid="linkedin-check"
											/>
											<span>LinkedIn account connected</span>
										</div>
										<div className="flex items-center gap-2 text-sm">
											<CheckCircle
												className="h-4 w-4 text-green-600"
												data-testid="plan-check"
											/>
											<span>Subscription plan selected</span>
										</div>
										<div className="flex items-center gap-2 text-sm">
											<CheckCircle
												className="h-4 w-4 text-green-600"
												data-testid="payment-check"
											/>
											<span>Payment method added</span>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					);
				}

				// Show payment form if not completed
				if (!selectedPlan) {
					return (
						<div className="w-full space-y-6">
							<div className="text-center">
								<h2 className="font-bold text-2xl">Add payment details</h2>
								<p className="mt-2 text-muted-foreground">
									Please select a plan first before adding payment details.
								</p>
							</div>
							<Button
								onClick={() => setCurrentStep("plan")}
								variant="outline"
								className="w-full"
							>
								Go back to plan selection
							</Button>
						</div>
					);
				}

				return (
					<div className="w-full space-y-6">
						<div className="text-center">
							<h2 className="font-bold text-2xl">Add payment details</h2>
							<p className="mt-2 text-muted-foreground">
								Start your 7-day Gold trial and then continue with your selected
								plan.
							</p>
						</div>

						<PaymentForm
							selectedPlan={selectedPlan}
							isAnnual={isAnnual}
							pricing={pricing}
							onSuccess={handlePaymentSuccess}
							onError={handlePaymentError}
							onBack={() => setCurrentStep("plan")}
						/>
					</div>
				);
			}

			default:
				return null;
		}
	};

	return (
		<div className="relative h-screen w-full">
			<div className="container relative z-10 mx-auto flex h-screen flex-col items-center justify-center px-4 py-8">
				{/* Header */}
				<div className="mb-8 text-center">
					<p className="text-muted-foreground">
						Let's get you set up in just a few steps
					</p>
				</div>

				{/* Progress */}
				<div className="mb-8 w-full">
					<div className="mb-4 flex items-center justify-center gap-8">
						{steps.map((step, index) => (
							<React.Fragment key={step.id}>
								<div
									className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all duration-300 ${
										step.id === currentStep
											? "glass text-primary"
											: step.completed
												? "glass-strong text-green-400"
												: "glass-subtle text-muted-foreground"
									}`}
								>
									{step.completed ? (
										<CheckCircle
											className="h-5 w-5"
											data-testid="check-circle"
										/>
									) : (
										step.icon
									)}
									<span className="font-medium text-sm">{step.title}</span>
								</div>
								{index < steps.length - 1 && (
									<ArrowRight className="h-4 w-4 text-muted-foreground/60" />
								)}
							</React.Fragment>
						))}
					</div>
					<div className="mx-auto max-w-2xl">
						<div className="glass-subtle rounded-full p-1">
							<Progress value={progress} className="h-2" />
						</div>
					</div>
				</div>

				{/* Step Content */}
				<div className="mx-auto w-full max-w-6xl">{renderStepContent()}</div>

				{/* Navigation */}
				<div className="mx-auto mt-8 flex w-full max-w-2xl justify-center gap-4">
					{currentStep !== "linkedin" && (
						<Button
							variant="outline"
							onClick={() => {
								if (currentStep === "plan") setCurrentStep("linkedin");
								else if (currentStep === "payment") setCurrentStep("plan");
							}}
							disabled={loading}
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back
						</Button>
					)}

					{currentStep === "linkedin" && (
						<Button
							onClick={() => handleStepCompletion("linkedin")}
							disabled={loading}
							size="lg"
						>
							Continue to Plan Selection
							<ArrowRight className="ml-2 h-4 w-4" />
						</Button>
					)}

					{currentStep === "plan" && (
						<Button
							onClick={() => handleStepCompletion("plan")}
							disabled={loading}
							size="lg"
						>
							Continue to Payment
							<ArrowRight className="ml-2 h-4 w-4" />
						</Button>
					)}
				</div>

				{/* Logout Footer */}
				<div className="-translate-x-1/2 fixed bottom-4 left-1/2 z-20 transform">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleLogout}
						className="glass-subtle hover:glass text-muted-foreground text-xs transition-all duration-300 hover:text-foreground"
					>
						Not ready? Sign out
					</Button>
				</div>
			</div>
		</div>
	);
}
