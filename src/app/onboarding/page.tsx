'use client'

import * as React from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { PricingTable } from '@clerk/nextjs'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Progress } from '~/components/ui/progress'
import { LinkedInConnectionCard } from '~/components/linkedin-connection-card'
import { updateOnboardingStep, completeOnboarding } from './_actions'
import { CheckCircle, Circle, ArrowRight, ArrowLeft, CreditCard, Crown, Building } from 'lucide-react'
import { toast } from 'sonner'
import { Separator } from '~/components/ui/separator'

type OnboardingStep = 'linkedin' | 'plan' | 'payment'

interface StepInfo {
    id: OnboardingStep
    title: string
    description: string
    icon: React.ReactNode
    completed: boolean
}

export default function OnboardingPage() {
    const [currentStep, setCurrentStep] = React.useState<OnboardingStep>('linkedin')
    const [loading, setLoading] = React.useState(false)
    const [selectedPlan, setSelectedPlan] = React.useState<string>('')
    const { user } = useUser()
    const router = useRouter()

    // Initialize completion states from user metadata
    const [stepCompletion, setStepCompletion] = React.useState({
        linkedin: false,
        plan: false,
        payment: false,
    })

    // Initialize step completion states from user metadata
    React.useEffect(() => {
        if (user?.publicMetadata) {
            const metadata = user.publicMetadata as any
            setStepCompletion({
                linkedin: Boolean(metadata.linkedinConnected),
                plan: Boolean(metadata.stripeSubscribed || metadata.planSelected),
                payment: Boolean(metadata.cardDetailsAdded || metadata.paymentMethodAdded),
            })

            // Set current step based on completion
            if (!metadata.linkedinConnected) {
                setCurrentStep('linkedin')
            } else if (!metadata.stripeSubscribed && !metadata.planSelected) {
                setCurrentStep('plan')
            } else if (!metadata.cardDetailsAdded && !metadata.paymentMethodAdded) {
                setCurrentStep('payment')
            } else {
                // All steps completed - show payment completion view
                setCurrentStep('payment')
            }
        }
    }, [user])

    const steps: StepInfo[] = [
        {
            id: 'linkedin',
            title: 'Connect LinkedIn',
            description: 'Link your LinkedIn account to sync messages',
            icon: <Building className="h-5 w-5" />,
            completed: stepCompletion.linkedin,
        },
        {
            id: 'plan',
            title: 'Choose Plan',
            description: 'Select a subscription plan',
            icon: <Crown className="h-5 w-5" />,
            completed: stepCompletion.plan,
        },
        {
            id: 'payment',
            title: 'Payment Details',
            description: 'Add your payment information',
            icon: <CreditCard className="h-5 w-5" />,
            completed: stepCompletion.payment,
        },
    ]

    const currentStepIndex = steps.findIndex(step => step.id === currentStep)
    const progress = ((currentStepIndex + 1) / steps.length) * 100

    const handleStepCompletion = async (step: OnboardingStep) => {
        setLoading(true)
        try {
            const updateData = { [`${step}Connected`]: true }
            const result = await updateOnboardingStep(updateData)

            if (result.success) {
                setStepCompletion(prev => ({ ...prev, [step]: true }))
                toast.success(`${steps.find(s => s.id === step)?.title} completed!`)

                // Move to next step
                if (step === 'linkedin') setCurrentStep('plan')
                else if (step === 'plan') setCurrentStep('payment')
                else if (step === 'payment') {
                    await handleCompleteOnboarding()
                }
            } else {
                toast.error(result.error || 'Failed to update step')
            }
        } catch (error) {
            toast.error('An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const handleCompleteOnboarding = async () => {
        setLoading(true)
        try {
            const result = await completeOnboarding()

            if (result.success) {
                await user?.reload()
                toast.success('Onboarding completed! Welcome to BetterBox!')
                router.push('/')
            } else {
                toast.error(result.error || 'Failed to complete onboarding')
            }
        } catch (error) {
            toast.error('An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const renderStepContent = () => {
        switch (currentStep) {
            case 'linkedin':
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold">Connect your LinkedIn account</h2>
                            <p className="text-muted-foreground mt-2">
                                Start by connecting your LinkedIn account to sync your messages and contacts.
                            </p>
                        </div>

                        <div className="max-w-md mx-auto">
                            <LinkedInConnectionCard userId={user?.id || ''} />
                        </div>

                        <div className="text-center">
                            <Button
                                onClick={() => handleStepCompletion('linkedin')}
                                disabled={loading}
                                size="lg"
                            >
                                Continue to Plan Selection
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )

            case 'plan':
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold">Choose your plan</h2>
                            <p className="text-muted-foreground mt-2">
                                Select a subscription plan that fits your needs.
                            </p>
                        </div>

                        {/* Clerk PricingTable Component */}
                        <div className="max-w-4xl mx-auto">
                            <PricingTable forOrganizations />
                        </div>

                        <div className="text-center">
                            <p className="text-muted-foreground text-sm mb-4">
                                Once you select a plan above, you'll be able to continue to payment details.
                            </p>
                            <Button
                                onClick={() => handleStepCompletion('plan')}
                                disabled={loading}
                                size="lg"
                            >
                                Continue to Payment
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )

            case 'payment':
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold">Payment completed!</h2>
                            <p className="text-muted-foreground mt-2">
                                Your payment has been processed through Clerk's billing system.
                            </p>
                        </div>

                        <Card className="max-w-md mx-auto">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5 text-green-600" data-testid="setup-complete-check" />
                                    Setup Complete
                                </CardTitle>
                                <CardDescription>
                                    Your subscription is now active and ready to use.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <CheckCircle className="h-4 w-4 text-green-600" data-testid="linkedin-check" />
                                        <span>LinkedIn account connected</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <CheckCircle className="h-4 w-4 text-green-600" data-testid="plan-check" />
                                        <span>Subscription plan selected</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <CheckCircle className="h-4 w-4 text-green-600" data-testid="payment-check" />
                                        <span>Payment method added</span>
                                    </div>
                                </div>

                                <Separator />

                                <Button
                                    onClick={() => handleCompleteOnboarding()}
                                    disabled={loading}
                                    className="w-full"
                                    size="lg"
                                >
                                    {loading ? (
                                        <>Loading...</>
                                    ) : (
                                        <>
                                            Get Started with BetterBox
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )

            default:
                return null
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Welcome to BetterBox</h1>
                    <p className="text-muted-foreground">Let's get you set up in just a few steps</p>
                </div>

                {/* Progress */}
                <div className="max-w-2xl mx-auto mb-8">
                    <div className="flex items-center justify-between mb-4">
                        {steps.map((step, index) => (
                            <div key={step.id} className="flex items-center">
                                <div className={`flex items-center gap-2 ${step.id === currentStep ? 'text-primary' :
                                    step.completed ? 'text-green-600' : 'text-muted-foreground'
                                    }`}>
                                    {step.completed ? (
                                        <CheckCircle className="h-5 w-5" data-testid="check-circle" />
                                    ) : (
                                        step.icon
                                    )}
                                    <span className="font-medium text-sm">{step.title}</span>
                                </div>
                                {index < steps.length - 1 && (
                                    <ArrowRight className="h-4 w-4 mx-4 text-muted-foreground" />
                                )}
                            </div>
                        ))}
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>

                {/* Step Content */}
                <div className="max-w-4xl mx-auto">
                    {renderStepContent()}
                </div>

                {/* Navigation */}
                <div className="max-w-2xl mx-auto mt-8 flex justify-between">
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (currentStep === 'plan') setCurrentStep('linkedin')
                            else if (currentStep === 'payment') setCurrentStep('plan')
                        }}
                        disabled={currentStep === 'linkedin' || loading}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>

                    <div className="text-sm text-muted-foreground">
                        Step {currentStepIndex + 1} of {steps.length}
                    </div>
                </div>
            </div>
        </div>
    )
} 