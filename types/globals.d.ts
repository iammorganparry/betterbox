export {};

declare global {
	interface CustomJwtSessionClaims {
		metadata: {
			onboardingComplete?: boolean;
			linkedinConnected?: boolean;
			stripeSubscribed?: boolean;
			cardDetailsAdded?: boolean;
		};
	}
}
