"use client";

import { useRouter } from "@bprogress/next";
import {
	ArchiveX,
	CheckCheck,
	Folder,
	FolderEdit,
	FolderPlus,
	Inbox,
	Linkedin,
	MoreHorizontal,
	Plus,
	Send,
	Trash2,
	User,
	X,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Label } from "~/components/ui/label";

import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { api } from "~/trpc/react";
import { sidebarConfig } from "./config/sidebar";

// Import APIs and utilities
import { useConfirmation } from "~/hooks/use-confirmation";
import { truncate } from "~/lib/utils";

interface ChatAttendee {
	id: string;
	external_id?: string | null;
	is_self?: number | null;
	contact?: {
		id: string;
		full_name?: string | null;
		first_name?: string | null;
		last_name?: string | null;
		profile_image_url?: string | null;
		provider_url?: string | null;
		headline?: string | null;
		member_urn?: string | null;
	} | null;
}

interface ChatData {
	id: string;
	name?: string | null;
	provider: string;
	last_message_at?: Date | null;
	unread_count: number;
	unipileChatAttendees?: ChatAttendee[];
	unipileMessages?: Array<{
		id: string;
		content?: string | null;
		is_outgoing: boolean;
		sent_at?: Date | null;
	}>;
}

interface GroupedChat {
	email: string;
	name: string;
	date: string;
	subject: string;
	teaser: string;
	avatar: string | null;
	initials: string;
	provider: string;
}

interface FolderData {
	id: string;
	name: string;
	chat_count: number;
}

interface ChatFolderAssignment {
	chat: ChatData;
}

type FilterMode = "all" | "unread" | "read";

const renderProviderIcon = (provider: string) => {
	switch (provider.toLowerCase()) {
		case "linkedin":
			return <Linkedin className="h-4 w-4 text-blue-600" />;
		default:
			return <User className="h-4 w-4" />;
	}
};

// Extracted ChatItem component
interface ChatItemProps {
	mail: GroupedChat;
	selectedChatId: string | undefined;
	chatsData: ChatData[];
	handleChatClick: (
		chatId: string,
		hasUnreadMessages: boolean,
	) => Promise<void>;
	markingAsReadId: string | null;
	handleMarkAsRead: (chatId: string, chatName: string) => void;
	foldersData: FolderData[] | undefined;
	assignChatToFolderMutation: {
		mutate: (input: { chatId: string; folderId: string }) => void;
		isPending: boolean;
	};
	selectedFolderId: string;
	removeChatFromFolderMutation: {
		mutate: (input: { chatId: string; folderId: string }) => void;
		isPending: boolean;
	};
	handleRemoveFromFolder: (
		chatId: string,
		chatName: string,
		folderId: string,
	) => Promise<void>;
	deletingChatId: string | null;
	handleSoftDeleteChat: (chatId: string, chatName: string) => void;
	router: ReturnType<typeof useRouter>;
}

