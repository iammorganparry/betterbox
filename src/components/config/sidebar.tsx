import {
	ArchiveX,
	EyeIcon,
	Home,
	Inbox,
	Send,
	Trash2,
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
		title: "Profile Views",
		url: "/profile-views",
		icon: EyeIcon,
		disabled: true,
		isActive: false,
	},
];
