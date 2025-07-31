"use client";

import {
  ArchiveX,
  Inbox,
  Send,
  Trash2,
  User,
  MoreHorizontal,
  CheckCheck,
  Folder,
  FolderPlus,
  FolderEdit,
  Plus,
  GripVertical,
  X,
  Linkedin,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Label } from "~/components/ui/label";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { sidebarConfig } from "./config/sidebar";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// Import APIs and utilities
import { useConfirmation } from "~/hooks/use-confirmation";

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
  UnipileChatAttendee?: ChatAttendee[];
  UnipileMessage?: Array<{
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
  isObfuscated?: boolean; // Flag to indicate if this chat is obfuscated due to contact limits
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

// Extracted SortableChatItem component
interface SortableChatItemProps {
  mail: GroupedChat;
  selectedChatId: string | undefined;
  chatsData: ChatData[];
  handleChatClick: (
    chatId: string,
    hasUnreadMessages: boolean
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
    folderId: string
  ) => Promise<void>;
  deletingChatId: string | null;
  handleSoftDeleteChat: (chatId: string, chatName: string) => void;
  router: ReturnType<typeof useRouter>;
}

const SortableChatItem = ({
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
}: SortableChatItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: mail.email,
      disabled: mail.isObfuscated, // Disable drag for obfuscated chats
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const chatData = chatsData.find((chat) => chat.id === mail.email);
  const hasUnreadMessages = (chatData?.unread_count ?? 0) > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex w-full items-center border-b last:border-b-0 hover:bg-muted/50 ${
        selectedChatId === mail.email ? "bg-muted" : ""
      }`}
    >
      {/* Drag Handle - hidden for obfuscated chats */}
      {!mail.isObfuscated && (
        <div
          {...attributes}
          {...listeners}
          className="flex cursor-grab items-center px-2 py-4 opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (mail.isObfuscated) {
            // For obfuscated chats, show upgrade prompt instead of navigating
            toast.info("Unlock this contact to continue", {
              description: "Discover who's trying to connect with you",
              action: {
                label: "Unlock",
                onClick: () => router.push("/billing"),
              },
            });
          } else {
            handleChatClick(mail.email, hasUnreadMessages);
          }
        }}
        className="flex flex-1 flex-col items-start gap-2 whitespace-nowrap p-4 text-left text-sm leading-tight"
      >
        <div className="flex w-full items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={mail.avatar || undefined} alt={mail.name} />
            <AvatarFallback className="text-xs">{mail.initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">{mail.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">{mail.date}</span>
              {hasUnreadMessages && (
                <div className="h-2 w-2 rounded-full bg-blue-500" />
              )}
            </div>
          </div>
        </div>
        <span className="ml-11 font-medium text-muted-foreground">
          {mail.subject}
        </span>
        <span className="ml-11 line-clamp-2 w-[260px] whitespace-break-spaces text-muted-foreground text-xs">
          {mail.teaser}
        </span>
      </button>

      {/* Blur overlay for obfuscated contacts */}
      {mail.isObfuscated && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 p-1.5">
              <svg
                className="h-3 w-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900 text-xs">
                Click to unlock
              </p>
              <p className="text-gray-600 text-xs">Reveal this contact</p>
            </div>
          </div>
        </div>
      )}

      {/* Context menu for chat actions */}
      <div className="p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Show unlock prompt for obfuscated chats */}
            {mail.isObfuscated && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/billing");
                }}
                className="text-blue-600 focus:text-blue-600"
              >
                <span className="mr-2 h-4 w-4">🔓</span>
                Unlock contact
              </DropdownMenuItem>
            )}

            {hasUnreadMessages && !mail.isObfuscated && (
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

            {/* Folder assignment submenu - disabled for obfuscated chats */}
            {foldersData && foldersData.length > 0 && !mail.isObfuscated && (
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

            {/* Remove from folder option - only show when viewing a specific folder and not obfuscated */}
            {selectedFolderId !== "all" && !mail.isObfuscated && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFromFolder(
                    mail.email,
                    mail.name,
                    selectedFolderId
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

            {/* Delete option - disabled for obfuscated chats */}
            {!mail.isObfuscated && (
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
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

// Extracted DroppableFolder component
interface DroppableFolderProps {
  folder: { id: string; name: string; chat_count: number };
  isSelected: boolean;
  onClick: () => void;
}

const DroppableFolder = ({
  folder,
  isSelected,
  onClick,
}: DroppableFolderProps) => {
  const { setNodeRef, isOver } = useSortable({ id: folder.id });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      type="button"
      className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        isSelected
          ? "bg-primary text-primary-foreground"
          : isOver
          ? "bg-muted/70"
          : "hover:bg-muted/50"
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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    }
  );

  // Fetch contact limit status
  const { data: contactLimitStatus } =
    api.subscription.getContactLimitStatus.useQuery();

  // Auto-load more chats when scrolling near bottom
  useEffect(() => {
    const container = chatsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollThreshold = 100; // Load more when 100px from bottom

      if (scrollHeight - scrollTop - clientHeight < scrollThreshold) {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
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
      { enabled: selectedFolderId !== "all" }
    );

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
      }
    );
  };

  const handleRemoveFromFolder = async (
    chatId: string,
    chatName: string,
    folderId: string
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
      }
    );
  };

  const handleChatClick = async (
    chatId: string,
    hasUnreadMessages: boolean
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

  // Handle drag end for chat assignment to folders
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const chatId = active.id as string;
      const folderId = over.id as string;

      // Check if the chat is obfuscated - prevent assignment if so
      const chat = mails.find((mail) => mail.email === chatId);
      if (chat?.isObfuscated) {
        toast.info("Unlock this contact to organize", {
          description: "Premium contacts can't be organized until unlocked",
          action: {
            label: "Unlock",
            onClick: () => router.push("/billing"),
          },
        });
        return;
      }

      // Assign chat to folder
      assignChatToFolderMutation.mutate({
        chatId,
        folderId,
      });
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

  // Flatten the infinite query pages
  const typedChats = chatsData?.pages.flatMap((page) => page.chats) || [];

  // Get chats to display based on folder selection
  const chatsToDisplay: ChatData[] =
    selectedFolderId === "all"
      ? typedChats
      : (folderChatsData as unknown as ChatFolderAssignment[])?.map(
          (assignment) => assignment.chat
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
      const attendee = chat.UnipileChatAttendee?.find(
        (a: ChatAttendee) => a.is_self !== 1
      );
      const contact = attendee?.contact;

      // Check if this chat is obfuscated
      const isObfuscated =
        contact?.full_name === "Premium Contact" ||
        contact?.headline === "Upgrade to view this contact";

      // Search criteria
      const searchableFields = [];

      if (!isObfuscated) {
        // Contact name
        const contactName = contact?.full_name || contact?.first_name || "";
        if (contactName) searchableFields.push(contactName.toLowerCase());

        // Contact headline
        const headline = contact?.headline || "";
        if (headline) searchableFields.push(headline.toLowerCase());

        // Latest message content
        const latestMessage = chat.UnipileMessage?.[0];
        const messageContent = latestMessage?.content || "";
        if (
          messageContent &&
          !messageContent.includes("Upgrade to view messages")
        ) {
          searchableFields.push(messageContent.toLowerCase());
        }
      } else {
        // For obfuscated contacts, allow searching for "premium", "contact", "unlock", etc.
        // This creates discoverability and FOMO
        searchableFields.push("premium contact", "unlock", "upgrade", "hidden");
      }

      // Check if search term matches any searchable field
      const matchesSearch = searchableFields.some((field) =>
        field.includes(searchLower)
      );

      return matchesSearch;
    }

    return true;
  });

  // Filter out chats without proper contact information
  const chatsWithContacts = filteredChats.filter((chat) => {
    const attendee = chat.UnipileChatAttendee?.find(
      (a: ChatAttendee) => a.is_self !== 1
    );
    const contact = attendee?.contact;
    // Only include chats where we have meaningful contact information
    return contact && (contact.full_name || contact.first_name);
  });

  // Sort chats by newest message first (most recent conversation at the top)
  const sortedChats = chatsWithContacts.sort((a, b) => {
    const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return dateB - dateA; // Descending order (newest first)
  });

  // Convert chats to the existing mail format
  const mails: GroupedChat[] = sortedChats.map((chat) => {
    const attendee = chat.UnipileChatAttendee?.find(
      (a: ChatAttendee) => a.is_self !== 1
    );
    const contact = attendee?.contact;
    const contactName =
      contact?.full_name || contact?.first_name || "Unknown Contact";

    // Check if this chat is obfuscated (contact limits exceeded)
    const isObfuscated =
      contact?.full_name === "Premium Contact" ||
      contact?.headline === "Upgrade to view this contact";

    // Get the latest message for teaser
    const latestMessage = chat.UnipileMessage?.[0];
    let messageTeaser = latestMessage?.content
      ? latestMessage.content.split(" ").slice(0, 8).join(" ") +
        (latestMessage.content.split(" ").length > 8 ? "..." : "")
      : "No messages yet";

    // If obfuscated, the message content will also be obfuscated
    if (
      isObfuscated &&
      latestMessage?.content?.includes("Upgrade to view messages")
    ) {
      messageTeaser = latestMessage.content;
    }

    return {
      email: chat.id, // Use chat ID as unique identifier
      name: contactName,
      date: chat.last_message_at
        ? formatDistanceToNow(new Date(chat.last_message_at), {
            addSuffix: true,
          })
        : "",
      subject: contact?.headline || "",
      teaser: messageTeaser,
      avatar: isObfuscated ? null : contact?.profile_image_url || null, // Hide avatar for obfuscated contacts
      initials: contactName
        ? contactName
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : "UC",
      provider: chat.provider,
      isObfuscated, // Add the obfuscation flag
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
    {} as Record<string, GroupedChat[]>
  );

  // Sort providers alphabetically and ensure LINKEDIN comes first if it exists
  const sortedProviders = Object.keys(groupedChats).sort((a, b) => {
    if (a === "LINKEDIN") return -1;
    if (b === "LINKEDIN") return 1;
    return a.localeCompare(b);
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex min-h-screen w-[450px] justify-center border-gray-200 border-r bg-white">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="p-6 pb-4">
            <div className="flex w-full items-center justify-between">
              <div className="font-medium text-base text-foreground">
                {activeItem?.title}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="filter-select" className="text-sm">
                  Filter:
                </Label>
                <Select
                  value={filterMode}
                  onValueChange={(value: FilterMode) => setFilterMode(value)}
                >
                  <SelectTrigger
                    id="filter-select"
                    className="h-8 w-24 text-xs"
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

            {/* Contact Limit Status */}
            {contactLimitStatus && (
              <div
                className={`mt-3 rounded-md border p-2 text-xs ${
                  contactLimitStatus.isExceeded
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-gray-200 bg-gray-50 text-gray-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>
                    Contacts: {contactLimitStatus.count}/
                    {contactLimitStatus.limit}
                  </span>
                  {contactLimitStatus.isExceeded && (
                    <button
                      type="button"
                      onClick={() => router.push("/billing")}
                      className="text-amber-600 underline hover:text-amber-800"
                    >
                      Upgrade
                    </button>
                  )}
                </div>
                {contactLimitStatus.isExceeded && (
                  <div className="mt-1 text-amber-600">
                    Some contacts are hidden. Upgrade to see all contacts.
                  </div>
                )}
              </div>
            )}

            <div className="relative mt-3">
              <Input
                placeholder="Type to search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-8"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground hover:text-foreground"
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
          <div className="border-b p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium text-sm">Folders</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateFolder(!showCreateFolder)}
                className="h-6 w-6 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <SortableContext
              items={[
                "all",
                ...(foldersData?.map((f: FolderData) => f.id) || []),
              ]}
              strategy={verticalListSortingStrategy}
            >
              {/* All Chats folder */}
              <DroppableFolder
                folder={{
                  id: "all",
                  name: "All Chats",
                  chat_count: typedChats.length,
                }}
                isSelected={selectedFolderId === "all"}
                onClick={() => setSelectedFolderId("all")}
              />

              {/* User folders */}
              {foldersData?.map((folder: FolderData) => (
                <DroppableFolder
                  key={folder.id}
                  folder={folder}
                  isSelected={selectedFolderId === folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                />
              ))}
            </SortableContext>

            {/* Create folder input */}
            {showCreateFolder && (
              <div className="mt-3 flex gap-2">
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
                  className="text-sm"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleCreateFolder}
                  disabled={
                    !newFolderName.trim() || createFolderMutation.isPending
                  }
                >
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCreateFolder(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          {/* Chats Section */}
          <div
            className="p-0"
            ref={chatsContainerRef}
            style={{ maxHeight: "calc(100vh - 400px)", overflowY: "auto" }}
          >
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
              <SortableContext
                items={mails.map((mail) => mail.email)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {sortedProviders.map((provider) => (
                    <div key={provider}>
                      <div className="flex flex-row items-center gap-2 border-b bg-muted/30 px-4 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                        {renderProviderIcon(provider)}
                        {provider}
                      </div>
                      <div>
                        {groupedChats[provider]?.map((mail) => (
                          <SortableChatItem
                            key={mail.email}
                            mail={mail}
                            selectedChatId={selectedChatId}
                            chatsData={typedChats}
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
                    <div className="border-t p-4">
                      <button
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                        type="button"
                      >
                        {isFetchingNextPage
                          ? "Loading..."
                          : "Load more conversations"}
                      </button>
                    </div>
                  )}
                </div>
              </SortableContext>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog />
    </DndContext>
  );
}
