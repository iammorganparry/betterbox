"use client";

import { useRouter } from "@bprogress/next";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
	AlertCircle,
	Calendar,
	Check,
	CheckCheck,
	Download,
	ExternalLink,
	File,
	Image,
	MoreHorizontal,
	Paperclip,
	Play,
	RefreshCw,
	Send,
	Smile,
	Trash2,
	UserPlus,
	Volume2,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "~/components/app-header";
import { MessageInput } from "~/components/message-input";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { SidebarInset } from "~/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
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

interface MessageAttachment {
	id: string;
	attachment_type:
	| "img"
	| "video"
	| "audio"
	| "file"
	| "linkedin_post"
	| "video_meeting";
	url?: string | null;
	filename?: string | null;
	file_size?: number | null;
	mime_type?: string | null;
	width?: number | null;
	height?: number | null;
	unavailable: boolean;
}

// Using Message type from messages context instead of duplicate interface

// Component to render message attachments
function MessageAttachments({
	attachments,
}: {
	attachments: MessageAttachment[];
}) {
	if (!attachments || attachments.length === 0) return null;

	return (
		<div className="mt-2 space-y-2">
			{attachments.map((attachment) => {
				if (attachment.unavailable) {
					return (
						<div
							key={attachment.id}
							className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3"
						>
							<AlertCircle className="h-4 w-4 text-destructive" />
							<span className="text-destructive text-sm">
								Attachment unavailable
							</span>
						</div>
					);
				}

				switch (attachment.attachment_type) {
					case "img":
						return (
							<div
								key={attachment.id}
								className="max-w-sm overflow-hidden rounded-lg border"
							>
								{attachment.url ? (
									<img
										src={attachment.url}
										alt={attachment.filename || "Image"}
										className="h-auto w-full object-cover"
										style={{
											maxHeight: "300px",
											...(attachment.width &&
												attachment.height && {
												aspectRatio: `${attachment.width} / ${attachment.height}`,
											}),
										}}
										onError={(e) => {
											e.currentTarget.style.display = "none";
											e.currentTarget.nextElementSibling?.classList.remove(
												"hidden",
											);
										}}
									/>
								) : null}
								<div className="flex hidden items-center gap-2 bg-muted p-3">
									<Image className="h-4 w-4" />
									<span className="text-sm">
										{attachment.filename || "Image"}
									</span>
								</div>
							</div>
						);

					case "video":
						return (
							<div
								key={attachment.id}
								className="max-w-sm overflow-hidden rounded-lg border"
							>
								{attachment.url ? (
									<video
										controls
										className="h-auto w-full"
										style={{ maxHeight: "300px" }}
									>
										<source
											src={attachment.url}
											type={attachment.mime_type || "video/mp4"}
										/>
										<track
											kind="captions"
											srcLang="en"
											label="English"
											default
										/>
										Your browser does not support the video tag.
									</video>
								) : (
									<div className="flex items-center gap-2 bg-muted p-3">
										<Play className="h-4 w-4" />
										<span className="text-sm">
											{attachment.filename || "Video"}
										</span>
									</div>
								)}
							</div>
						);

					case "audio":
						return (
							<div
								key={attachment.id}
								className="max-w-sm overflow-hidden rounded-lg border"
							>
								{attachment.url ? (
									<audio controls className="w-full">
										<source
											src={attachment.url}
											type={attachment.mime_type || "audio/mpeg"}
										/>
										<track
											kind="captions"
											srcLang="en"
											label="English"
											default
										/>
										Your browser does not support the audio element.
									</audio>
								) : (
									<div className="flex items-center gap-2 bg-muted p-3">
										<Volume2 className="h-4 w-4" />
										<span className="text-sm">
											{attachment.filename || "Audio"}
										</span>
									</div>
								)}
							</div>
						);

					default:
						return (
							<div
								key={attachment.id}
								className="flex items-center justify-between rounded-lg border bg-muted p-3"
							>
								<div className="flex items-center gap-2">
									<File className="h-4 w-4" />
									<div>
										<div className="font-medium text-sm">
											{attachment.filename || "File"}
										</div>
										{attachment.file_size && (
											<div className="text-muted-foreground text-xs">
												{formatFileSize(attachment.file_size)}
											</div>
										)}
									</div>
								</div>
								{attachment.url && (
									<Button variant="ghost" size="sm" asChild>
										<a
											href={attachment.url}
											target="_blank"
											rel="noopener noreferrer"
										>
											<Download className="h-4 w-4" />
										</a>
									</Button>
								)}
							</div>
						);
				}
			})}
		</div>
	);
}

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export default function ChatPage() {
	const params = useParams();
	const router = useRouter();
	const chatId = params?.chatId as string;
	const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
		null,
	);
	const [showReactions, setShowReactions] = useState<string | null>(null);
	const [message, setMessage] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Reaction emojis for message reactions
	const reactionEmojis = [
		{ type: 'like', emoji: '👍' },
		{ type: 'love', emoji: '❤️' },
		{ type: 'laugh', emoji: '😂' },
		{ type: 'surprise', emoji: '😮' },
		{ type: 'sad', emoji: '😢' },
		{ type: 'angry', emoji: '😠' }
	];

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

	const handleReaction = (messageId: string, reactionType: string) => {
		// TODO: Implement reaction functionality
		console.log('Reaction:', reactionType, 'for message:', messageId);
		// This would typically call an API to add/remove reactions
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
				<div className="flex-1 overflow-y-auto">
					<div className="px-6 py-4 space-y-4">
						{messagesLoading ? (
							<div className="text-center text-muted-foreground">
								Loading messages...
							</div>
						) : messages && messages.length > 0 ? (
							<>
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
										<div key={message.id} className="group">
											<div className={`flex items-start gap-3 ${message.is_outgoing ? 'flex-row-reverse' : ''}`}>
												<Avatar className="w-8 h-8 mt-1 flex-shrink-0">
													<AvatarImage
														src={contact?.profile_image_url || undefined}
														alt={displayName}
													/>
													<AvatarFallback className={`text-xs ${message.is_outgoing ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
														{message.is_outgoing ? 'You' : displayName.split(' ').map(n => n[0]).join('')}
													</AvatarFallback>
												</Avatar>

												<div className={`flex-1 min-w-0 ${message.is_outgoing ? 'items-end' : ''}`}>
													<div className={`flex items-baseline gap-2 mb-1 ${message.is_outgoing ? 'flex-row-reverse' : ''}`}>
														<span className="text-foreground font-medium text-sm">{message.is_outgoing ? 'You' : displayName}</span>
														<span className="text-xs text-muted-foreground">
															{message.sent_at ? formatMessageTime(new Date(message.sent_at)) : ""}
														</span>
														{!message.is_read && !message.is_outgoing && (
															<div className="w-2 h-2 bg-blue-500 rounded-full"></div>
														)}
													</div>

													<div className={`max-w-2xl ${message.is_outgoing ? 'ml-auto' : ''}`}>
														<div className={`rounded-lg p-3 ${message.is_outgoing
															? message.isFailed
																? 'bg-red-500 text-white'
																: message.isOptimistic
																	? 'bg-primary/70 text-primary-foreground'
																	: 'bg-primary text-primary-foreground'
															: 'bg-accent/50'
															}`}>
															{message.content && (
																<p className="leading-relaxed">{message.content}</p>
															)}

															{/* Attachments */}
															{(
																message as Message & {
																	unipileMessageAttachments?: MessageAttachment[];
																}
															).unipileMessageAttachments && (
																	<div className="mt-2">
																		<MessageAttachments
																			attachments={
																				(
																					message as Message & {
																						unipileMessageAttachments: MessageAttachment[];
																					}
																				).unipileMessageAttachments
																			}
																		/>
																	</div>
																)}

															{message.isFailed && (
																<div className="mt-2 flex items-center gap-2 text-white/80 text-xs">
																	<AlertCircle className="h-3 w-3" />
																	<span>Failed to send</span>
																</div>
															)}
														</div>

														{/* Status indicator - only for outgoing messages */}
														{message.is_outgoing && (
															<div className="flex items-center mt-1 gap-2">
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

														{/* Reactions - placeholder for future implementation */}
														{/* {msg.reactions && msg.reactions.length > 0 && (
															<div className="flex items-center gap-1 mt-1">
																{msg.reactions.map((reaction, idx) => (
																	<Badge 
																		key={idx}
																		variant="secondary" 
																		className="text-xs px-2 py-0 h-5 cursor-pointer hover:bg-secondary/80"
																	>
																		{reactionEmojis.find(r => r.type === reaction.type)?.emoji} {reaction.count}
																	</Badge>
																))}
															</div>
														)} */}
													</div>
												</div>

												{/* Message Actions */}
												<div className={`opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${message.is_outgoing ? 'order-first' : ''}`}>
													<div className="flex items-center gap-1">
														{/* Reaction Button */}
														<div className="relative">
															<Button
																variant="ghost"
																size="sm"
																className="h-6 w-6 p-0"
																onClick={() => setShowReactions(showReactions === message.id ? null : message.id)}
															>
																<Smile className="w-3 h-3" />
															</Button>

															{showReactions === message.id && (
																<div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-popover border border-border rounded-lg p-2 shadow-lg z-10">
																	<div className="flex gap-1">
																		{reactionEmojis.map((reaction) => (
																			<Button
																				key={reaction.type}
																				variant="ghost"
																				size="sm"
																				className="h-8 w-8 p-0 text-base hover:bg-accent"
																				onClick={() => {
																					handleReaction(message.id, reaction.type);
																					setShowReactions(null);
																				}}
																			>
																				{reaction.emoji}
																			</Button>
																		))}
																	</div>
																</div>
															)}
														</div>

														{message.is_outgoing && (
															<DropdownMenu>
																<DropdownMenuTrigger asChild>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-6 w-6 p-0"
																		disabled={deletingMessageId === message.id}
																		data-testid="message-options-button"
																	>
																		<MoreHorizontal className="w-3 h-3" />
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
														)}
													</div>
												</div>
											</div>
										</div>
									);
								})}
								{/* Auto-scroll target */}
								<div ref={messagesEndRef} />
							</>
						) : (
							<div className="text-center text-muted-foreground">
								No messages in this conversation
							</div>
						)}
					</div>
				</div>

				{/* Message Input */}
				<div className="px-6 py-4 border-t border-border glass-effect">
					<div className="space-y-3">
						{/* Quick Actions */}
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" className="h-8">
								<Calendar className="w-3 h-3 mr-2" />
								Schedule meeting
							</Button>
							<Button variant="outline" size="sm" className="h-8">
								<UserPlus className="w-3 h-3 mr-2" />
								Make introduction
							</Button>
							<Button variant="outline" size="sm" className="h-8">
								<ExternalLink className="w-3 h-3 mr-2" />
								Share profile
							</Button>
						</div>

						{/* Message Composer */}
						<div className="flex items-end gap-3 p-3 bg-accent/30 rounded-lg border border-border">
							<Avatar className="w-8 h-8 flex-shrink-0">
								<AvatarFallback className="bg-primary text-primary-foreground text-xs">
									You
								</AvatarFallback>
							</Avatar>

							<div className="flex-1 space-y-2">
								<Input
									placeholder={
										chatDetails?.read_only === 1
											? "This conversation is read-only"
											: "Write a message..."
									}
									value={message}
									onChange={(e) => setMessage(e.target.value)}
									className="border-0 bg-transparent px-0 focus-visible:ring-0 text-foreground placeholder:text-muted-foreground"
									disabled={chatLoading || !chatDetails || chatDetails?.read_only === 1}
								/>

								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Tooltip>
											<TooltipTrigger asChild>
												<Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
													<Paperclip className="w-4 h-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Attach file</p>
											</TooltipContent>
										</Tooltip>

										<Tooltip>
											<TooltipTrigger asChild>
												<Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
													<Image className="w-4 h-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Add image</p>
											</TooltipContent>
										</Tooltip>

										<Tooltip>
											<TooltipTrigger asChild>
												<Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
													<Smile className="w-4 h-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Add emoji</p>
											</TooltipContent>
										</Tooltip>
									</div>

									<Button
										size="sm"
										className="h-8 px-3"
										disabled={!message.trim() || chatLoading || !chatDetails || chatDetails?.read_only === 1}
										onClick={async () => {
											if (message.trim()) {
												// TODO: Implement send message functionality
												console.log('Sending message:', message);
												setMessage("");
												void refetchMessages();
												setTimeout(scrollToBottom, 100);
											}
										}}
									>
										<Send className="w-3 h-3 mr-2" />
										Send
									</Button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
