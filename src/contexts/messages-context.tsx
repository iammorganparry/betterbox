"use client";

import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useMemo,
	useReducer,
} from "react";
import type { unipileMessages } from "~/db/schema";

// Types - extend the Drizzle schema type with our optimistic flags
export type Message = typeof unipileMessages.$inferSelect & {
	isOptimistic?: boolean; // Flag to identify optimistic messages
	isFailed?: boolean; // Flag for failed messages
};

export interface MessagesState {
	messagesByChatId: Record<string, Message[]>;
	loading: Record<string, boolean>;
	error: Record<string, string | null>;
}

// Actions
export type MessagesAction =
	| { type: "SET_MESSAGES"; payload: { chatId: string; messages: Message[] } }
	| { type: "MERGE_MESSAGES"; payload: { chatId: string; messages: Message[] } }
	| { type: "ADD_MESSAGE"; payload: { chatId: string; message: Message } }
	| {
			type: "UPDATE_MESSAGE";
			payload: { chatId: string; messageId: string; updates: Partial<Message> };
	  }
	| { type: "REMOVE_MESSAGE"; payload: { chatId: string; messageId: string } }
	| { type: "SET_LOADING"; payload: { chatId: string; loading: boolean } }
	| { type: "SET_ERROR"; payload: { chatId: string; error: string | null } }
	| { type: "CLEAR_CHAT"; payload: { chatId: string } };

// Initial state
const initialState: MessagesState = {
	messagesByChatId: {},
	loading: {},
	error: {},
};

// Reducer
function messagesReducer(
	state: MessagesState,
	action: MessagesAction,
): MessagesState {
	switch (action.type) {
		case "SET_MESSAGES":
			return {
				...state,
				messagesByChatId: {
					...state.messagesByChatId,
					[action.payload.chatId]: action.payload.messages,
				},
				loading: {
					...state.loading,
					[action.payload.chatId]: false,
				},
				error: {
					...state.error,
					[action.payload.chatId]: null,
				},
			};

		case "MERGE_MESSAGES": {
			const { chatId, messages: newMessages } = action.payload;
			const existingMessages = state.messagesByChatId[chatId] || [];

			// Keep optimistic and failed messages
			const optimisticMessages = existingMessages.filter(
				(msg) => msg.isOptimistic && !msg.isFailed,
			);
			const failedMessages = existingMessages.filter((msg) => msg.isFailed);

			// Simple message processing: just fix optimistic messages
			const processMessages = (messages: Message[]): Message[] => {
				return messages.map((msg) => {
					// Fix is_outgoing for optimistic messages (those with local- external_id)
					if (msg.external_id?.startsWith("local-")) {
						return { ...msg, is_outgoing: true };
					}
					return msg;
				});
			};

			// Merge all messages and process them
			const allMessages = [
				...newMessages,
				...optimisticMessages,
				...failedMessages,
			];
			const processedMessages = processMessages(allMessages);

			// Sort by sent_at to maintain chronological order
			processedMessages.sort((a, b) => {
				const aTime = a.sent_at ? new Date(a.sent_at).getTime() : 0;
				const bTime = b.sent_at ? new Date(b.sent_at).getTime() : 0;
				return aTime - bTime;
			});

			return {
				...state,
				messagesByChatId: {
					...state.messagesByChatId,
					[chatId]: processedMessages,
				},
				loading: {
					...state.loading,
					[chatId]: false,
				},
				error: {
					...state.error,
					[chatId]: null,
				},
			};
		}

		case "ADD_MESSAGE": {
			const { chatId, message } = action.payload;
			const existingMessages = state.messagesByChatId[chatId] || [];

			return {
				...state,
				messagesByChatId: {
					...state.messagesByChatId,
					[chatId]: [...existingMessages, message],
				},
			};
		}

		case "UPDATE_MESSAGE": {
			const { chatId, messageId, updates } = action.payload;
			const existingMessages = state.messagesByChatId[chatId] || [];

			return {
				...state,
				messagesByChatId: {
					...state.messagesByChatId,
					[chatId]: existingMessages.map((msg) =>
						msg.id === messageId ? { ...msg, ...updates } : msg,
					),
				},
			};
		}

		case "REMOVE_MESSAGE": {
			const { chatId, messageId } = action.payload;
			const existingMessages = state.messagesByChatId[chatId] || [];

			return {
				...state,
				messagesByChatId: {
					...state.messagesByChatId,
					[chatId]: existingMessages.filter((msg) => msg.id !== messageId),
				},
			};
		}

		case "SET_LOADING":
			return {
				...state,
				loading: {
					...state.loading,
					[action.payload.chatId]: action.payload.loading,
				},
			};

		case "SET_ERROR":
			return {
				...state,
				error: {
					...state.error,
					[action.payload.chatId]: action.payload.error,
				},
			};

		case "CLEAR_CHAT":
			return {
				...state,
				messagesByChatId: {
					...state.messagesByChatId,
					[action.payload.chatId]: [],
				},
				loading: {
					...state.loading,
					[action.payload.chatId]: false,
				},
				error: {
					...state.error,
					[action.payload.chatId]: null,
				},
			};

		default:
			return state;
	}
}