const ChatItem = ({
	mail,
	selectedChatId,
	chatsData,
	handleChatClick,
	markingAsReadId,
	handleMarkAsRead,
	foldersData,
	assignChatToFolderMutation,
	selectedFolderId,
	removeChatFromFolderMutation,
	handleRemoveFromFolder,
	deletingChatId,
	handleSoftDeleteChat,
	router,
}: ChatItemProps) => {
	const chatData = chatsData.find((chat) => chat.id === mail.email);
	const hasUnreadMessages = (chatData?.unread_count ?? 0) > 0;

	return (
		<div
			className={`group flex w-[450px] max-w-[450px] items-center border-border/50 border-b transition-all duration-200 last:border-b-0 ${
				selectedChatId === mail.email
					? "border-l-4 border-l-primary bg-muted/80"
					: "hover:border-l-2 hover:border-l-muted-foreground/20 hover:bg-muted/30"
			}`}
		>
			{/* Middle Section: User and Message Preview - Flexible width */}
			<button
				type="button"
				onClick={() => {
					handleChatClick(mail.email, hasUnreadMessages);
				}}
				className="flex min-w-0 flex-1 cursor-pointer flex-col gap-2 p-3 text-left text-sm"
			>
				{/* User info row */}
				<div className="flex min-w-0 items-center gap-3">
					<Avatar className="h-9 w-9 flex-shrink-0 ring-2 ring-background">
						<AvatarImage src={mail.avatar || undefined} alt={mail.name} />
						<AvatarFallback className="bg-primary/10 font-semibold text-primary text-xs">
							{mail.initials}
						</AvatarFallback>
					</Avatar>
					<div className="flex min-w-0 flex-1 items-center justify-between">
						<span
							className={`truncate font-semibold text-sm ${
								hasUnreadMessages ? "text-foreground" : "text-muted-foreground"
							}`}
						>
							{truncate(mail.name, 25)}
						</span>
						<div className="flex flex-shrink-0 items-center gap-2 pl-2">
							<span className="font-medium text-muted-foreground text-xs">
								{mail.date}
							</span>
							{hasUnreadMessages && (
								<div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
							)}
						</div>
					</div>
				</div>

				{/* Subject line */}
				{mail.subject && (
					<div className="ml-12 min-w-0">
						<span className="line-clamp-1 overflow-hidden text-ellipsis font-medium text-muted-foreground text-xs">
							{truncate(mail.subject, 40)}
						</span>
					</div>
				)}

				{/* Message preview */}
				<div className="ml-12 min-w-0">
					<span className="line-clamp-2 overflow-hidden text-ellipsis whitespace-break-spaces text-muted-foreground text-xs leading-relaxed">
						{mail.teaser}
					</span>
				</div>
			</button>

			{/* Right Section: Context Menu - Fixed width */}
			<div className="flex w-12 flex-shrink-0 items-center justify-center opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0 hover:bg-muted/80"
							onClick={(e) => e.stopPropagation()}
						>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{hasUnreadMessages && (
							<DropdownMenuItem
								onClick={(e) => {
									e.stopPropagation();
									handleMarkAsRead(mail.email, mail.name);
								}}
								disabled={markingAsReadId === mail.email}
							>
								<CheckCheck className="mr-2 h-4 w-4" />
								{markingAsReadId === mail.email
									? "Marking as read..."
									: "Mark as read"}
							</DropdownMenuItem>
						)}

						{/* Folder assignment submenu */}
						{foldersData && foldersData.length > 0 && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<DropdownMenuItem onClick={(e) => e.stopPropagation()}>
										<Folder className="mr-2 h-4 w-4" />
										Add to folder
									</DropdownMenuItem>
								</DropdownMenuTrigger>
								<DropdownMenuContent side="right" align="start">
									{foldersData.map((folder: FolderData) => (
										<DropdownMenuItem
											key={folder.id}
											onClick={(e) => {
												e.stopPropagation();
												assignChatToFolderMutation.mutate({
													chatId: mail.email,
													folderId: folder.id,
												});
											}}
											disabled={assignChatToFolderMutation.isPending}
										>
											<Folder className="mr-2 h-4 w-4" />
											{folder.name}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						)}

						{/* Remove from folder option - only show when viewing a specific folder */}
						{selectedFolderId !== "all" && (
							<DropdownMenuItem
								onClick={(e) => {
									e.stopPropagation();
									handleRemoveFromFolder(
										mail.email,
										mail.name,
										selectedFolderId,
									);
								}}
								disabled={removeChatFromFolderMutation.isPending}
								className="text-orange-600 focus:text-orange-600"
							>
								<X className="mr-2 h-4 w-4" />
								{removeChatFromFolderMutation.isPending
									? "Removing from folder..."
									: "Remove from folder"}
							</DropdownMenuItem>
						)}

						{/* Delete option */}
						<DropdownMenuItem
							onClick={(e) => {
								e.stopPropagation();
								handleSoftDeleteChat(mail.email, mail.name);
							}}
							disabled={deletingChatId === mail.email}
							className="text-red-600 focus:text-red-600"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							{deletingChatId === mail.email
								? "Deleting..."
								: "Delete conversation"}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
};

// Extracted Folder component
interface FolderProps {
	folder: { id: string; name: string; chat_count: number };
	isSelected: boolean;
	onClick: () => void;
}

const FolderComponent = ({ folder, isSelected, onClick }: FolderProps) => {
	return (
		<button
			onClick={onClick}
			type="button"
			className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-sm transition-all duration-200 ${
				isSelected
					? "bg-primary text-primary-foreground shadow-sm"
					: "hover:scale-[1.01] hover:bg-muted/60"
			}`}
		>
			<Folder className="h-4 w-4" />
			<span className="flex-1 text-left">{folder.name}</span>
			<span
				className={`text-muted-foreground text-xs ${
					isSelected ? "text-primary-foreground" : ""
				}`}
			>
				{folder.chat_count}
			</span>
			{/* context menu for edit and delete and only show when not "all Chats" */}
			{folder.id !== "all" ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<span className="p-1 text-muted-foreground text-xs">
							<MoreHorizontal className="h-4 w-4" />
						</span>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuItem>Edit</DropdownMenuItem>
						<DropdownMenuItem>Delete</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
		</button>
	);
};

export default function InboxSidebar() {
	const [activeItem, setActiveItem] = useState(sidebarConfig[0]);
	const [filterMode, setFilterMode] = useState<FilterMode>("all");
	const [markingAsReadId, setMarkingAsReadId] = useState<string | null>(null);
	const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
	const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
	const [showCreateFolder, setShowCreateFolder] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");
	const [searchTerm, setSearchTerm] = useState("");
	const router = useRouter();
	const params = useParams();
	const selectedChatId = params?.chatId as string;
	const chatsContainerRef = useRef<HTMLDivElement>(null);

	// Initialize confirmation hook
	const { confirm, ConfirmationDialog } = useConfirmation();

	// Get TRPC utils for query invalidation
	const utils = api.useUtils();

	// Fetch chats from TRPC with infinite scroll support
	const {
		data: chatsData,
		isLoading: chatsLoading,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		refetch: refetchChats,
	} = api.inbox.getChats.useInfiniteQuery(
		{
			limit: 20, // Smaller pages for better UX
			// provider: "linkedin", // Removed to get all providers
		},
		{
			getNextPageParam: (lastPage) => lastPage.nextCursor,
		},
	);

	console.log("chatsData", chatsData);

	// Auto-load more chats when scrolling near bottom
	useEffect(() => {
		const container = chatsContainerRef.current;
		if (!container) return;

		// For ScrollArea, we need to target the viewport element
		const viewport = container.querySelector(
			"[data-radix-scroll-area-viewport]",
		);
		if (!viewport) return;

		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = viewport;
			const scrollThreshold = 100; // Load more when 100px from bottom

			if (scrollHeight - scrollTop - clientHeight < scrollThreshold) {
				if (hasNextPage && !isFetchingNextPage) {
					fetchNextPage();
				}
			}
		};

		viewport.addEventListener("scroll", handleScroll);
		return () => viewport.removeEventListener("scroll", handleScroll);
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	// Fetch folders
	const {
		data: foldersData,
		isLoading: foldersLoading,
		refetch: refetchFolders,
	} = api.inbox.getFolders.useQuery();

	// Get chats in selected folder
	const { data: folderChatsData, isLoading: folderChatsLoading } =
		api.inbox.getChatsInFolder.useQuery(
			{ folderId: selectedFolderId },
			{ enabled: selectedFolderId !== "all" },
		);

	console.log("folderChatsData", folderChatsData);

	// Mark chat as read mutation (with toast - for explicit context menu action)
	const markChatAsReadMutation = api.inbox.markChatAsRead.useMutation({
		onSuccess: (data) => {
			console.log("✅ Chat marked as read successfully:", data);
			toast.success("Chat marked as read");
			// Refetch chats to update the sidebar
			void refetchChats();
		},
		onError: (error) => {
			console.error("❌ Failed to mark chat as read:", {
				message: error.message,
				code: error.data?.code,
				stack: error.data?.stack,
				httpStatus: error.data?.httpStatus,
				path: error.data?.path,
			});
			toast.error(error.message || "Failed to mark chat as read");
		},
		onSettled: () => {
			setMarkingAsReadId(null);
		},
	});

	// Silent mark as read mutation (no toast - for automatic marking when opening chat)
	const silentMarkAsReadMutation = api.inbox.markChatAsRead.useMutation({
		onSuccess: (data) => {
			console.log("✅ Chat silently marked as read:", data);
			// Refetch chats to update the sidebar (no toast)
			void refetchChats();
		},
		onError: (error) => {
			console.error("❌ Failed to silently mark chat as read:", {
				message: error.message,
				code: error.data?.code,
			});
			// No toast for silent failures
		},
		onSettled: () => {
			setMarkingAsReadId(null);
		},
	});

	// Soft delete chat mutation
	const softDeleteChatMutation = api.inbox.softDeleteChat.useMutation({
		onSuccess: (data) => {
			toast.success("Chat deleted successfully");
			// Refetch chats to update the sidebar
			void refetchChats();
			// Navigate away if currently viewing the deleted chat
			if (selectedChatId === deletingChatId) {
				router.push("/inbox");
			}
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete chat");
		},
		onSettled: () => {
			setDeletingChatId(null);
		},
	});

	// Create folder mutation
	const createFolderMutation = api.inbox.createFolder.useMutation({
		onSuccess: () => {
			toast.success("Folder created successfully");
			void refetchFolders();
			setShowCreateFolder(false);
			setNewFolderName("");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create folder");
		},
	});

	// Assign chat to folder mutation
	const assignChatToFolderMutation = api.inbox.assignChatToFolder.useMutation({
		onSuccess: (data) => {
			// Use the message from the backend response for better UX
			if (data.wasAlreadyInFolder) {
				toast.info(data.message); // Use info toast for "already in folder"
			} else {
				toast.success(data.message); // Use success toast for new assignment
			}

			// Invalidate all relevant queries
			void utils.inbox.getChats.invalidate();
			void utils.inbox.getFolders.invalidate();
			void utils.inbox.getChatsInFolder.invalidate();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to assign chat to folder");
		},
	});

	// Remove chat from folder mutation
	const removeChatFromFolderMutation =
		api.inbox.removeChatFromFolder.useMutation({
			onSuccess: () => {
				toast.success("Chat removed from folder");
				// Invalidate all relevant queries to ensure UI updates
				void utils.inbox.getChats.invalidate();
				void utils.inbox.getFolders.invalidate();
				void utils.inbox.getChatsInFolder.invalidate();
			},
			onError: (error) => {
				toast.error(error.message || "Failed to remove chat from folder");
			},
		});

	const handleMarkAsRead = async (chatId: string, chatName: string) => {
		setMarkingAsReadId(chatId);
		markChatAsReadMutation.mutate({ chatId });
	};

	const handleSoftDeleteChat = async (chatId: string, chatName: string) => {
		await confirm(
			() => {
				setDeletingChatId(chatId);
				softDeleteChatMutation.mutate({ chatId });
			},
			{
				title: "Delete Conversation",
				description: `Are you sure you want to delete the conversation with ${chatName}? This action cannot be undone.`,
				confirmText: "Delete",
				cancelText: "Cancel",
				variant: "destructive",
			},
		);
	};

	const handleRemoveFromFolder = async (
		chatId: string,
		chatName: string,
		folderId: string,
	) => {
		await confirm(
			() => {
				removeChatFromFolderMutation.mutate({
					chatId,
					folderId,
				});
			},
			{
				title: "Remove from Folder",
				description: `Are you sure you want to remove ${chatName} from this folder?`,
				confirmText: "Remove",
				cancelText: "Cancel",
				variant: "destructive",
			},
		);
	};

	const handleChatClick = async (
		chatId: string,
		hasUnreadMessages: boolean,
	) => {
		// Navigate to the chat first for immediate response
		router.push(`/inbox/${chatId}`);

		// Silently mark as read if it has unread messages (no toast)
		if (hasUnreadMessages && markingAsReadId !== chatId) {
			setMarkingAsReadId(chatId);
			try {
				await silentMarkAsReadMutation.mutateAsync({ chatId });
			} catch (error) {
				// Error handling is already in the mutation's onError
				console.error("Failed to silently mark chat as read:", error);
			}
		}
	};

	// Handle folder creation
	const handleCreateFolder = () => {
		if (newFolderName.trim()) {
			createFolderMutation.mutate({
				name: newFolderName.trim(),
			});
		}
	};

	// Flatten the infinite query pages and deduplicate by chat ID
	const typedChats = chatsData?.pages.flatMap((page) => page.chats) || [];

	// Deduplicate chats by ID to prevent duplicate keys in React
	const uniqueChats = Array.from(
		new Map(typedChats.map((chat) => [chat.id, chat])).values(),
	);

	console.log("typedChats", typedChats);
	console.log("uniqueChats", uniqueChats);

	// Get chats to display based on folder selection
	const chatsToDisplay: ChatData[] =
		selectedFolderId === "all"
			? uniqueChats
			: (folderChatsData as unknown as ChatFolderAssignment[])?.map(
					(assignment) => assignment.chat,
				) || [];

	// Filter chats based on selected filter mode
	const filteredChats = chatsToDisplay.filter((chat: ChatData) => {
		// Apply read/unread filter
		const passesReadFilter = (() => {
			switch (filterMode) {
				case "unread":
					return chat.unread_count > 0;
				case "read":
					return chat.unread_count === 0;
				default:
					return true;
			}
		})();

		if (!passesReadFilter) return false;

		// Apply search filter if search term exists
		if (searchTerm.trim()) {
			const searchLower = searchTerm.toLowerCase().trim();

			// Get contact info for searching
			const attendee = chat.unipileChatAttendees?.find(
				(a: ChatAttendee) => a.is_self !== 1,
			);
			const contact = attendee?.contact;

			// Search criteria
			const searchableFields = [];

			// Contact name
			const contactName = contact?.full_name || contact?.first_name || "";
			if (contactName) searchableFields.push(contactName.toLowerCase());

			// Contact headline
			const headline = contact?.headline || "";
			if (headline) searchableFields.push(headline.toLowerCase());

			// Latest message content
			const latestMessage = chat.unipileMessages?.[0];
			const messageContent = latestMessage?.content || "";
			if (messageContent) {
				searchableFields.push(messageContent.toLowerCase());
			}

			// Check if search term matches any searchable field
			const matchesSearch = searchableFields.some((field) =>
				field.includes(searchLower),
			);

			return matchesSearch;
		}

		return true;
	});

	// Filter out chats without proper contact information
	const chatsWithContacts = filteredChats.filter((chat) => {
		const attendee = chat.unipileChatAttendees?.find(
			(a: ChatAttendee) => a.is_self !== 1,
		);
		const contact = attendee?.contact;
		// Only include chats where we have meaningful contact information
		return contact && (contact.full_name || contact.first_name);
	});

	// Sort chats by newest message first (most recent conversation at the top)
	const sortedChats = chatsWithContacts.sort((a, b) => {
		// First try to get the timestamp from the actual latest message
		const latestMessageA = a.unipileMessages?.[0];
		const latestMessageB = b.unipileMessages?.[0];

		// Use message sent_at if available, otherwise fall back to last_message_at
		const dateA = latestMessageA?.sent_at
			? new Date(latestMessageA.sent_at).getTime()
			: a.last_message_at
				? new Date(a.last_message_at).getTime()
				: 0;

		const dateB = latestMessageB?.sent_at
			? new Date(latestMessageB.sent_at).getTime()
			: b.last_message_at
				? new Date(b.last_message_at).getTime()
				: 0;

		return dateB - dateA; // Descending order (newest first)
	});

	// Convert chats to the existing mail format
	const mails: GroupedChat[] = sortedChats.map((chat) => {
		const attendee = chat.unipileChatAttendees?.find(
			(a: ChatAttendee) => a.is_self !== 1,
		);
		const contact = attendee?.contact;
		const contactName =
			contact?.full_name || contact?.first_name || "Unknown Contact";

		// Get the latest message for teaser
		const latestMessage = chat.unipileMessages?.[0];
		const messageTeaser = latestMessage?.content
			? (() => {
					const content = latestMessage.content.trim();
					const words = content.split(/\s+/);
					const maxWords = 8;
					const maxChars = 80; // Add character limit as well

					if (words.length <= maxWords && content.length <= maxChars) {
						return content;
					}

					// Truncate by words first
					let truncated = words.slice(0, maxWords).join(" ");

					// If still too long, truncate by characters
					if (truncated.length > maxChars) {
						truncated = truncated.substring(0, maxChars - 3);
					}

					return `${truncated}...`;
				})()
			: "No messages yet";

		// Get the most recent timestamp for display (same logic as sorting)
		const displayDate = latestMessage?.sent_at
			? new Date(latestMessage.sent_at)
			: chat.last_message_at
				? new Date(chat.last_message_at)
				: null;

		return {
			email: chat.id, // Use chat ID as unique identifier
			name: contactName,
			date: displayDate
				? formatDistanceToNow(displayDate, {
						addSuffix: true,
					})
				: "",
			subject: contact?.headline || "",
			teaser: messageTeaser,
			avatar: contact?.profile_image_url || null,
			initials: contactName
				? contactName
						.split(" ")
						.map((n: string) => n[0])
						.join("")
						.toUpperCase()
						.slice(0, 2)
				: "UC",
			provider: chat.provider,
		};
	});

	// Group chats by provider
	const groupedChats = mails.reduce(
		(groups: Record<string, GroupedChat[]>, chat: GroupedChat) => {
			const provider = chat.provider.toUpperCase();
			if (!groups[provider]) {
				groups[provider] = [];
			}
			groups[provider].push(chat);
			return groups;
		},
		{} as Record<string, GroupedChat[]>,
	);

	console.log("groupedChats", groupedChats);

	// Sort providers alphabetically and ensure LINKEDIN comes first if it exists
	const sortedProviders = Object.keys(groupedChats).sort((a, b) => {
		if (a === "LINKEDIN") return -1;
		if (b === "LINKEDIN") return 1;
		return a.localeCompare(b);
	});

	return (
		<div className="flex min-h-screen w-[450px] justify-center border-border border-r bg-background">
			<div className="flex w-full max-w-md flex-col">
				{/* Header */}
				<div className="flex-shrink-0 border-b bg-card p-6 pb-4">
					<div className="flex w-full items-center justify-between">
						<div className="font-semibold text-foreground text-xl">
							{activeItem?.title}
						</div>
						<div className="flex items-center gap-2">
							<Label
								htmlFor="filter-select"
								className="text-muted-foreground text-sm"
							>
								Filter:
							</Label>
							<Select
								value={filterMode}
								onValueChange={(value: FilterMode) => setFilterMode(value)}
							>
								<SelectTrigger
									id="filter-select"
									className="h-8 w-24 border-input text-xs"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All</SelectItem>
									<SelectItem value="unread">Unread</SelectItem>
									<SelectItem value="read">Read</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="relative mt-4">
						<Input
							placeholder="Type to search..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="border-muted-foreground/20 bg-muted/30 pr-8 focus:border-primary focus:ring-primary/20"
						/>
						{searchTerm && (
							<button
								onClick={() => setSearchTerm("")}
								className="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground transition-colors hover:text-foreground"
								type="button"
								aria-label="Clear search"
							>
								<X className="h-4 w-4" />
							</button>
						)}
					</div>

					{/* Search results indicator */}
					{searchTerm.trim() && (
						<div className="mt-2 text-muted-foreground text-xs">
							{mails.length === 0
								? "No results found"
								: mails.length === 1
									? "1 conversation found"
									: `${mails.length} conversations found`}
						</div>
					)}
				</div>

				{/* Folders Section */}
				<div className="flex-shrink-0 border-border border-b bg-card/50 p-4">
					<div className="mb-3 flex items-center justify-between">
						<h3 className="font-semibold text-foreground text-sm">Folders</h3>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowCreateFolder(!showCreateFolder)}
							className="h-6 w-6 p-0 hover:bg-muted"
						>
							<Plus className="h-4 w-4" />
						</Button>
					</div>

					<div>
						{/* All Chats folder */}
						<FolderComponent
							folder={{
								id: "all",
								name: "All Chats",
								chat_count: uniqueChats.length,
							}}
							isSelected={selectedFolderId === "all"}
							onClick={() => setSelectedFolderId("all")}
						/>

						{/* User folders */}
						{foldersData?.map((folder: FolderData) => (
							<FolderComponent
								key={folder.id}
								folder={folder}
								isSelected={selectedFolderId === folder.id}
								onClick={() => setSelectedFolderId(folder.id)}
							/>
						))}
					</div>

					{/* Create folder input */}
					{showCreateFolder && (
						<div className="mt-3 flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-3">
							<Input
								placeholder="Folder name"
								value={newFolderName}
								onChange={(e) => setNewFolderName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleCreateFolder();
									} else if (e.key === "Escape") {
										setShowCreateFolder(false);
										setNewFolderName("");
									}
								}}
								className="border-border/50 bg-background text-sm focus:border-primary"
								autoFocus
							/>
							<Button
								size="sm"
								onClick={handleCreateFolder}
								disabled={
									!newFolderName.trim() || createFolderMutation.isPending
								}
								className="bg-primary hover:bg-primary/90"
							>
								Add
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowCreateFolder(false)}
								className="hover:bg-muted"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					)}
				</div>

				{/* Chats Section */}
				<ScrollArea className="h-0 flex-1">
					<div ref={chatsContainerRef} className="p-0">
						{chatsLoading || folderChatsLoading ? (
							<div className="p-4 text-center text-muted-foreground text-sm">
								Loading conversations...
							</div>
						) : mails.length === 0 ? (
							<div className="p-4 text-center text-muted-foreground text-sm">
								{searchTerm.trim() ? (
									<>
										No conversations found for "{searchTerm.trim()}"
										<br />
										<span className="text-xs">
											Try different keywords or clear the search
										</span>
									</>
								) : filterMode === "unread" ? (
									"No unread conversations"
								) : filterMode === "read" ? (
									"No read conversations"
								) : (
									"No conversations found"
								)}
							</div>
						) : (
							<div className="space-y-4">
								{sortedProviders.map((provider) => (
									<div key={provider}>
										<div className="flex flex-row items-center gap-3 border-border/30 border-b bg-muted/20 px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">
											{renderProviderIcon(provider)}
											<span className="text-foreground/80">{provider}</span>
										</div>
										<div>
											{groupedChats[provider]?.map((mail) => (
												<ChatItem
													key={mail.email}
													mail={mail}
													selectedChatId={selectedChatId}
													chatsData={uniqueChats}
													handleChatClick={handleChatClick}
													markingAsReadId={markingAsReadId}
													handleMarkAsRead={handleMarkAsRead}
													foldersData={foldersData}
													assignChatToFolderMutation={
														assignChatToFolderMutation
													}
													selectedFolderId={selectedFolderId}
													removeChatFromFolderMutation={
														removeChatFromFolderMutation
													}
													handleRemoveFromFolder={handleRemoveFromFolder}
													deletingChatId={deletingChatId}
													handleSoftDeleteChat={handleSoftDeleteChat}
													router={router}
												/>
											))}
										</div>
									</div>
								))}

								{/* Load more trigger for infinite scroll */}
								{hasNextPage && (
									<div className="border-border/30 border-t p-4">
										<Button
											onClick={() => fetchNextPage()}
											disabled={isFetchingNextPage}
											variant="outline"
											className="w-full border-border/50 bg-card hover:bg-muted/50"
										>
											{isFetchingNextPage
												? "Loading..."
												: "Load more conversations"}
										</Button>
									</div>
								)}
							</div>
						)}
					</div>
				</ScrollArea>
			</div>
			<ConfirmationDialog />
		</div>
	);
}
