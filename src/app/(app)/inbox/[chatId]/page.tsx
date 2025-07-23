"use client";

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useState } from "react";
import { Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ChatAttendee {
  id: string;
  external_id: string;
  is_self: number;
  contact?: {
    id: string;
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    headline?: string | null;
    profile_image_url?: string | null;
  } | null;
}

interface MessageData {
  id: string;
  content?: string | null;
  is_outgoing: boolean;
  is_read: boolean;
  sent_at?: Date | null;
  sender_id?: string | null;
}

export default function ChatPage() {
  const params = useParams();
  const chatId = params?.chatId as string;
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  // Fetch selected chat details and messages
  const { data: chatDetails, isLoading: chatLoading } =
    api.inbox.getChatDetails.useQuery(
      { chatId: chatId || "" },
      { enabled: !!chatId }
    );

  const { data: messages, isLoading: messagesLoading, refetch: refetchMessages } =
    api.inbox.getChatMessages.useQuery(
      { chatId: chatId || "", limit: 50 },
      { enabled: !!chatId }
    );

  // Delete message mutation
  const deleteMessageMutation = api.inbox.deleteMessage.useMutation({
    onSuccess: () => {
      toast.success("Message deleted successfully");
      // Refetch messages to update the UI
      void refetchMessages();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete message");
    },
    onSettled: () => {
      setDeletingMessageId(null);
    },
  });

  const handleDeleteMessage = async (messageId: string) => {
    if (window.confirm("Are you sure you want to delete this message? This action cannot be undone.")) {
      setDeletingMessageId(messageId);
      deleteMessageMutation.mutate({ messageId });
    }
  };

  if (!chatId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground">
          <h3 className="font-medium text-lg">Chat not found</h3>
          <p className="text-sm">
            The requested conversation could not be found
          </p>
        </div>
      </div>
    );
  }

  if (chatLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground">
          Loading chat details...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      {chatDetails && (
        <div className="border-b p-4">
          <div className="flex items-center gap-3">
            {chatDetails.UnipileChatAttendee?.map((attendee: ChatAttendee) => {
              if (attendee.is_self !== 1 && attendee.contact) {
                const contact = attendee.contact;
                const displayName =
                  contact.full_name ||
                  [contact.first_name, contact.last_name]
                    .filter(Boolean)
                    .join(" ") ||
                  "Unknown Contact";

                return (
                  <div key={attendee.id} className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={contact.profile_image_url || undefined}
                        alt={displayName}
                      />
                      <AvatarFallback>
                        {displayName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-medium text-lg">{displayName}</h2>
                      {contact.headline && (
                        <p className="text-sm text-muted-foreground">
                          {contact.headline}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {messagesLoading ? (
          <div className="text-center text-muted-foreground">
            Loading messages...
          </div>
        ) : messages && messages.length > 0 ? (
          <div className="space-y-4">
            {messages.map((message: MessageData) => (
              <div
                key={message.id}
                className={`group flex ${message.is_outgoing ? "justify-end" : "justify-start"
                  }`}
              >
                <div className="flex items-start gap-2 max-w-[70%]">
                  <div
                    className={`relative rounded-lg px-4 py-2 ${message.is_outgoing
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-900"
                      }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="mt-1 text-xs opacity-70">
                      {message.sent_at
                        ? new Date(message.sent_at).toLocaleTimeString()
                        : ""}
                    </p>
                  </div>

                  {/* Delete button - only show for user's own messages */}
                  {message.is_outgoing && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={deletingMessageId === message.id}
                            data-testid="message-options-button"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleDeleteMessage(message.id)}
                            className="text-red-600 focus:text-red-600"
                            disabled={deletingMessageId === message.id}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {deletingMessageId === message.id ? "Deleting..." : "Delete message"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            No messages in this conversation
          </div>
        )}
      </div>

      {/* Message Input Area */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            className="rounded-md bg-blue-500 px-4 py-2 font-medium text-sm text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
