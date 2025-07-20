import { InboxSidebar } from "~/components/inbox-sidebar";
import { SidebarInset } from "~/components/ui/sidebar";
import { AppHeader } from "~/components/app-header";

export default function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <InboxSidebar />
      <SidebarInset>
        <AppHeader
          breadcrumbLabels={{
            inbox: "Inbox",
          }}
        />
        {children}
      </SidebarInset>
    </div>
  );
}
