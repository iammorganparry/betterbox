"use client";

import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { forwardRef, useEffect, useImperativeHandle } from "react";

interface RichTextEditorProps {
	value: string;
	onChange: (value: string) => void;
	onKeyDown?: (event: KeyboardEvent) => void;
	onPaste?: (event: ClipboardEvent) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

export interface RichTextEditorRef {
	focus: () => void;
	insertText: (text: string) => void;
	getSelectionRange: () => { from: number; to: number };
	setSelectionRange: (from: number, to: number) => void;
	getTextLength: () => number;
}

export const RichTextEditor = forwardRef<
	RichTextEditorRef,
	RichTextEditorProps
>(
	(
		{ value, onChange, onKeyDown, onPaste, placeholder, disabled, className },
		ref,
	) => {
		const editor = useEditor({
			extensions: [
				StarterKit.configure({
					// Disable some features we don't need for chat
					heading: false,
					blockquote: false,
					horizontalRule: false,
					bulletList: false,
					orderedList: false,
					listItem: false,
					codeBlock: false,
				}),
				Placeholder.configure({
					placeholder: placeholder || "Type a message...",
				}),
				Image.configure({
					inline: true,
					allowBase64: true,
				}),
			],
			content: value,
			editable: !disabled,
			immediatelyRender: false, // Fix SSR hydration issues
			onUpdate: ({ editor }) => {
				// Get plain text content for now - we can enhance this later for rich text
				const text = editor.getText();
				onChange(text);
			},
			editorProps: {
				handleKeyDown: (view, event) => {
					// Let the parent handle keyboard events first
					onKeyDown?.(event);
					return false; // Allow default handling
				},
				handlePaste: (view, event) => {
					onPaste?.(event);
					return false; // Allow default handling
				},
				attributes: {
					class: "prose prose-sm focus:outline-none focus-visible:outline-none",
				},
			},
		});

		// Update content when value prop changes
		useEffect(() => {
			if (editor && value !== editor.getText()) {
				editor.commands.setContent(value);
			}
		}, [value, editor]);

		// Update disabled state
		useEffect(() => {
			if (editor) {
				editor.setEditable(!disabled);
			}
		}, [disabled, editor]);

		// Expose methods via ref
		useImperativeHandle(ref, () => ({
			focus: () => {
				editor?.commands.focus();
			},
			insertText: (text: string) => {
				if (editor) {
					editor.commands.insertContent(text);
				}
			},
			getSelectionRange: () => {
				if (editor) {
					const { from, to } = editor.state.selection;
					return { from, to };
				}
				return { from: 0, to: 0 };
			},
			setSelectionRange: (from: number, to: number) => {
				if (editor) {
					editor.commands.setTextSelection({ from, to });
				}
			},
			getTextLength: () => {
				return editor?.getText().length || 0;
			},
		}));

		if (!editor) {
			return null;
		}

		return (
			<div className={`rich-text-editor w-full ${className || ""}`}>
				<EditorContent
					editor={editor}
					className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
				/>
				<style jsx>{`
          .rich-text-editor .ProseMirror {
            outline: none !important;
            border: none !important;
            min-height: 20px;
            max-height: 120px; /* Allow for more height */
            overflow-y: auto;
            word-wrap: break-word;
            white-space: pre-wrap;
            width: 100%;
            line-height: 1.5;
          }

          .rich-text-editor .ProseMirror:focus,
          .rich-text-editor .ProseMirror:focus-visible {
            outline: none !important;
            border: none !important;
            box-shadow: none !important;
          }

          .rich-text-editor .ProseMirror p {
            margin: 0;
            line-height: 1.5;
          }

          .rich-text-editor .ProseMirror .is-editor-empty:first-child::before {
            color: hsl(var(--muted-foreground));
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
          }

          .rich-text-editor .ProseMirror img {
            max-width: 100%;
            height: auto;
            display: inline-block;
            border-radius: 4px;
          }

          .rich-text-editor .ProseMirror strong {
            font-weight: bold;
          }

          .rich-text-editor .ProseMirror em {
            font-style: italic;
          }

          .rich-text-editor .ProseMirror code {
            background-color: hsl(var(--muted));
            padding: 0.125rem 0.25rem;
            border-radius: 0.25rem;
            font-family: ui-monospace, SFMono-Regular, monospace;
            font-size: 0.875em;
          }

          /* Remove all outlines and focus rings */
          .rich-text-editor *,
          .rich-text-editor *:focus,
          .rich-text-editor *:focus-visible {
            outline: none !important;
            box-shadow: none !important;
          }
        `}</style>
			</div>
		);
	},
);

RichTextEditor.displayName = "RichTextEditor";
