"use client";

import { formatDistanceToNow } from "date-fns";
import {
	ArrowLeft,
	Check,
	CheckCheck,
	Clock,
	ExternalLink,
	MessageCircle,
	MoreVertical,
	Send,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

interface ChatAttendee {
	id: string;
	name?: string | null;
	profile_image_url?: string | null;
	profile_url?: string | null;
	headline?: string | null;
	is_self?: number | null;
	external_id?: string | null;
}

interface ChatData {
	id: string;
	name?: string | null;
	last_message_at?: Date | null;
	unread_count: number;
	UnipileChatAttendee?: ChatAttendee[];
}

interface MessageData {
	id: string;
	content?: string | null;
	is_outgoing: boolean;
	is_read: boolean;
	sent_at?: Date | null;
	sender_id?: string | null;
}

export default function InboxPage() {
	return (
		<div className="flex h-full flex-col">
			<div className="flex h-full items-center justify-center">
				<div className="text-center text-muted-foreground">
					<div className="mb-4">
						<svg
							className="mx-auto h-16 w-16 text-gray-300"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-label="Chat icon"
						>
							<title>Chat icon</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1}
								d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
							/>
						</svg>
					</div>
					<h3 className="font-medium text-lg">Select a conversation</h3>
					<p className="text-sm">
						Choose a chat from your inbox to view and respond to messages
					</p>
				</div>
			</div>
		</div>
	);
}