// Context
interface MessagesContextType {
	state: MessagesState;
	dispatch: React.Dispatch<MessagesAction>;
	// Helper functions
	getMessages: (chatId: string) => Message[];
	addOptimisticMessage: (chatId: string, content: string) => string; // Returns message ID
	markMessageAsFailed: (chatId: string, messageId: string) => void;
	removeOptimisticMessage: (chatId: string, messageId: string) => void;
	setMessages: (chatId: string, messages: Message[]) => void;
	mergeMessages: (chatId: string, messages: Message[]) => void;
	isLoading: (chatId: string) => boolean;
	getError: (chatId: string) => string | null;
}

const MessagesContext = createContext<MessagesContextType | undefined>(
	undefined,
);

// Provider
interface MessagesProviderProps {
	children: ReactNode;
}

export function MessagesProvider({ children }: MessagesProviderProps) {
	const [state, dispatch] = useReducer(messagesReducer, initialState);

	// Helper functions
	const getMessages = useCallback(
		(chatId: string): Message[] => {
			return state.messagesByChatId[chatId] || [];
		},
		[state.messagesByChatId],
	);

	const addOptimisticMessage = useCallback(
		(chatId: string, content: string): string => {
			const now = new Date();
			const messageId = `temp-${Date.now()}-${Math.random()
				.toString(36)
				.substr(2, 9)}`;

			const optimisticMessage: Message = {
				id: messageId,
				external_id: messageId,
				content: content,
				is_outgoing: true,
				is_read: true,
				sent_at: now,
				created_at: now,
				updated_at: now,
				sender_id: null,
				recipient_id: null,
				message_type: "text",
				seen: 1,
				hidden: 0,
				deleted: 0,
				edited: 0,
				is_event: 0,
				delivered: 1,
				behavior: 0,
				event_type: 0,
				replies: 0,
				sender_urn: null,
				attendee_type: null,
				attendee_distance: null,
				subject: null,
				parent: null,
				metadata: null,
				unipile_account_id: messageId, // Use temp ID for account
				chat_id: chatId,
				is_deleted: false,
				external_chat_id: null,
				isOptimistic: true,
			};

			dispatch({
				type: "ADD_MESSAGE",
				payload: { chatId, message: optimisticMessage },
			});

			return messageId;
		},
		[],
	);

	const markMessageAsFailed = useCallback(
		(chatId: string, messageId: string) => {
			dispatch({
				type: "UPDATE_MESSAGE",
				payload: {
					chatId,
					messageId,
					updates: { isFailed: true },
				},
			});
		},
		[],
	);

	const removeOptimisticMessage = useCallback(
		(chatId: string, messageId: string) => {
			dispatch({
				type: "REMOVE_MESSAGE",
				payload: { chatId, messageId },
			});
		},
		[],
	);

	const setMessages = useCallback((chatId: string, messages: Message[]) => {
		dispatch({
			type: "SET_MESSAGES",
			payload: { chatId, messages },
		});
	}, []);

	const mergeMessages = useCallback((chatId: string, messages: Message[]) => {
		dispatch({
			type: "MERGE_MESSAGES",
			payload: { chatId, messages },
		});
	}, []);

	const isLoading = useCallback(
		(chatId: string): boolean => {
			return state.loading[chatId] ?? false;
		},
		[state.loading],
	);

	const getError = useCallback(
		(chatId: string): string | null => {
			return state.error[chatId] ?? null;
		},
		[state.error],
	);

	const contextValue: MessagesContextType = useMemo(
		() => ({
			state,
			dispatch,
			getMessages,
			addOptimisticMessage,
			markMessageAsFailed,
			removeOptimisticMessage,
			setMessages,
			mergeMessages,
			isLoading,
			getError,
		}),
		[
			state,
			getMessages,
			addOptimisticMessage,
			markMessageAsFailed,
			removeOptimisticMessage,
			setMessages,
			mergeMessages,
			isLoading,
			getError,
		],
	);

	return (
		<MessagesContext.Provider value={contextValue}>
			{children}
		</MessagesContext.Provider>
	);
}

// Hook
export function useMessages() {
	const context = useContext(MessagesContext);
	if (context === undefined) {
		throw new Error("useMessages must be used within a MessagesProvider");
	}
	return context;
}
