import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingGuard } from "~/components/onboarding-guard";

// Mock Next.js router
const mockPush = vi.fn();
vi.mock("@bprogress/next", () => ({
	useRouter: () => ({
		push: mockPush,
	}),
	usePathname: () => "/dashboard",
}));

// Mock Clerk
const mockUser = {
	id: "user_test123",
	emailAddresses: [{ emailAddress: "test@example.com" }],
};

vi.mock("@clerk/nextjs", () => ({
	useUser: vi.fn(),
}));

// Mock TRPC
const mockTRPCQuery = vi.fn();
vi.mock("~/trpc/react", () => ({
	api: {
		subscription: {
			getOnboardingStatus: {
				useQuery: mockTRPCQuery,
			},
		},
	},
}));

import { useUser } from "@clerk/nextjs";

describe("Onboarding Protection Integration Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Air-tight Protection Scenarios", () => {
		it("should block access when user requires onboarding", async () => {
			// Setup: User is signed in but requires onboarding
			vi.mocked(useUser).mockReturnValue({
				isLoaded: true,
				isSignedIn: true,
				user: mockUser,
			});

			mockTRPCQuery.mockReturnValue({
				data: {
					isRequired: true,
					isCompleted: false,
					paymentMethodAdded: false,
					requiresOnboarding: true,
				},
				isLoading: false,
				error: null,
			});

			render(
				<OnboardingGuard>
					<div data-testid="protected-content">This should not render</div>
				</OnboardingGuard>,
			);

			// Should show redirecting message instead of protected content
			expect(
				screen.getByText(/redirecting to complete setup/i),
			).toBeInTheDocument();
			expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();

			// Should redirect to onboarding
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/onboarding");
			});
		});

		it("should allow access when onboarding is complete", async () => {
			// Setup: User has completed onboarding
			vi.mocked(useUser).mockReturnValue({
				isLoaded: true,
				isSignedIn: true,
				user: mockUser,
			});

			mockTRPCQuery.mockReturnValue({
				data: {
					isRequired: false,
					isCompleted: true,
					paymentMethodAdded: true,
					requiresOnboarding: false,
				},
				isLoading: false,
				error: null,
			});

			render(
				<OnboardingGuard>
					<div data-testid="protected-content">Protected content</div>
				</OnboardingGuard>,
			);

			// Should render protected content
			await waitFor(() => {
				expect(screen.getByTestId("protected-content")).toBeInTheDocument();
			});

			// Should not redirect
			expect(mockPush).not.toHaveBeenCalled();
		});

		it("should fail-safe to requiring onboarding on API errors", async () => {
			// Setup: User is signed in but API call fails
			vi.mocked(useUser).mockReturnValue({
				isLoaded: true,
				isSignedIn: true,
				user: mockUser,
			});

			mockTRPCQuery.mockReturnValue({
				data: null,
				isLoading: false,
				error: new Error("Database connection failed"),
			});

			render(
				<OnboardingGuard>
					<div data-testid="protected-content">This should not render</div>
				</OnboardingGuard>,
			);

			// Should show error state
			expect(
				screen.getByText(/access verification failed/i),
			).toBeInTheDocument();
			expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();

			// Should redirect to onboarding (fail-safe)
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/onboarding");
			});
		});

		it("should block access when payment method not added (even if onboarding_required is false)", async () => {
			// Setup: Edge case where onboarding_required is false but payment method not added
			vi.mocked(useUser).mockReturnValue({
				isLoaded: true,
				isSignedIn: true,
				user: mockUser,
			});

			mockTRPCQuery.mockReturnValue({
				data: {
					isRequired: false, // This might be inconsistent
					isCompleted: false,
					paymentMethodAdded: false, // Critical: no payment method
					requiresOnboarding: true, // Service correctly identifies this
				},
				isLoading: false,
				error: null,
			});

			render(
				<OnboardingGuard>
					<div data-testid="protected-content">This should not render</div>
				</OnboardingGuard>,
			);

			// Should block access based on requiresOnboarding flag
			expect(
				screen.getByText(/redirecting to complete setup/i),
			).toBeInTheDocument();
			expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();

			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/onboarding");
			});
		});

		it("should redirect unauthenticated users to sign-in", async () => {
			// Setup: User is not signed in
			vi.mocked(useUser).mockReturnValue({
				isLoaded: true,
				isSignedIn: false,
				user: null,
			});

			render(
				<OnboardingGuard>
					<div data-testid="protected-content">This should not render</div>
				</OnboardingGuard>,
			);

			// Should redirect to sign-in
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/sign-in");
			});

			expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
		});

		it("should show loading state while checking onboarding", async () => {
			// Setup: Still loading onboarding status
			vi.mocked(useUser).mockReturnValue({
				isLoaded: true,
				isSignedIn: true,
				user: mockUser,
			});

			mockTRPCQuery.mockReturnValue({
				data: null,
				isLoading: true,
				error: null,
			});

			render(
				<OnboardingGuard>
					<div data-testid="protected-content">This should not render yet</div>
				</OnboardingGuard>,
			);

			// Should show loading state
			expect(screen.getByText(/checking access/i)).toBeInTheDocument();
			expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
		});
	});

	describe("Route-specific Protection", () => {
		it("should allow access to onboarding route for users requiring onboarding", async () => {
			// Mock pathname for onboarding route
			vi.doMock("@bprogress/next", () => ({
				useRouter: () => ({ push: mockPush }),
				usePathname: () => "/onboarding",
			}));

			vi.mocked(useUser).mockReturnValue({
				isLoaded: true,
				isSignedIn: true,
				user: mockUser,
			});

			mockTRPCQuery.mockReturnValue({
				data: {
					requiresOnboarding: true,
				},
				isLoading: false,
				error: null,
			});

			render(
				<OnboardingGuard>
					<div data-testid="onboarding-content">Onboarding form</div>
				</OnboardingGuard>,
			);

			// Should render onboarding content
			await waitFor(() => {
				expect(screen.getByTestId("onboarding-content")).toBeInTheDocument();
			});

			// Should not redirect
			expect(mockPush).not.toHaveBeenCalled();
		});
	});

	describe("Security Edge Cases", () => {
		it("should not trust client-side data alone", async () => {
			// This test ensures we rely on server-side verification
			vi.mocked(useUser).mockReturnValue({
				isLoaded: true,
				isSignedIn: true,
				user: {
					...mockUser,
					// Even if user has client-side metadata suggesting completion
					publicMetadata: {
						onboardingComplete: true,
						paymentMethodAdded: true,
					},
				},
			});

			// But server says onboarding is required
			mockTRPCQuery.mockReturnValue({
				data: {
					requiresOnboarding: true, // Server is the source of truth
				},
				isLoading: false,
				error: null,
			});

			render(
				<OnboardingGuard>
					<div data-testid="protected-content">This should not render</div>
				</OnboardingGuard>,
			);

			// Should block access based on server response, not client metadata
			expect(
				screen.getByText(/redirecting to complete setup/i),
			).toBeInTheDocument();
			expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
		});

		it("should handle race conditions gracefully", async () => {
			// Setup: Quick succession of status changes
			vi.mocked(useUser).mockReturnValue({
				isLoaded: true,
				isSignedIn: true,
				user: mockUser,
			});

			let callCount = 0;
			mockTRPCQuery.mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return { data: null, isLoading: true, error: null };
				}
				return {
					data: { requiresOnboarding: false },
					isLoading: false,
					error: null,
				};
			});

			const { rerender } = render(
				<OnboardingGuard>
					<div data-testid="protected-content">Protected content</div>
				</OnboardingGuard>,
			);

			// Initially loading
			expect(screen.getByText(/checking access/i)).toBeInTheDocument();

			// Re-render to simulate status update
			rerender(
				<OnboardingGuard>
					<div data-testid="protected-content">Protected content</div>
				</OnboardingGuard>,
			);

			// Should eventually show content
			await waitFor(() => {
				expect(screen.getByTestId("protected-content")).toBeInTheDocument();
			});
		});
	});
});
