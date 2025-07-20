import { ArchiveX, Inbox, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Label } from "~/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
} from "~/components/ui/sidebar";
import { Switch } from "~/components/ui/switch";
import { sidebarConfig } from "./config/sidebar";

export const InboxSidebar = () => {
  const [activeItem, setActiveItem] = useState(sidebarConfig[0]);
  const [mails, setMails] = useState<
    {
      email: string;
      name: string;
      date: string;
      subject: string;
      teaser: string;
    }[]
  >([]);
  return (
    <Sidebar collapsible="none" className="hidden flex-1 md:flex">
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="font-medium text-base text-foreground">
            {activeItem?.title}
          </div>
          <Label className="flex items-center gap-2 text-sm">
            <span>Unreads</span>
            <Switch className="shadow-none" />
          </Label>
        </div>
        <SidebarInput placeholder="Type to search..." />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            {mails.map((mail) => (
              <a
                href="/"
                key={mail.email}
                className="flex flex-col items-start gap-2 whitespace-nowrap border-b p-4 text-sm leading-tight last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <div className="flex w-full items-center gap-2">
                  <span>{mail.name}</span>{" "}
                  <span className="ml-auto text-xs">{mail.date}</span>
                </div>
                <span className="font-medium">{mail.subject}</span>
                <span className="line-clamp-2 w-[260px] whitespace-break-spaces text-xs">
                  {mail.teaser}
                </span>
              </a>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
