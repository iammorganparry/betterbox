"use client";

import { Image, Loader2, Paperclip, Send, Smile } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { type FileAttachment, FileUpload } from "~/components/file-upload";
import {
  RichTextEditor,
  type RichTextEditorRef,
} from "~/components/rich-text-editor";
import { Button } from "~/components/ui/button";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerSearch,
} from "~/components/ui/emoji-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
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
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [tempMessageId, setTempMessageId] = useState<string | null>(null);
  const editorRef = useRef<RichTextEditorRef>(null);
  const { addOptimisticMessage, markMessageAsFailed, removeOptimisticMessage } =
    useMessages();
  const utils = api.useUtils();

  // Send message mutation
  const sendMessageMutation = api.inbox.sendMessage.useMutation({
    onError: (err, variables) => {
      // Mark the optimistic message as failed or remove it
      if (tempMessageId) {
        markMessageAsFailed(chatId, tempMessageId);
      }

      // Restore the message to the input if it failed to send
      setMessage(variables.content);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim() && attachments.length === 0) {
      toast.error("Please enter a message or add an attachment");
      return;
    }

    if (message.trim().length > 2000) {
      toast.error("Message is too long (max 2000 characters)");
      return;
    }

    const messageContent = message.trim() || "";

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
      messageAttachments.length > 0 ? messageAttachments : undefined
    );
    setTempMessageId(optimisticMessageId);

    // Clear the input and attachments immediately for better UX
    setMessage("");
    setAttachments([]);

    // Send the message
    sendMessageMutation.mutate({
      chatId,
      content: messageContent,
      attachments:
        messageAttachments.length > 0 ? messageAttachments : undefined,
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Create a synthetic form event
      const syntheticEvent = {
        preventDefault: () => e.preventDefault(),
        target: e.target,
        currentTarget: e.target,
      } as React.FormEvent;
      handleSubmit(syntheticEvent);
    }
  };

  // Handle paste events for image copy-paste functionality
  const handlePaste = (
    e: ClipboardEvent,
    processFiles: (files: FileList | File[]) => void
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item?.type) continue;

      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault(); // Prevent pasting the image as text
      processFiles(files);
      toast.success(`${files.length} image(s) pasted successfully`);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const editor = editorRef.current;
    if (editor) {
      editor.insertText(emoji);
      editor.focus();
    } else {
      setMessage((prev) => prev + emoji);
    }
  };

  const isLoading = sendMessageMutation.isPending;
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

              {/* Image attachment button */}
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    processFiles(e.target.files);
                  }
                  e.target.value = "";
                }}
                disabled={disabled || isLoading}
                className="hidden"
                id="image-upload-input"
              />
              <label htmlFor="image-upload-input">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  disabled={disabled || isLoading}
                  asChild
                >
                  <span className="cursor-pointer">
                    <Image className="h-4 w-4" />
                  </span>
                </Button>
              </label>

              {/* Emoji picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    disabled={disabled || isLoading}
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-fit p-0" align="start">
                  <EmojiPicker
                    className="h-[350px]"
                    onEmojiSelect={({ emoji }) => handleEmojiSelect(emoji)}
                  >
                    <EmojiPickerSearch />
                    <EmojiPickerContent />
                  </EmojiPicker>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </FileUpload>
      </div>

      {/* Message input area */}
      <div className="p-4 pt-2">
        <FileUpload
          onFilesChange={setAttachments}
          maxFiles={5}
          maxFileSize={10}
          disabled={disabled || isLoading}
        >
          {(processFiles) => (
            <form onSubmit={handleSubmit} className="flex w-full gap-2">
              <RichTextEditor
                ref={editorRef}
                value={message}
                onChange={setMessage}
                onKeyDown={handleKeyDown}
                onPaste={(e) => handlePaste(e, processFiles)}
                placeholder={placeholder}
                disabled={disabled || isLoading}
                className="flex-1"
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
          )}
        </FileUpload>
        {message.length > 1800 && (
          <div className="mt-1 text-right text-muted-foreground text-xs">
            {2000 - message.length} characters remaining
          </div>
        )}
      </div>
    </div>
  );
};
