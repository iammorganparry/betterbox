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
    placeholder = "Type a message..."
}: MessageInputProps) => {
    const [message, setMessage] = useState("");

    // Send message mutation
    const sendMessageMutation = api.inbox.sendMessage.useMutation({
        onSuccess: () => {
            toast.success("Message sent successfully");
            setMessage(""); // Clear the input
            onMessageSent?.(); // Trigger refetch of messages
        },
        onError: (error) => {
            toast.error(error.message || "Failed to send message");
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
                    className="flex-1 min-h-[44px] max-h-32 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                        <Loader2 className="h-4 w-4 animate-spin" data-testid="loading-spinner" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </form>
            {message.length > 1800 && (
                <div className="mt-1 text-xs text-muted-foreground text-right">
                    {2000 - message.length} characters remaining
                </div>
            )}
        </div>
    );
}; 