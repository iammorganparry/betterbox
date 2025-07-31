"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { api } from "~/trpc/react";

interface MessageInputProps {
  chatId: string;
  onMessageSent?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export const MessageInput = ({
  chatId,
  onMessageSent,
  disabled = false,
  placeholder = "Type a message...",
}: MessageInputProps) => {
  const [message, setMessage] = useState("");
  const utils = api.useUtils();

  // Send message mutation
  const sendMessageMutation = api.inbox.sendMessage.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await utils.inbox.getChatMessages.cancel({ chatId });

      // Snapshot the previous value
      const previousMessages = utils.inbox.getChatMessages.getData({ chatId });

      // Optimistically update to the new value
      if (previousMessages) {
        const optimisticMessage = {
          id: `temp-${Date.now()}`,
          external_id: `temp-${Date.now()}`,
          content: variables.content,
          is_outgoing: true,
          is_read: true,
          sent_at: new Date(),
          created_at: new Date(Date.now()),
          updated_at: new Date(Date.now()),
          sender_id: null,
          recipient_id: null,
          message_type: "text",
          seen: 1,
          hidden: 0,
          deleted: 0,
          edited: 0,
          is_event: 0,
          delivered: 1,
          behavior: 0,
          event_type: 0,
          replies: 0,
          sender_urn: null,
          attendee_type: null,
          attendee_distance: null,
          subject: null,
          parent: null,
          metadata: null,
          unipile_account_id: "",
          chat_id: chatId,
          is_deleted: false,
          external_chat_id: "",
        };

        utils.inbox.getChatMessages.setData({ chatId }, [
          ...previousMessages,
          optimisticMessage,
        ]);
      }

      // Return a context object with the snapshotted value
      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMessages) {
        utils.inbox.getChatMessages.setData(
          { chatId },
          context.previousMessages
        );
      }
      toast.error(err.message || "Failed to send message");
    },
    onSuccess: async () => {
      toast.success("Message sent successfully");
      setMessage(""); // Clear the input

      // Invalidate queries to get the real data from server
      await Promise.all([
        utils.inbox.getChatMessages.invalidate({ chatId }),
        utils.inbox.getChatDetails.invalidate({ chatId }),
        utils.inbox.getChats.invalidate(), // Update chat list with latest message
      ]);

      onMessageSent?.(); // Still call the callback if provided
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (message.trim().length > 2000) {
      toast.error("Message is too long (max 2000 characters)");
      return;
    }

    sendMessageMutation.mutate({
      chatId,
      content: message.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as React.FormEvent);
    }
  };

  const isLoading = sendMessageMutation.isPending;
  const isDisabled = disabled || isLoading || !message.trim();

  return (
    <div className="border-t bg-background p-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          rows={1}
        />
        <Button
          type="submit"
          disabled={isDisabled}
          size="sm"
          className="self-end"
          aria-label="Send message"
        >
          {isLoading ? (
            <Loader2
              className="h-4 w-4 animate-spin"
              data-testid="loading-spinner"
            />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
      {message.length > 1800 && (
        <div className="mt-1 text-right text-muted-foreground text-xs">
          {2000 - message.length} characters remaining
        </div>
      )}
    </div>
  );
};
