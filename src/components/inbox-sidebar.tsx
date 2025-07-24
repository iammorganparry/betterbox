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
} from "lucide-react";
import { useState } from "react";
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
import {
  useSortable,
} from "@dnd-kit/sortable";
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
import { sidebarConfig } from "./config/sidebar";
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

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
}

type FilterMode = "all" | "unread" | "read";

export const InboxSidebar = () => {
  const [activeItem, setActiveItem] = useState(sidebarConfig[0]);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [markingAsReadId, setMarkingAsReadId] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const router = useRouter();
  const params = useParams();
  const selectedChatId = params?.chatId as string;

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch chats from TRPC - removed provider filter to get all providers
  const {
    data: chatsData,
    isLoading: chatsLoading,
    refetch: refetchChats,
  } = api.inbox.getChats.useQuery({
    limit: 50,
    // provider: "linkedin", // Removed to get all providers
  });

  // Fetch folders
  const {
    data: foldersData,
    isLoading: foldersLoading,
    refetch: refetchFolders,
  } = api.inbox.getFolders.useQuery();

  // Get chats in selected folder
  const {
    data: folderChatsData,
    isLoading: folderChatsLoading,
  } = api.inbox.getChatsInFolder.useQuery(
    { folderId: selectedFolderId },
    { enabled: selectedFolderId !== "all" }
  );

  // Mark chat as read mutation
  const markChatAsReadMutation = api.inbox.markChatAsRead.useMutation({
    onSuccess: (data) => {
      toast.success("Chat marked as read");
      // Refetch chats to update the sidebar
      void refetchChats();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to mark chat as read");
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
    onSuccess: () => {
      toast.success("Chat assigned to folder");
      void refetchChats();
      void refetchFolders();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to assign chat to folder");
    },
  });

  // Remove chat from folder mutation
  const removeChatFromFolderMutation = api.inbox.removeChatFromFolder.useMutation({
    onSuccess: () => {
      toast.success("Chat removed from folder");
      void refetchChats();
      void refetchFolders();
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
    if (
      window.confirm(
        `Are you sure you want to delete the conversation with ${chatName}? This action cannot be undone.`
      )
    ) {
      setDeletingChatId(chatId);
      softDeleteChatMutation.mutate({ chatId });
    }
  };

  const handleChatClick = async (
    chatId: string,
    hasUnreadMessages: boolean
  ) => {
    // Navigate to the chat first for immediate response
    router.push(`/inbox/${chatId}`);

    // Always mark as read if it has unread messages (more robust approach)
    if (hasUnreadMessages && markingAsReadId !== chatId) {
      setMarkingAsReadId(chatId);
      try {
        await markChatAsReadMutation.mutateAsync({ chatId });
      } catch (error) {
        // Error handling is already in the mutation's onError
        console.error("Failed to mark chat as read:", error);
      }
    }
  };

  // Handle drag end for chat assignment to folders
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const chatId = active.id as string;
      const folderId = over.id as string;

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

  const typedChats = (chatsData as ChatData[]) || [];

  // Get chats to display based on folder selection
  const chatsToDisplay: ChatData[] = selectedFolderId === "all"
    ? typedChats
    : (folderChatsData as any)?.map((assignment: any) => assignment.chat) || [];

  // Filter chats based on selected filter mode
  const filteredChats = chatsToDisplay.filter((chat: ChatData) => {
    switch (filterMode) {
      case "unread":
        return chat.unread_count > 0;
      case "read":
        return chat.unread_count === 0;
      case "all":
      default:
        return true;
    }
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

  // Convert chats to the existing mail format
  const mails: GroupedChat[] = chatsWithContacts.map((chat) => {
    const attendee = chat.UnipileChatAttendee?.find(
      (a: ChatAttendee) => a.is_self !== 1
    );
    const contact = attendee?.contact;
    const contactName =
      contact?.full_name || contact?.first_name || "Unknown Contact";

    // Get the latest message for teaser
    const latestMessage = chat.UnipileMessage?.[0];
    const messageTeaser = latestMessage?.content
      ? latestMessage.content.split(" ").slice(0, 8).join(" ") +
      (latestMessage.content.split(" ").length > 8 ? "..." : "")
      : "No messages yet";

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
  const groupedChats = mails.reduce((groups: Record<string, GroupedChat[]>, chat: GroupedChat) => {
    const provider = chat.provider.toUpperCase();
    if (!groups[provider]) {
      groups[provider] = [];
    }
    groups[provider].push(chat);
    return groups;
  }, {} as Record<string, GroupedChat[]>);

  // Sort providers alphabetically and ensure LINKEDIN comes first if it exists
  const sortedProviders = Object.keys(groupedChats).sort((a, b) => {
    if (a === "LINKEDIN") return -1;
    if (b === "LINKEDIN") return 1;
    return a.localeCompare(b);
  });

  // Sortable Chat Item Component
  const SortableChatItem = ({ mail }: { mail: GroupedChat }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id: mail.email });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const chatData = chatsData?.find(
      (chat) => chat.id === mail.email
    );
    const hasUnreadMessages = (chatData?.unread_count ?? 0) > 0;

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`group flex w-full items-center border-b last:border-b-0 hover:bg-muted/50 ${selectedChatId === mail.email ? "bg-muted" : ""
          }`}
      >
        <button
          type="button"
          onClick={() => handleChatClick(mail.email, hasUnreadMessages)}
          className="flex flex-1 flex-col items-start gap-2 whitespace-nowrap p-4 text-left text-sm leading-tight"
        >
          <div className="flex w-full items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={mail.avatar || undefined} alt={mail.name} />
              <AvatarFallback className="text-xs">
                {mail.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 items-center justify-between">
              <span className="font-medium">{mail.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {mail.date}
                </span>
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

        {/* Context menu for chat actions */}
        <div className="p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
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
                    <DropdownMenuItem
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Folder className="mr-2 h-4 w-4" />
                      Add to folder
                    </DropdownMenuItem>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start">
                    {foldersData.map((folder: any) => (
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

  // Droppable Folder Component
  const DroppableFolder = ({
    folder,
    isSelected,
    onClick
  }: {
    folder: { id: string; name: string; chat_count: number };
    isSelected: boolean;
    onClick: () => void;
  }) => {
    const {
      setNodeRef,
      isOver,
    } = useSortable({ id: folder.id });

    return (
      <div
        ref={setNodeRef}
        onClick={onClick}
        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer transition-colors ${isSelected
          ? "bg-primary text-primary-foreground"
          : isOver
            ? "bg-muted/70"
            : "hover:bg-muted/50"
          }`}
      >
        <Folder className="h-4 w-4" />
        <span className="flex-1">{folder.name}</span>
        <span className="text-xs text-muted-foreground">
          {folder.chat_count}
        </span>
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex min-h-screen justify-center border-gray-200 border-r bg-white pt-8">
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
                <Select value={filterMode} onValueChange={(value: FilterMode) => setFilterMode(value)}>
                  <SelectTrigger id="filter-select" className="w-24 h-8 text-xs">
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
            <Input placeholder="Type to search..." className="mt-3" />
          </div>

          {/* Folders Section */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
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
                ...(foldersData?.map((f: any) => f.id) || [])
              ]}
              strategy={verticalListSortingStrategy}
            >
              {/* All Chats folder */}
              <DroppableFolder
                folder={{ id: "all", name: "All Chats", chat_count: typedChats.length }}
                isSelected={selectedFolderId === "all"}
                onClick={() => setSelectedFolderId("all")}
              />

              {/* User folders */}
              {foldersData?.map((folder: any) => (
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
                  disabled={!newFolderName.trim() || createFolderMutation.isPending}
                >
                  Add
                </Button>
              </div>
            )}
          </div>
          {/* Chats Section */}
          <div className="p-0">
            {chatsLoading || folderChatsLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Loading conversations...
              </div>
            ) : mails.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                {filterMode === "unread"
                  ? "No unread conversations"
                  : filterMode === "read"
                    ? "No read conversations"
                    : "No conversations found"}
              </div>
            ) : (
              <SortableContext
                items={mails.map(mail => mail.email)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {sortedProviders.map((provider) => (
                    <div key={provider}>
                      <div className="border-b bg-muted/30 px-4 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                        {provider}
                      </div>
                      <div>
                        {groupedChats[provider]?.map((mail) => (
                          <SortableChatItem key={mail.email} mail={mail} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </SortableContext>
            )}
          </div>
        </div>
      </div>
    </DndContext>
  );
};
