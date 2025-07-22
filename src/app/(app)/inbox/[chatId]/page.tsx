"use client";

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

interface ChatAttendee {
  id: string;
  external_id: string;
  is_self: number;
  contact?: {
    id: string;
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    profile_image_url?: string | null;
    headline?: string | null;
  } | null;
}

export default function ChatPage() {
  const params = useParams();
  const chatId = params?.chatId as string;

  // Fetch selected chat details and messages
  const { data: chatDetails, isLoading: chatLoading } =
    api.inbox.getChatDetails.useQuery(
      { chatId: chatId || "" },
      { enabled: !!chatId }
    );

  const { data: messages, isLoading: messagesLoading } =
    api.inbox.getChatMessages.useQuery(
      { chatId: chatId || "", limit: 50 },
      { enabled: !!chatId }
    );

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

  return (
    <div className="flex h-full flex-col">
      {/* Chat Header */}
      {chatDetails && (
        <div className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Get the contact info from attendees */}
            {chatDetails.UnipileChatAttendee?.map((attendee) => {
              const typedAttendee = attendee as ChatAttendee;
              if (typedAttendee.is_self !== 1 && typedAttendee.contact) {
                return (
                  <div key={attendee.id} className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={
                          typedAttendee.contact.profile_image_url || undefined
                        }
                        alt={typedAttendee.contact.full_name || "Contact"}
                      />
                      <AvatarFallback className="text-sm">
                        {typedAttendee.contact.full_name
                          ? typedAttendee.contact.full_name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)
                          : "UC"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-semibold">
                        {typedAttendee.contact.full_name ||
                          typedAttendee.contact.first_name ||
                          "LinkedIn Contact"}
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        {typedAttendee.contact.headline || "LinkedIn Contact"}
                      </p>
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
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.is_outgoing ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    message.is_outgoing
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
