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

export default async function AccountsPage() {
  const authResult = await auth();

  if (!authResult.userId) {
    redirect("/sign-in");
  }

  return (
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

        {/* Placeholder for future social platforms */}
        <Card className="opacity-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-blue-500" />
              Twitter / X
            </CardTitle>
            <CardDescription>
              Connect your Twitter account to sync messages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Coming soon...</p>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-green-500" />
              WhatsApp
            </CardTitle>
            <CardDescription>
              Connect your WhatsApp to sync messages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </div>
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
