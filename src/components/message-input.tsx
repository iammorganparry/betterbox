"use client";

import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { useMessages } from "~/contexts/messages-context";
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
	const [tempMessageId, setTempMessageId] = useState<string | null>(null);
	const { addOptimisticMessage, markMessageAsFailed, removeOptimisticMessage } =
		useMessages();
	const utils = api.useUtils();

	// Send message mutation (simplified)
	const sendMessageMutation = api.inbox.sendMessage.useMutation({
		onError: (err, variables) => {
			// Mark the optimistic message as failed or remove it
			if (tempMessageId) {
				markMessageAsFailed(chatId, tempMessageId);
				// Or remove it entirely: removeOptimisticMessage(chatId, tempMessageId);
			}

			// Restore the message to the input if it failed to send
			setMessage(variables.content);
			toast.error(err.message || "Failed to send message");
			setTempMessageId(null);
		},
		onSuccess: async (data) => {
			toast.success("Message sent successfully");
			setTempMessageId(null);

			// Invalidate both chats and messages to get fresh data
			await Promise.all([
				utils.inbox.getChats.invalidate(),
				utils.inbox.getChatMessages.invalidate({ chatId }),
			]);

			onMessageSent?.();
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

		const messageContent = message.trim();

		// Immediately add optimistic message for instant feedback
		const optimisticMessageId = addOptimisticMessage(chatId, messageContent);
		setTempMessageId(optimisticMessageId);

		// Clear the input immediately for better UX
		setMessage("");

		// Send the message
		sendMessageMutation.mutate({
			chatId,
			content: messageContent,
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
