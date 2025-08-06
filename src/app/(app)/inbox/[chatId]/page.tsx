"use client";

import { useRouter } from "@bprogress/next";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
	AlertCircle,
	Check,
	CheckCheck,
	MoreHorizontal,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "~/components/app-header";
import { MessageInput } from "~/components/message-input";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ScrollArea } from "~/components/ui/scroll-area";
import { SidebarInset } from "~/components/ui/sidebar";
import { type Message, useMessages } from "~/contexts/messages-context";
import { api } from "~/trpc/react";

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

// Using Message type from messages context instead of duplicate interface

export default function ChatPage() {
	const params = useParams();
	const router = useRouter();
	const chatId = params?.chatId as string;
	const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
		null,
	);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Use our custom messages state management
	const {
		getMessages,
		mergeMessages,
		isLoading: isMessagesLoading,
		getError: getMessagesError,
	} = useMessages();
	const messages = getMessages(chatId);
	const messagesLoading = isMessagesLoading(chatId);
	const messagesError = getMessagesError(chatId);

	// Get contact name for breadcrumbs
	const getContactName = () => {
		if (!chatDetails?.unipileChatAttendees) return chatId;

		const attendee = chatDetails.unipileChatAttendees.find(
			(attendee) => attendee.is_self !== 1 && attendee.contact,
		);

		if (!attendee?.contact) return chatId;

		const contact = attendee.contact;
		return (
			contact.full_name ||
			[contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
			"Unknown Contact"
		);
	};

	// Format message timestamp
	const formatMessageTime = (date: Date) => {
		if (isToday(date)) {
			return format(date, "HH:mm");
		}
		if (isYesterday(date)) {
			return `Yesterday ${format(date, "HH:mm")}`;
		}
		return format(date, "MMM d, HH:mm");
	};

	// Fetch selected chat details and messages
	const {
		data: chatDetails,
		isLoading: chatLoading,
		error: chatError,
		refetch: refetchChatDetails,
	} = api.inbox.getChatDetails.useQuery(
		{ chatId: chatId || "" },
		{ enabled: !!chatId },
	);

	// Fetch user's LinkedIn profile for displaying outgoing messages
	const { data: userLinkedInProfile, isLoading: profileLoading } =
		api.inbox.getUserLinkedInProfile.useQuery(
			{ unipileAccountId: chatDetails?.unipileAccount?.id || "" },
			{ enabled: !!chatDetails?.unipileAccount?.id },
		);

	// Fetch messages using TRPC but manage them with our custom state
	const { data: messagesData, refetch: refetchMessages } =
		api.inbox.getChatMessages.useQuery(
			{ chatId: chatId || "", limit: 50 },
			{ enabled: !!chatId },
		);

	// Update our state when messages data changes
	useEffect(() => {
		if (messagesData && chatId) {
			// Cast the API response to our Message type (dates are already properly typed from Drizzle)
			const formattedMessages = messagesData as Message[];
			mergeMessages(chatId, formattedMessages);
		}
	}, [messagesData, chatId, mergeMessages]);

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

	// Auto-scroll to bottom when messages load or change
	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	// Scroll to bottom when messages change
	useEffect(() => {
		if (messages && messages.length > 0) {
			scrollToBottom();
		}
	}, [messages, scrollToBottom]);

	const handleDeleteMessage = async (messageId: string) => {
		if (
			window.confirm(
				"Are you sure you want to delete this message? This action cannot be undone.",
			)
		) {
			setDeletingMessageId(messageId);
			deleteMessageMutation.mutate({ messageId });
		}
	};

	if (!chatId) {
		return (
			<>
				<AppHeader
					breadcrumbLabels={{
						inbox: "Inbox",
					}}
				/>
				<div className="flex h-full items-center justify-center">
					<div className="text-center text-muted-foreground">
						<h3 className="font-medium text-lg">Chat not found</h3>
						<p className="text-sm">
							The requested conversation could not be found
						</p>
					</div>
				</div>
			</>
		);
	}

	if (chatLoading) {
		return (
			<>
				<AppHeader
					breadcrumbLabels={{
						inbox: "Inbox",
						[chatId]: "Loading...",
					}}
				/>
				<div className="flex h-full items-center justify-center">
					<div className="text-center text-muted-foreground">
						Loading chat details...
					</div>
				</div>
			</>
		);
	}

	return (
		<>
			<AppHeader
				breadcrumbLabels={{
					inbox: "Inbox",
					[chatId]: getContactName(),
				}}
			/>
			<div className="flex h-full min-h-0 flex-col">
				{/* Header */}
				{chatDetails && (
					<div className="flex-shrink-0 border-border border-b bg-card/50 p-6">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								{chatDetails.unipileChatAttendees?.map((attendee) => {
									if (attendee.is_self !== 1 && attendee.contact) {
										const contact = attendee.contact;
										const displayName =
											contact.full_name ||
											[contact.first_name, contact.last_name]
												.filter(Boolean)
												.join(" ") ||
											"Unknown Contact";

										return (
											<div
												key={attendee.id}
												className="flex items-center gap-4"
											>
												<Avatar className="h-12 w-12 shadow-sm ring-2 ring-background">
													<AvatarImage
														src={contact.profile_image_url || undefined}
														alt={displayName}
													/>
													<AvatarFallback className="bg-primary/10 font-semibold text-primary">
														{displayName
															.split(" ")
															.map((n) => n[0])
															.join("")
															.toUpperCase()
															.slice(0, 2)}
													</AvatarFallback>
												</Avatar>
												<div>
													<h2 className="font-semibold text-foreground text-xl">
														{displayName}
													</h2>
													{contact.headline && (
														<p className="text-muted-foreground text-sm leading-relaxed">
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

							{/* No chat actions needed - opening chat automatically marks as read */}
						</div>
					</div>
				)}

				{/* Messages Area */}
				<ScrollArea className="h-0 flex-1">
					<div className="bg-background/50 p-6">
						{messagesLoading ? (
							<div className="text-center text-muted-foreground">
								Loading messages...
							</div>
						) : messages && messages.length > 0 ? (
							<div className="space-y-4">
								{messages.map((message: Message) => {
									// Get contact info by matching message sender_id to attendee external_id
									let attendee = null;
									let contact = null;
									let displayName = "You"; // Default for outgoing messages

									if (!message.is_outgoing) {
										// Find the specific attendee/contact for this message's sender
										attendee = chatDetails?.unipileChatAttendees?.find(
											(attendee) =>
												attendee.external_id === message.sender_id &&
												attendee.contact,
										);
										contact = attendee?.contact;
										displayName =
											contact?.full_name ||
											contact?.first_name ||
											"Unknown Contact";
									}

									return (
										<div
											key={message.id}
											className={`group flex items-end gap-3 ${
												message.is_outgoing ? "flex-row-reverse" : "flex-row"
											}`}
										>
											{/* Avatar for received messages */}
											{!message.is_outgoing && (
												<Avatar className="h-8 w-8 flex-shrink-0">
													<AvatarImage
														src={contact?.profile_image_url || undefined}
														alt={displayName}
													/>
													<AvatarFallback className="bg-muted text-xs">
														{displayName
															.split(" ")
															.map((n) => n[0])
															.join("")
															.toUpperCase()
															.slice(0, 2)}
													</AvatarFallback>
												</Avatar>
											)}

											{/* Message bubble */}
											<div className="flex max-w-[70%] flex-col">
												<div
													className={`relative px-4 py-3 shadow-sm ${
														message.is_outgoing
															? message.isFailed
																? "rounded-2xl rounded-br-md bg-red-500 text-white"
																: message.isOptimistic
																	? "rounded-2xl rounded-br-md bg-primary/70 text-primary-foreground"
																	: "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
															: "rounded-2xl rounded-bl-md border border-border/50 bg-muted/80 text-foreground"
													}`}
												>
													<p className="text-sm leading-relaxed">
														{message.content}
													</p>
													{message.isFailed && (
														<div className="mt-2 flex items-center gap-2 text-white/80 text-xs">
															<AlertCircle className="h-3 w-3" />
															<span>Failed to send</span>
														</div>
													)}
												</div>

												{/* Timestamp and status */}
												<div
													className={`mt-1 flex items-center gap-2 px-1 ${
														message.is_outgoing
															? "flex-row-reverse"
															: "flex-row"
													}`}
												>
													<span className="text-muted-foreground text-xs">
														{message.sent_at
															? formatMessageTime(new Date(message.sent_at))
															: ""}
													</span>
													{/* Status indicator - only for outgoing messages */}
													{message.is_outgoing && (
														<div className="flex items-center">
															{message.isFailed ? (
																<AlertCircle className="h-3 w-3 text-red-500" />
															) : message.isOptimistic ? (
																<div className="h-3 w-3 animate-pulse rounded-full bg-muted-foreground/50" />
															) : message.is_read ? (
																<CheckCheck className="h-3 w-3 text-muted-foreground" />
															) : (
																<Check className="h-3 w-3 text-muted-foreground" />
															)}
														</div>
													)}
												</div>
											</div>

											{/* Delete button - only show for user's own messages */}
											{message.is_outgoing && (
												<div className="opacity-0 transition-opacity group-hover:opacity-100">
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
																{deletingMessageId === message.id
																	? "Deleting..."
																	: "Delete message"}
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</div>
											)}
										</div>
									);
								})}
								{/* Auto-scroll target */}
								<div ref={messagesEndRef} />
							</div>
						) : (
							<div className="text-center text-muted-foreground">
								No messages in this conversation
							</div>
						)}
					</div>
				</ScrollArea>

				{/* Message Input Area */}
				<div className="flex-shrink-0 border-t bg-background">
					<MessageInput
						chatId={chatId}
						onMessageSent={() => {
							void refetchMessages();
							// Scroll to bottom after sending a message
							setTimeout(scrollToBottom, 100);
						}}
						disabled={chatLoading || !chatDetails}
						placeholder={
							chatDetails?.read_only === 1
								? "This conversation is read-only"
								: "Type a message..."
						}
					/>
				</div>
			</div>
		</>
	);
}
