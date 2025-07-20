import Link from "next/link";
import { AppHeader } from "~/components/app-header";
import { SidebarInset } from "~/components/ui/sidebar";

export default function UserSettingsPage() {
  return (
    <SidebarInset>
      <AppHeader
        breadcrumbLabels={{
          "user-settings": "User Settings",
        }}
      />
      <main className="p-4">
        <div className="space-y-6">
          <div>
            <h1 className="font-bold text-3xl">User Settings</h1>
            <p className="text-muted-foreground">
              Manage your account preferences and settings
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">Breadcrumb Path</h3>
              <p className="text-muted-foreground text-sm">
                Home → Dashboard → User Settings
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Navigation</h3>
              <div className="flex gap-4">
                <Link
                  href="/dashboard"
                  className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
                >
                  ← Back to Dashboard
                </Link>
                <Link
                  href="/"
                  className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  ← Back to Home
                </Link>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-semibold">Features Demonstrated</h3>
              <ul className="list-inside list-disc space-y-2 text-sm">
                <li>
                  <strong>Automatic breadcrumbs:</strong> Generated from path
                  `/dashboard/user-settings`
                </li>
                <li>
                  <strong>Custom labels:</strong> "user-settings" formatted as
                  "User Settings"
                </li>
                <li>
                  <strong>Clickable navigation:</strong> Each breadcrumb is a
                  working link
                </li>
                <li>
                  <strong>Responsive design:</strong> Home breadcrumb hidden on
                  mobile
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
}
