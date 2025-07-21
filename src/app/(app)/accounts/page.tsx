import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LinkedInConnectionCard } from "~/components/linkedin-connection-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { SidebarInset } from "~/components/ui/sidebar";
import { AppHeader } from "~/components/app-header";
import { HydrateClient } from "~/trpc/server";

export default async function AccountsPage() {
  const authResult = await auth();

  if (!authResult.userId) {
    redirect("/sign-in");
  }

  return (
    <SidebarInset>
      <AppHeader />
      <HydrateClient>
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="font-bold text-3xl tracking-tight">
              Connected Accounts
            </h1>
            <p className="mt-2 text-muted-foreground">
              Manage your social media connections and sync your messages
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* LinkedIn Connection Card */}
            <Suspense fallback={<AccountCardSkeleton />}>
              <LinkedInConnectionCard userId={authResult.userId} />
            </Suspense>
          </div>
        </div>
      </HydrateClient>
    </SidebarInset>
  );
}

function AccountCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
