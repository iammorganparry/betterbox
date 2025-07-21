import { SidebarInset } from "~/components/ui/sidebar";
import { AppHeader } from "~/components/app-header";
import { InboxSidebar } from "~/components/inbox-sidebar";

export default function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <InboxSidebar />
      <SidebarInset>
        <AppHeader
          breadcrumbLabels={{
            inbox: "Inbox",
          }}
        />
        {children}
      </SidebarInset>
    </>
  );
}
