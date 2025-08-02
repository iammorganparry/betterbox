"use client";

import type React from "react";
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { CheckIcon, Loader2 } from "lucide-react";
import { env } from "~/env";
import { toast } from "sonner";

// Initialize Stripe
const stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

interface PaymentFormProps {
  selectedPlan: string;
  isAnnual: boolean;
  pricing: {
    [key: string]: {
      monthly: number;
      annual: number;
    };
  };
  onSuccess: (paymentMethodId: string, productId: string) => void;
  onError: (error: string) => void;
  onBack: () => void;
}

interface PaymentFormInnerProps extends PaymentFormProps {
  clientSecret?: string;
}

// Map plan names to Stripe product IDs
const getProductId = (planName: string): string => {
  const planLower = planName.toLowerCase();
  switch (planLower) {
    case 'starter':
      return env.NEXT_PUBLIC_STRIPE_STARTER_PRODUCT_ID;
    case 'standard':
      return env.NEXT_PUBLIC_STRIPE_STANDARD_PRODUCT_ID;
    case 'pro':
      return env.NEXT_PUBLIC_STRIPE_PRO_PRODUCT_ID;
    default:
      throw new Error(`Unknown plan: ${planName}`);
  }
};

const PaymentFormInner: React.FC<PaymentFormInnerProps> = ({
  selectedPlan,
  isAnnual,
  pricing,
  onSuccess,
  onError,
  onBack,
  clientSecret,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  // Calculate pricing for the selected plan
  const selectedPlanLower = selectedPlan.toLowerCase();
  const planPricing = pricing[selectedPlanLower];



  if (!planPricing) {
    return (
      <div className="space-y-4 rounded-lg bg-red-50 p-4">
        <h3 className="font-semibold text-red-900">Pricing Error</h3>
        <p className="text-red-700 text-sm">
          Unable to load pricing for the selected plan. Please try again or
          contact support.
        </p>
      </div>
    );
  }

  const currentPrice = isAnnual ? planPricing.annual : planPricing.monthly;
  const monthlyEquivalent = isAnnual
    ? planPricing.annual / 12
    : planPricing.monthly;
  const savings = isAnnual ? planPricing.monthly * 12 - planPricing.annual : 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onError("Card element not found");
      setLoading(false);
      return;
    }

    try {
      if (clientSecret) {
        // Use setup intent for collecting payment method
        const { error, setupIntent } = await stripe.confirmCardSetup(
          clientSecret,
          {
            payment_method: {
              card: cardElement,
            },
          }
        );

        if (error) {
          onError(error.message || "Payment setup failed");
        } else if (setupIntent?.payment_method) {
          const productId = getProductId(selectedPlan);
          onSuccess(setupIntent.payment_method as string, productId);
        }
      } else {
        // Create payment method directly
        const { error, paymentMethod } = await stripe.createPaymentMethod({
          type: "card",
          card: cardElement,
        });

        if (error) {
          onError(error.message || "Payment method creation failed");
        } else if (paymentMethod) {
          const productId = getProductId(selectedPlan);
          onSuccess(paymentMethod.id, productId);
        }
      }
    } catch (error) {
      onError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: "16px",
        color: "rgba(255, 255, 255, 0.9)", // Light text for dark theme
        "::placeholder": { color: "rgba(255, 255, 255, 0.5)" }, // Muted placeholder
        backgroundColor: "transparent",
      },
      invalid: { color: "#ef4444" }, // Red for errors
    },
    hidePostalCode: true,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Payment Information</span>
            <Badge variant="secondary">
              {selectedPlan} {isAnnual ? "Annual" : "Monthly"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cost Breakdown */}
          <div className="space-y-4 rounded-lg glass-subtle p-4">
            <h3 className="font-semibold text-foreground">Cost Breakdown</h3>

            <div className="space-y-3">
              {/* Trial Period */}
              <div className="flex items-center justify-between rounded-md glass border border-primary/20 p-3">
                <div>
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    7-Day Gold Trial
                    <Badge
                      variant="secondary"
                      className="glass-subtle text-xs"
                    >
                      Premium
                    </Badge>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    All premium features unlocked
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-4xl text-primary">$0.00</p>
                  <p className="text-muted-foreground text-xs">Free trial</p>
                </div>
              </div>

              {/* After Trial */}
              <div className="flex items-center justify-between rounded-md glass border border-border p-3">
                <div>
                  <p className="font-medium text-foreground">
                    After Trial - {selectedPlan} Plan
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Billed {isAnnual ? "annually" : "monthly"}
                    {isAnnual && savings > 0 && (
                      <span className="ml-1 font-medium text-green-400">
                        (Save ${Math.round(savings)}/year)
                      </span>
                    )}
                  </p>
                  {/* Add plan features hint */}
                  <p className="mt-1 text-muted-foreground text-xs">
                    {selectedPlanLower === "starter" &&
                      "Unlimited contacts, Basic messaging, Email support"}
                    {selectedPlanLower === "standard" &&
                      "Unlimited contacts, Advanced messaging, Priority support"}
                    {selectedPlanLower === "pro" &&
                      "Unlimited contacts, AI-powered features, Custom integrations, Dedicated support"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">
                    ${currentPrice}
                    <span className="font-normal text-muted-foreground text-sm">
                      /{isAnnual ? "year" : "month"}
                    </span>
                  </p>
                  {isAnnual && (
                    <p className="text-muted-foreground text-xs">
                      (~${Math.round(monthlyEquivalent)}/month)
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="border-border border-t pt-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">Today's Charge</p>
                <p className="font-bold text-5xl text-foreground">$0.00</p>
              </div>
              <p className="mt-1 text-muted-foreground text-xs">
                First charge will be ${currentPrice} on{" "}
                {new Date(
                  Date.now() + 7 * 24 * 60 * 60 * 1000
                ).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="rounded-md glass-subtle border border-border p-3">
            <CardElement options={cardElementOptions} />
          </div>

          <div className="rounded-md glass border border-primary/20 p-4">
            <div className="flex items-start space-x-2">
              <CheckIcon className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Secure Payment</p>
                <p className="text-muted-foreground text-sm">
                  Your payment information is encrypted and secure. Cancel
                  anytime during the trial period.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!stripe || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Start 7-Day Trial"
              )}
            </Button>
          </div>

          <p className="text-center text-muted-foreground text-xs">
            Your card will not be charged during the trial period. You can
            cancel anytime before the trial ends.
          </p>
        </CardContent>
      </Card>
    </form>
  );
};

export const PaymentForm: React.FC<PaymentFormProps> = (props) => {
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormInner {...props} />
    </Elements>
  );
};

export default PaymentForm;
