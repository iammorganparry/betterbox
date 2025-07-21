import {
  ArchiveX,
  Home,
  Inbox,
  Send,
  Trash2,
  File,
  BarChart3,
  User,
} from "lucide-react";

export const sidebarConfig = [
  {
    title: "Home",
    url: "/",
    icon: Home,
    isActive: true,
  },
  {
    title: "Accounts",
    url: "/accounts",
    icon: User,
    isActive: false,
  },
  {
    title: "Inbox",
    url: "/inbox",
    icon: Inbox,
    isActive: true,
  },
  {
    title: "Drafts",
    url: "#",
    icon: File,
    isActive: false,
  },
  {
    title: "Sent",
    url: "#",
    icon: Send,
    isActive: false,
  },
  {
    title: "Junk",
    url: "#",
    icon: ArchiveX,
    isActive: false,
  },
  {
    title: "Trash",
    url: "#",
    icon: Trash2,
    isActive: false,
  },
];
