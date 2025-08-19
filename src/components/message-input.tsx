"use client";

// @ts-ignore - TypeScript issue with module resolution
import Emoji, { gitHubEmojis } from "@tiptap/extension-emoji";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Image as ImageIcon, Loader2, Paperclip, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { type FileAttachment, FileUpload } from "~/components/file-upload";
import { EmojiDropdownMenu } from "~/components/tiptap-ui/emoji-dropdown-menu";
import { EmojiTriggerButton } from "~/components/tiptap-ui/emoji-trigger-button";
import { ImageUploadButton } from "~/components/tiptap-ui/image-upload-button";
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
	const [attachments, setAttachments] = useState<FileAttachment[]>([]);
	const [tempMessageId, setTempMessageId] = useState<string | null>(null);
	const [isExpanded, setIsExpanded] = useState(false);
	const { addOptimisticMessage, markMessageAsFailed, removeOptimisticMessage } =
		useMessages();
	const utils = api.useUtils();

	// Tiptap editor setup
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				// Disable some features we don't need for chat
				heading: false,
				blockquote: false,
				horizontalRule: false,
				bulletList: false,
				orderedList: false,
				listItem: false,
				codeBlock: false,
			}),
			Placeholder.configure({
				placeholder: placeholder || "Type a message...",
			}),
			Emoji.configure({
				enableEmoticons: true,
			}),
			Image.configure({
				inline: true,
				allowBase64: true,
			}),
		],
		content: "",
		editable: !disabled,
		immediatelyRender: false,
		autofocus: true,
		onUpdate: ({ editor }) => {
			// Handle expansion based on content length
			const text = editor.getText();
			setIsExpanded(text.length > 50);
		},
		editorProps: {
			handleKeyDown: (view, event) => {
				// Handle Shift+Enter for sending (Enter alone creates new line)
				if (event.key === "Enter" && event.shiftKey) {
					event.preventDefault();
					handleSubmit();
					return true;
				}
				return false;
			},
			attributes: {
				class:
					"prose prose-sm focus:outline-none focus-visible:outline-none tiptap-message-input",
			},
		},
	});

	// Send message mutation
	const sendMessageMutation = api.inbox.sendMessage.useMutation({
		onError: (err, variables) => {
			// Mark the optimistic message as failed or remove it
			if (tempMessageId) {
				markMessageAsFailed(chatId, tempMessageId);
			}

			// Restore the message to the input if it failed to send
			if (editor && variables.content) {
				editor.commands.setContent(variables.content);
			}
			toast.error(err.message || "Failed to send message");
			setTempMessageId(null);
		},
		onSuccess: async (data) => {
			toast.success("Message sent successfully");
			setTempMessageId(null);

			// Clear attachments on successful send
			setAttachments([]);

			// Invalidate both chats and messages to get fresh data
			await Promise.all([
				utils.inbox.getChats.invalidate(),
				utils.inbox.getChatMessages.invalidate({ chatId }),
			]);

			onMessageSent?.();
		},
	});

	const handleSubmit = useCallback(() => {
		if (!editor) return;

		const message = editor.getText().trim();

		if (!message && attachments.length === 0) {
			toast.error("Please enter a message or add an attachment");
			return;
		}

		if (message.length > 2000) {
			toast.error("Message is too long (max 2000 characters)");
			return;
		}

		const messageContent = message || "";

		// Prepare attachments for the API and optimistic message
		const messageAttachments = attachments.map((attachment) => ({
			type: attachment.file.type,
			filename: attachment.file.name,
			data: attachment.data, // Base64 encoded data
		}));

		// Immediately add optimistic message for instant feedback (now with attachments)
		const optimisticMessageId = addOptimisticMessage(
			chatId,
			messageContent,
			messageAttachments.length > 0 ? messageAttachments : undefined,
		);
		setTempMessageId(optimisticMessageId);

		// Clear the input and attachments immediately for better UX
		editor.commands.clearContent();
		setAttachments([]);
		setIsExpanded(false);

		// Refocus the editor after clearing
		setTimeout(() => {
			editor.commands.focus();
		}, 50);

		// Send the message
		sendMessageMutation.mutate({
			chatId,
			content: messageContent,
			attachments:
				messageAttachments.length > 0 ? messageAttachments : undefined,
		});
	}, [editor, attachments, chatId, addOptimisticMessage, sendMessageMutation]);

	// Update editor disabled state when prop changes
	useEffect(() => {
		if (editor) {
			editor.setEditable(!disabled);
		}
	}, [disabled, editor]);

	// Focus editor when it's ready
	useEffect(() => {
		if (editor && !disabled) {
			// Small delay to ensure DOM is ready
			const timer = setTimeout(() => {
				editor.commands.focus();
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [editor, disabled]);

	const isLoading = sendMessageMutation.isPending;
	const message = editor?.getText() || "";
	const isDisabled =
		disabled || isLoading || (!message.trim() && attachments.length === 0);

	return (
		<div className="border-t bg-background">
			{/* File attachments area */}
			<div className="p-4 pb-2">
				<FileUpload
					onFilesChange={setAttachments}
					maxFiles={5}
					maxFileSize={10}
					disabled={disabled || isLoading}
				>
					{(processFiles) => (
						<div className="flex items-center gap-2">
							{/* File attachment button */}
							<input
								type="file"
								multiple
								accept="*/*"
								onChange={(e) => {
									if (e.target.files && e.target.files.length > 0) {
										processFiles(e.target.files);
									}
									e.target.value = "";
								}}
								disabled={disabled || isLoading}
								className="hidden"
								id="file-upload-input"
							/>
							<label htmlFor="file-upload-input">
								<Button
									variant="ghost"
									size="sm"
									className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
									disabled={disabled || isLoading}
									asChild
								>
									<span className="cursor-pointer">
										<Paperclip className="h-4 w-4" />
									</span>
								</Button>
							</label>

							{/* Image attachment using Tiptap component */}
							<ImageUploadButton
								editor={editor}
								onInserted={() => {
									toast.success("Image uploaded successfully");
									// Focus editor after image insertion
									setTimeout(() => {
										editor?.commands.focus();
									}, 50);
								}}
								hideWhenUnavailable={false}
								className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
								disabled={disabled || isLoading}
							>
								<ImageIcon className="h-4 w-4" />
							</ImageUploadButton>

							{/* Emoji trigger using Tiptap component */}
							<EmojiTriggerButton
								editor={editor}
								hideWhenUnavailable={false}
								onTriggerApplied={() => {
									// Focus editor after emoji trigger
									setTimeout(() => {
										editor?.commands.focus();
									}, 50);
								}}
								className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
								disabled={disabled || isLoading}
							/>
						</div>
					)}
				</FileUpload>
			</div>

			{/* Message input area with motion animation */}
			<div className="p-4 pt-2">
				<div className="flex w-full gap-2">
					<div
						className={`flex-1 transition-all duration-300 ease-out ${
							isExpanded ? "scale-105 transform" : "scale-100 transform"
						}`}
						style={{
							transform: isExpanded ? "scale(1.02)" : "scale(1)",
							transformOrigin: "bottom left",
						}}
					>
						<div className="relative">
							<EditorContent
								editor={editor}
								className="max-h-32 min-h-[44px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm transition-all duration-200 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
							/>
							{/* Add Tiptap emoji dropdown */}
							{editor && <EmojiDropdownMenu editor={editor} />}
						</div>
					</div>
					<Button
						type="button"
						onClick={handleSubmit}
						disabled={isDisabled}
						size="sm"
						className="self-end transition-all duration-200 hover:scale-105"
						aria-label={"Send message (Shift+Enter)"}
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
				</div>
				{message.length > 1800 && (
					<div className="mt-1 animate-pulse text-right text-muted-foreground text-xs">
						{2000 - message.length} characters remaining
					</div>
				)}
				{/* Hint for keyboard shortcut */}
				<div className="mt-1 text-center text-muted-foreground text-xs">
					Press <span className="font-medium">Shift + Enter</span> to send •{" "}
					<span className="font-medium">Enter</span> for new line
				</div>
			</div>
		</div>
	);
};
