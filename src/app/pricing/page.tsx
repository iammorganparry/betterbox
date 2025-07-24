import { PricingTable } from '@clerk/nextjs'
import { SidebarInset } from '~/components/ui/sidebar'
import { AppHeader } from '~/components/app-header'

export default function PricingPage() {
    return (
        <SidebarInset>
            <AppHeader />
            <div className="container mx-auto px-4 py-8">
                <div className="mb-8 text-center">
                    <h1 className="font-bold text-3xl tracking-tight mb-2">
                        Choose Your Plan
                    </h1>
                    <p className="text-muted-foreground">
                        Select the perfect plan for your LinkedIn messaging needs
                    </p>
                </div>

                <div className="max-w-4xl mx-auto px-4">
                    <PricingTable forOrganizations />
                </div>
            </div>
        </SidebarInset>
    )
} 