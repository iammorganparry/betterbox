import { Protect } from '@clerk/nextjs'
import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import Link from 'next/link'
import { Crown, Lock } from 'lucide-react'

interface BillingProtectionProps {
    children: ReactNode
    plan?: string
    feature?: string
    permission?: string
    fallbackTitle?: string
    fallbackDescription?: string
}

export function BillingProtection({
    children,
    plan,
    feature,
    permission,
    fallbackTitle = "Premium Feature",
    fallbackDescription = "This feature requires a subscription to access."
}: BillingProtectionProps) {
    const fallback = (
        <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                    <Lock className="h-5 w-5" />
                    {fallbackTitle}
                </CardTitle>
                <CardDescription>
                    {fallbackDescription}
                </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
                <Crown className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                    Upgrade your plan to unlock this feature and many more.
                </p>
                <Button asChild>
                    <Link href="/pricing">
                        View Plans
                    </Link>
                </Button>
            </CardContent>
        </Card>
    )

    if (plan) {
        return (
            <Protect plan={plan} fallback={fallback}>
                {children}
            </Protect>
        )
    }

    if (feature) {
        return (
            <Protect feature={feature} fallback={fallback}>
                {children}
            </Protect>
        )
    }

    if (permission) {
        return (
            <Protect permission={permission} fallback={fallback}>
                {children}
            </Protect>
        )
    }

    return <>{children}</>
}

// Example usage components for different billing tiers
export function StarterProtection({ children }: { children: ReactNode }) {
    return (
        <BillingProtection
            plan="starter"
            fallbackTitle="Starter Plan Required"
            fallbackDescription="This feature requires at least a Starter subscription."
        >
            {children}
        </BillingProtection>
    )
}

export function ProfessionalProtection({ children }: { children: ReactNode }) {
    return (
        <BillingProtection
            plan="professional"
            fallbackTitle="Professional Plan Required"
            fallbackDescription="This feature requires a Professional subscription or higher."
        >
            {children}
        </BillingProtection>
    )
}

export function EnterpriseProtection({ children }: { children: ReactNode }) {
    return (
        <BillingProtection
            plan="enterprise"
            fallbackTitle="Enterprise Plan Required"
            fallbackDescription="This feature is only available to Enterprise subscribers."
        >
            {children}
        </BillingProtection>
    )
}

export function PremiumFeatureProtection({ children }: { children: ReactNode }) {
    return (
        <BillingProtection
            feature="premium_access"
            fallbackTitle="Premium Feature"
            fallbackDescription="This feature requires a plan with Premium Access."
        >
            {children}
        </BillingProtection>
    )
} 