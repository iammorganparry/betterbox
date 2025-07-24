import { auth } from '@clerk/nextjs/server'
import { SidebarInset } from '~/components/ui/sidebar'
import { AppHeader } from '~/components/app-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { CheckCircle, Crown, CreditCard } from 'lucide-react'
import Link from 'next/link'
import {
    StarterProtection,
    ProfessionalProtection,
    EnterpriseProtection
} from '~/components/billing-protection'

export default async function BillingPage() {
    const { has } = await auth()

    // Check what plans/features the user has access to
    const hasStarterPlan = has({ plan: 'starter' })
    const hasProfessionalPlan = has({ plan: 'professional' })
    const hasEnterprisePlan = has({ plan: 'enterprise' })

    return (
        <SidebarInset>
            <AppHeader />
            <div className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="font-bold text-3xl tracking-tight mb-2">
                        Billing & Subscription
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your subscription and access premium features
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Current Plan Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Crown className="h-5 w-5" />
                                Current Plan
                            </CardTitle>
                            <CardDescription>
                                Your active subscription details
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {hasEnterprisePlan && (
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <Badge variant="default">Enterprise</Badge>
                                    </div>
                                )}
                                {hasProfessionalPlan && !hasEnterprisePlan && (
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <Badge variant="secondary">Professional</Badge>
                                    </div>
                                )}
                                {hasStarterPlan && !hasProfessionalPlan && !hasEnterprisePlan && (
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <Badge variant="outline">Starter</Badge>
                                    </div>
                                )}
                                {!hasStarterPlan && !hasProfessionalPlan && !hasEnterprisePlan && (
                                    <div className="text-muted-foreground">
                                        No active subscription
                                    </div>
                                )}

                                <Button asChild className="w-full">
                                    <Link href="/pricing">
                                        <CreditCard className="mr-2 h-4 w-4" />
                                        Change Plan
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Feature Access Demo */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Feature Access</CardTitle>
                            <CardDescription>
                                Features available based on your current plan
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <StarterProtection>
                                <Card className="border-green-200 dark:border-green-800">
                                    <CardContent className="p-3">
                                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                            ✓ Basic LinkedIn Integration
                                        </p>
                                    </CardContent>
                                </Card>
                            </StarterProtection>

                            <ProfessionalProtection>
                                <Card className="border-blue-200 dark:border-blue-800">
                                    <CardContent className="p-3">
                                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                            ✓ Advanced Analytics & Insights
                                        </p>
                                    </CardContent>
                                </Card>
                            </ProfessionalProtection>

                            <EnterpriseProtection>
                                <Card className="border-purple-200 dark:border-purple-800">
                                    <CardContent className="p-3">
                                        <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                            ✓ Team Collaboration & Management
                                        </p>
                                    </CardContent>
                                </Card>
                            </EnterpriseProtection>
                        </CardContent>
                    </Card>
                </div>

                {/* Upgrade CTA */}
                {!hasEnterprisePlan && (
                    <Card className="mt-6">
                        <CardHeader className="text-center">
                            <CardTitle>Unlock More Features</CardTitle>
                            <CardDescription>
                                Upgrade your plan to access premium features and enhanced capabilities
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                            <Button asChild size="lg">
                                <Link href="/pricing">
                                    View All Plans
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </SidebarInset>
    )
} 