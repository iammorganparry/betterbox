"use client";

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
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";

interface ChatAttendee {
  id: string;
  name?: string | null;
  profile_image_url?: string | null;
  profile_url?: string | null;
  headline?: string | null;
  is_self?: number | null;
  external_id?: string | null;
}

interface ChatData {
  id: string;
  name?: string | null;
  last_message_at?: Date | null;
  unread_count: number;
  UnipileChatAttendee?: ChatAttendee[];
}

export const InboxSidebar = () => {
  const [activeItem, setActiveItem] = useState(sidebarConfig[0]);
  const [showUnreadsOnly, setShowUnreadsOnly] = useState(false);

  // Fetch chats from TRPC
  const { data: chatsData, isLoading: chatsLoading } =
    api.inbox.getChats.useQuery({
      limit: 50,
      provider: "linkedin",
    });

  const typedChats = (chatsData as ChatData[]) || [];

  // Filter chats based on unread toggle
  const filteredChats = showUnreadsOnly
    ? typedChats.filter((chat) => chat.unread_count > 0)
    : typedChats;

  // Convert chats to the existing mail format
  const mails = filteredChats.map((chat) => {
    const attendee = chat.UnipileChatAttendee?.find(
      (a: ChatAttendee) => a.is_self !== 1
    );
    return {
      email: chat.id, // Use chat ID as unique identifier
      name: attendee?.name || "Unknown Contact",
      date: chat.last_message_at
        ? formatDistanceToNow(new Date(chat.last_message_at), {
            addSuffix: true,
          })
        : "",
      subject: attendee?.headline || "LinkedIn Contact",
      teaser: "Latest conversation...",
    };
  });

  return (
    <Sidebar collapsible="none" className="hidden max-w-80 flex-1 md:flex">
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="font-medium text-base text-foreground">
            {activeItem?.title}
          </div>
          <Label className="flex items-center gap-2 text-sm">
            <span>Unreads</span>
            <Switch
              className="shadow-none"
              checked={showUnreadsOnly}
              onCheckedChange={setShowUnreadsOnly}
            />
          </Label>
        </div>
        <SidebarInput placeholder="Type to search..." />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            {chatsLoading ? (
              <div className="p-4 text-muted-foreground text-sm">
                Loading conversations...
              </div>
            ) : mails.length === 0 ? (
              <div className="p-4 text-muted-foreground text-sm">
                {showUnreadsOnly
                  ? "No unread conversations"
                  : "No conversations found"}
              </div>
            ) : (
              mails.map((mail) => (
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
              ))
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
