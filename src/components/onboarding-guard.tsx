"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "@bprogress/next";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { api } from "~/trpc/react";

interface OnboardingGuardProps {
    children: React.ReactNode;
}

/**
 * OnboardingGuard - Air-tight enforcement of onboarding completion
 * 
 * This component ensures that:
 * 1. All authenticated users must complete onboarding before accessing the app
 * 2. Users who have completed onboarding can't access onboarding pages
 * 3. No workarounds exist to bypass this requirement
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
    const { isLoaded, isSignedIn, user } = useUser();
    const router = useRouter();
    const pathname = usePathname();

    // Check onboarding status via TRPC
    const {
        data: onboardingStatus,
        isLoading: isCheckingOnboarding,
        error: onboardingError
    } = api.subscription.getOnboardingStatus.useQuery(
        undefined,
        {
            enabled: isLoaded && isSignedIn && !!user,
            retry: 3,
            retryDelay: 1000,
        }
    );

    // Route patterns
    const isAuthRoute = pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up");
    const isOnboardingRoute = pathname?.startsWith("/onboarding");
    const isApiRoute = pathname?.startsWith("/api");

    useEffect(() => {
        // Don't do anything while loading
        if (!isLoaded || isCheckingOnboarding) {
            return;
        }

        // Allow auth routes for non-authenticated users
        if (!isSignedIn && (isAuthRoute || isApiRoute)) {
            return;
        }

        // If user is not signed in and not on auth routes, redirect to sign-in
        if (!isSignedIn && !isAuthRoute) {
            console.log("User not signed in, redirecting to sign-in");
            router.push("/sign-in");
            return;
        }

        // If user is signed in, check onboarding status
        if (isSignedIn && user) {
            // Handle onboarding check errors by requiring onboarding (fail-safe)
            if (onboardingError) {
                console.error("Error checking onboarding status:", onboardingError);
                if (!isOnboardingRoute) {
                    console.log("Onboarding check failed, redirecting to onboarding");
                    router.push("/onboarding");
                }
                return;
            }

            // If we have onboarding status data
            if (onboardingStatus) {
                const requiresOnboarding = onboardingStatus.requiresOnboarding;

                // CRITICAL: User requires onboarding and is not on onboarding route
                if (requiresOnboarding && !isOnboardingRoute && !isApiRoute) {
                    console.log(`User ${user.id} requires onboarding, redirecting from ${pathname}`);
                    router.push("/onboarding");
                    return;
                }

                // User has completed onboarding but is on onboarding route
                if (!requiresOnboarding && isOnboardingRoute) {
                    console.log(`User ${user.id} has completed onboarding, redirecting to dashboard`);
                    router.push("/dashboard");
                    return;
                }

                // Log onboarding status for debugging
                console.log("Onboarding status:", {
                    userId: user.id,
                    requiresOnboarding,
                    isOnboardingRoute,
                    pathname,
                    status: onboardingStatus,
                });
            }
        }
    }, [
        isLoaded,
        isSignedIn,
        user,
        onboardingStatus,
        onboardingError,
        isCheckingOnboarding,
        isAuthRoute,
        isOnboardingRoute,
        isApiRoute,
        pathname,
        router,
    ]);

    // Show loading state for any blocking condition
    const shouldShowLoader = (
        !isLoaded ||
        (isSignedIn && isCheckingOnboarding) ||
        (isSignedIn && onboardingError && !isOnboardingRoute) ||
        (isSignedIn && onboardingStatus && !isApiRoute && (
            (onboardingStatus.requiresOnboarding && !isOnboardingRoute) ||
            (!onboardingStatus.requiresOnboarding && isOnboardingRoute)
        ))
    );

    if (shouldShowLoader) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    // Render children if all checks pass
    return <>{children}</>;
}

/**
 * Hook to check onboarding status in components
 */
export function useOnboardingStatus() {
    const { isLoaded, isSignedIn } = useUser();

    const query = api.subscription.getOnboardingStatus.useQuery(
        undefined,
        {
            enabled: isLoaded && isSignedIn,
            retry: 3,
            retryDelay: 1000,
        }
    );

    return {
        ...query,
        requiresOnboarding: query.data?.requiresOnboarding ?? true, // Fail-safe default
    };
}