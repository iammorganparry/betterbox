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
  onSuccess: (paymentMethodId: string) => void;
  onError: (error: string) => void;
  onBack: () => void;
}

interface PaymentFormInnerProps extends PaymentFormProps {
  clientSecret?: string;
}

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

  // Handle free plan (no pricing data needed)
  if (selectedPlanLower === "free") {
    // For free plan, show different UI - this shouldn't normally happen in payment flow
    return (
      <div className="space-y-4 rounded-lg bg-green-50 p-4">
        <h3 className="font-semibold text-green-900">Free Plan Selected</h3>
        <p className="text-green-700 text-sm">
          You've selected the free plan. No payment information is required.
        </p>
      </div>
    );
  }

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
          onSuccess(setupIntent.payment_method as string);
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
          onSuccess(paymentMethod.id);
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
        color: "#424770",
        "::placeholder": { color: "#aab7c4" },
      },
      invalid: { color: "#9e2146" },
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
          <div className="space-y-4 rounded-lg bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">Cost Breakdown</h3>

            <div className="space-y-3">
              {/* Trial Period */}
              <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 p-3">
                <div>
                  <p className="flex items-center gap-2 font-medium text-blue-900">
                    7-Day Gold Trial
                    <Badge
                      variant="secondary"
                      className="bg-yellow-100 text-xs text-yellow-800"
                    >
                      Premium
                    </Badge>
                  </p>
                  <p className="text-blue-700 text-sm">
                    All premium features unlocked
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-4xl text-blue-900">$0.00</p>
                  <p className="text-blue-600 text-xs">Free trial</p>
                </div>
              </div>

              {/* After Trial */}
              <div className="flex items-center justify-between rounded-md border bg-white p-3">
                <div>
                  <p className="font-medium text-slate-900">
                    After Trial - {selectedPlan} Plan
                  </p>
                  <p className="text-slate-600 text-sm">
                    Billed {isAnnual ? "annually" : "monthly"}
                    {isAnnual && savings > 0 && (
                      <span className="ml-1 font-medium text-green-600">
                        (Save ${Math.round(savings)}/year)
                      </span>
                    )}
                  </p>
                  {/* Add plan features hint */}
                  <p className="mt-1 text-slate-500 text-xs">
                    {selectedPlanLower === "starter" &&
                      "1,000 contacts, Advanced messaging"}
                    {selectedPlanLower === "professional" &&
                      "5,000 contacts, Team collaboration, Analytics"}
                    {selectedPlanLower === "enterprise" &&
                      "Unlimited contacts, Custom integrations, Dedicated support"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">
                    ${currentPrice}
                    <span className="font-normal text-slate-600 text-sm">
                      /{isAnnual ? "year" : "month"}
                    </span>
                  </p>
                  {isAnnual && (
                    <p className="text-slate-500 text-xs">
                      (~${Math.round(monthlyEquivalent)}/month)
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="border-slate-200 border-t pt-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">Today's Charge</p>
                <p className="font-bold text-5xl text-slate-900">$0.00</p>
              </div>
              <p className="mt-1 text-slate-500 text-xs">
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

          <div className="rounded-md border p-3">
            <CardElement options={cardElementOptions} />
          </div>

          <div className="rounded-md bg-blue-50 p-4">
            <div className="flex items-start space-x-2">
              <CheckIcon className="mt-0.5 h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Secure Payment</p>
                <p className="text-blue-700 text-sm">
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
