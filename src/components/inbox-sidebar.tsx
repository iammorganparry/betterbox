"use client";

import { ArchiveX, Inbox, Send, Trash2, User } from "lucide-react";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Label } from "~/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
} from "~/components/ui/sidebar";
import { Switch } from "~/components/ui/switch";
import { sidebarConfig } from "./config/sidebar";
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";

interface ChatAttendee {
  id: string;
  external_id?: string | null;
  is_self?: number | null;
  contact?: {
    id: string;
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    profile_image_url?: string | null;
    provider_url?: string | null;
    headline?: string | null;
    member_urn?: string | null;
  } | null;
}

interface ChatData {
  id: string;
  name?: string | null;
  provider: string;
  last_message_at?: Date | null;
  unread_count: number;
  UnipileChatAttendee?: ChatAttendee[];
}

interface GroupedChat {
  email: string;
  name: string;
  date: string;
  subject: string;
  teaser: string;
  avatar: string | null;
  initials: string;
  provider: string;
}

export const InboxSidebar = () => {
  const [activeItem, setActiveItem] = useState(sidebarConfig[0]);
  const [showUnreadsOnly, setShowUnreadsOnly] = useState(false);
  const router = useRouter();
  const params = useParams();
  const selectedChatId = params?.chatId as string;

  // Fetch chats from TRPC - removed provider filter to get all providers
  const { data: chatsData, isLoading: chatsLoading } =
    api.inbox.getChats.useQuery({
      limit: 50,
      // provider: "linkedin", // Removed to get all providers
    });

  const typedChats = (chatsData as ChatData[]) || [];

  // Filter chats based on unread toggle
  const filteredChats = showUnreadsOnly
    ? typedChats.filter((chat) => chat.unread_count > 0)
    : typedChats;

  // Filter out chats without proper contact information
  const chatsWithContacts = filteredChats.filter((chat) => {
    const attendee = chat.UnipileChatAttendee?.find(
      (a: ChatAttendee) => a.is_self !== 1
    );
    const contact = attendee?.contact;
    // Only include chats where we have meaningful contact information
    return contact && (contact.full_name || contact.first_name);
  });

  // Convert chats to the existing mail format
  const mails: GroupedChat[] = chatsWithContacts.map((chat) => {
    const attendee = chat.UnipileChatAttendee?.find(
      (a: ChatAttendee) => a.is_self !== 1
    );
    const contact = attendee?.contact;
    const contactName =
      contact?.full_name || contact?.first_name || "Unknown Contact";

    return {
      email: chat.id, // Use chat ID as unique identifier
      name: contactName,
      date: chat.last_message_at
        ? formatDistanceToNow(new Date(chat.last_message_at), {
            addSuffix: true,
          })
        : "",
      subject: contact?.headline || "LinkedIn Contact",
      teaser: "Latest conversation...",
      avatar: contact?.profile_image_url || null,
      initials: contactName
        ? contactName
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : "UC",
      provider: chat.provider,
    };
  });

  // Group chats by provider
  const groupedChats = mails.reduce((groups, chat) => {
    const provider = chat.provider.toUpperCase();
    if (!groups[provider]) {
      groups[provider] = [];
    }
    groups[provider].push(chat);
    return groups;
  }, {} as Record<string, GroupedChat[]>);

  // Sort providers alphabetically and ensure LINKEDIN comes first if it exists
  const sortedProviders = Object.keys(groupedChats).sort((a, b) => {
    if (a === "LINKEDIN") return -1;
    if (b === "LINKEDIN") return 1;
    return a.localeCompare(b);
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
          sortedProviders.map((provider) => (
            <SidebarGroup key={provider} className="px-0">
              <SidebarGroupLabel className="px-4 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                {provider}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                {groupedChats[provider]?.map((mail) => (
                  <button
                    type="button"
                    key={mail.email}
                    onClick={() => router.push(`/inbox/${mail.email}`)}
                    className={`flex w-full flex-col items-start gap-2 whitespace-nowrap border-b p-4 text-left text-sm leading-tight last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                      selectedChatId === mail.email
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : ""
                    }`}
                  >
                    <div className="flex w-full items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={mail.avatar || undefined}
                          alt={mail.name}
                        />
                        <AvatarFallback className="text-xs">
                          {mail.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-1 items-center justify-between">
                        <span className="font-medium">{mail.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {mail.date}
                        </span>
                      </div>
                    </div>
                    <span className="ml-11 font-medium text-muted-foreground">
                      {mail.subject}
                    </span>
                    <span className="ml-11 line-clamp-2 w-[260px] whitespace-break-spaces text-muted-foreground text-xs">
                      {mail.teaser}
                    </span>
                  </button>
                ))}
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>
    </Sidebar>
  );
};
