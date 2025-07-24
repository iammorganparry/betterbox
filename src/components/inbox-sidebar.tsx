"use client";

import {
  ArchiveX,
  Inbox,
  Send,
  Trash2,
  User,
  MoreHorizontal,
  CheckCheck,
} from "lucide-react";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Label } from "~/components/ui/label";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { sidebarConfig } from "./config/sidebar";
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

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
  UnipileMessage?: Array<{
    id: string;
    content?: string | null;
    is_outgoing: boolean;
    sent_at?: Date | null;
  }>;
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
  const [markingAsReadId, setMarkingAsReadId] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const selectedChatId = params?.chatId as string;

  // Fetch chats from TRPC - removed provider filter to get all providers
  const {
    data: chatsData,
    isLoading: chatsLoading,
    refetch: refetchChats,
  } = api.inbox.getChats.useQuery({
    limit: 50,
    // provider: "linkedin", // Removed to get all providers
  });

  // Mark chat as read mutation
  const markChatAsReadMutation = api.inbox.markChatAsRead.useMutation({
    onSuccess: (data) => {
      toast.success("Chat marked as read");
      // Refetch chats to update the sidebar
      void refetchChats();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to mark chat as read");
    },
    onSettled: () => {
      setMarkingAsReadId(null);
    },
  });

  // Soft delete chat mutation
  const softDeleteChatMutation = api.inbox.softDeleteChat.useMutation({
    onSuccess: (data) => {
      toast.success("Chat deleted successfully");
      // Refetch chats to update the sidebar
      void refetchChats();
      // Navigate away if currently viewing the deleted chat
      if (selectedChatId === deletingChatId) {
        router.push("/inbox");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete chat");
    },
    onSettled: () => {
      setDeletingChatId(null);
    },
  });

  const handleMarkAsRead = async (chatId: string, chatName: string) => {
    setMarkingAsReadId(chatId);
    markChatAsReadMutation.mutate({ chatId });
  };

  const handleSoftDeleteChat = async (chatId: string, chatName: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete the conversation with ${chatName}? This action cannot be undone.`
      )
    ) {
      setDeletingChatId(chatId);
      softDeleteChatMutation.mutate({ chatId });
    }
  };

  const handleChatClick = async (
    chatId: string,
    hasUnreadMessages: boolean
  ) => {
    // Navigate to the chat
    router.push(`/inbox/${chatId}`);

    // Automatically mark as read if it has unread messages
    if (hasUnreadMessages && !markingAsReadId) {
      setMarkingAsReadId(chatId);
      markChatAsReadMutation.mutate({ chatId });
    }
  };

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

    // Get the latest message for teaser
    const latestMessage = chat.UnipileMessage?.[0];
    const messageTeaser = latestMessage?.content
      ? latestMessage.content.split(" ").slice(0, 8).join(" ") +
        (latestMessage.content.split(" ").length > 8 ? "..." : "")
      : "No messages yet";

    return {
      email: chat.id, // Use chat ID as unique identifier
      name: contactName,
      date: chat.last_message_at
        ? formatDistanceToNow(new Date(chat.last_message_at), {
            addSuffix: true,
          })
        : "",
      subject: contact?.headline || "",
      teaser: messageTeaser,
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
    <div className="flex min-h-screen justify-center border-gray-200 border-r bg-white pt-8">
      <div className="w-full max-w-md">
        <div className="p-6 pb-4">
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
          <Input placeholder="Type to search..." className="mt-3" />
        </div>
        <div className="p-0">
          {chatsLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Loading conversations...
            </div>
          ) : mails.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {showUnreadsOnly
                ? "No unread conversations"
                : "No conversations found"}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedProviders.map((provider) => (
                <div key={provider}>
                  <div className="border-b bg-muted/30 px-4 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    {provider}
                  </div>
                  <div>
                    {groupedChats[provider]?.map((mail) => {
                      const chatData = chatsData?.find(
                        (chat) => chat.id === mail.email
                      );
                      const hasUnreadMessages =
                        (chatData?.unread_count ?? 0) > 0;

                      return (
                        <div
                          key={mail.email}
                          className={`group flex w-full items-center border-b last:border-b-0 hover:bg-muted/50 ${
                            selectedChatId === mail.email ? "bg-muted" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleChatClick(mail.email, hasUnreadMessages)
                            }
                            className="flex flex-1 flex-col items-start gap-2 whitespace-nowrap p-4 text-left text-sm leading-tight"
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
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">
                                    {mail.date}
                                  </span>
                                  {/* Show unread indicator */}
                                  {hasUnreadMessages && (
                                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="ml-11 font-medium text-muted-foreground">
                              {mail.subject}
                            </span>
                            <span className="ml-11 line-clamp-2 w-[260px] whitespace-break-spaces text-muted-foreground text-xs">
                              {mail.teaser}
                            </span>
                          </button>

                          {/* Context menu for chat actions */}
                          <div className="p-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {hasUnreadMessages && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkAsRead(mail.email, mail.name);
                                    }}
                                    disabled={markingAsReadId === mail.email}
                                  >
                                    <CheckCheck className="mr-2 h-4 w-4" />
                                    {markingAsReadId === mail.email
                                      ? "Marking as read..."
                                      : "Mark as read"}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSoftDeleteChat(mail.email, mail.name);
                                  }}
                                  disabled={deletingChatId === mail.email}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {deletingChatId === mail.email
                                    ? "Deleting..."
                                    : "Delete conversation"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
