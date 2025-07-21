"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  MessageCircle,
  Send,
  MoreVertical,
  Clock,
  CheckCheck,
  Check,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
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

interface MessageData {
  id: string;
  content?: string | null;
  is_outgoing: boolean;
  is_read: boolean;
  sent_at?: Date | null;
  sender_id?: string | null;
}

export default function InboxPage() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Fetch chats
  const {
    data: chatsData,
    isLoading: chatsLoading,
    error: chatsError,
  } = api.inbox.getChats.useQuery({
    limit: 50,
    provider: "linkedin",
  });

  // Fetch messages for selected chat
  const { data: messagesData, isLoading: messagesLoading } =
    api.inbox.getChatMessages.useQuery(
      { chatId: selectedChatId ?? "", limit: 100 },
      { enabled: !!selectedChatId }
    );

  // Fetch chat details for selected chat
  const { data: chatDetails } = api.inbox.getChatDetails.useQuery(
    { chatId: selectedChatId ?? "" },
    { enabled: !!selectedChatId }
  );

  const handleChatSelect = (chatId: string) => {
    setSelectedChatId(chatId);
  };

  if (chatsError) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive">
              Error Loading Inbox
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Failed to load your conversations. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const typedChats = (chatsData as ChatData[]) || [];
  const typedMessages = (messagesData as MessageData[]) || [];
  const typedChatDetails = chatDetails as
    | { UnipileChatAttendee?: ChatAttendee[] }
    | undefined;

  if (!selectedChatId) {
    return (
      <div className="flex h-full w-full">
        {/* Empty State */}
        <div className="flex flex-1 items-center justify-center bg-muted/10">
          <div className="text-center">
            <MessageCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 font-medium text-xl">Select a conversation</h3>
            <p className="mx-auto max-w-sm text-muted-foreground text-sm">
              Choose a conversation from your inbox to view and respond to
              messages
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Selected chat view
  const selectedAttendee = typedChatDetails?.UnipileChatAttendee?.find(
    (a: ChatAttendee) => a.is_self !== 1
  );

  return (
    <div className="flex h-full">
      {/* Message View */}
      <div className="flex flex-1 flex-col bg-background">
        {/* Header */}
        <div className="border-b bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedChatId(null)}
                className="md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <Avatar className="h-8 w-8">
                <AvatarImage src={selectedAttendee?.profile_image_url || ""} />
                <AvatarFallback>
                  {selectedAttendee?.name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>

              <div>
                <h3 className="font-medium text-sm">
                  {selectedAttendee?.name || "Unknown Contact"}
                </h3>
                {selectedAttendee?.headline && (
                  <p className="text-muted-foreground text-xs">
                    {selectedAttendee.headline}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {selectedAttendee?.profile_url && (
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href={selectedAttendee.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6">
          {messagesLoading ? (
            <div className="space-y-6">
              {Array.from({ length: 5 }, (_, i) => i).map((i) => (
                <div key={`message-loading-${i}`} className="flex space-x-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-20 w-80" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="max-w-4xl space-y-6">
              {typedMessages.map((message) => {
                const messageAttendee =
                  typedChatDetails?.UnipileChatAttendee?.find(
                    (a: ChatAttendee) => a.external_id === message.sender_id
                  );

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex space-x-3",
                      message.is_outgoing && "flex-row-reverse space-x-reverse"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={
                          message.is_outgoing
                            ? ""
                            : messageAttendee?.profile_image_url || ""
                        }
                      />
                      <AvatarFallback className="text-xs">
                        {message.is_outgoing
                          ? "You"
                          : messageAttendee?.name?.charAt(0)?.toUpperCase() ||
                            "?"}
                      </AvatarFallback>
                    </Avatar>

                    <div
                      className={cn(
                        "max-w-lg",
                        message.is_outgoing && "text-right"
                      )}
                    >
                      <div className="mb-2 flex items-center space-x-2">
                        <p className="font-medium text-muted-foreground text-xs">
                          {message.is_outgoing
                            ? "You"
                            : messageAttendee?.name || "Unknown"}
                        </p>
                        {message.sent_at && (
                          <p className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(message.sent_at), {
                              addSuffix: true,
                            })}
                          </p>
                        )}
                      </div>

                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                          message.is_outgoing
                            ? "bg-blue-500 text-white"
                            : "border bg-muted"
                        )}
                      >
                        {message.content || "No content"}
                      </div>

                      {message.is_outgoing && (
                        <div className="mt-1 flex justify-end">
                          {message.is_read ? (
                            <CheckCheck className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <Check className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t bg-background p-4">
          <div className="flex max-w-4xl items-end space-x-3">
            <div className="flex-1">
              <div className="relative">
                <textarea
                  placeholder="Type a message..."
                  className="max-h-32 min-h-[44px] w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={1}
                />
              </div>
            </div>
            <Button size="sm" className="h-11 w-11 rounded-full p-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
