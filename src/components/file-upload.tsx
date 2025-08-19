"use client";

import {
	AlertCircle,
	File as FileIcon,
	Image as ImageIcon,
	Paperclip,
	Upload,
	X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export interface FileAttachment {
	id: string;
	file: File;
	type: "image" | "file";
	preview?: string; // Data URL for image preview
	data: string; // Base64 encoded file data
}

interface FileUploadProps {
	onFilesChange: (files: FileAttachment[]) => void;
	maxFiles?: number;
	maxFileSize?: number; // in MB
	acceptedTypes?: string[];
	disabled?: boolean;
	children?:
		| React.ReactNode
		| ((processFiles: (files: FileList | File[]) => void) => React.ReactNode);
}

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => {
			const result = reader.result as string;
			// Remove the data URL prefix to get just the base64 data
			const base64Data = result.split(",")[1];
			resolve(base64Data || "");
		};
		reader.onerror = reject;
	});
};

// Helper function to get file type
const getFileType = (file: File): "image" | "file" => {
	return file.type.startsWith("image/") ? "image" : "file";
};

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};

export function FileUpload({
	onFilesChange,
	maxFiles = 5,
	maxFileSize = 10, // 10MB default
	acceptedTypes = ["image/*", ".pdf", ".doc", ".docx", ".txt", ".xls", ".xlsx"],
	disabled = false,
	children,
}: FileUploadProps) {
	const [files, setFiles] = useState<FileAttachment[]>([]);
	const [isDragActive, setIsDragActive] = useState(false);
	const [isUploading, setIsUploading] = useState(false);

	const processFiles = useCallback(
		async (fileList: FileList | File[]) => {
			if (disabled || isUploading) return;

			setIsUploading(true);
			const newFiles: FileAttachment[] = [];

			try {
				// Handle both FileList and File[] properly
				const filesArray =
					fileList instanceof FileList ? Array.from(fileList) : fileList;

				for (const file of filesArray) {
					if (!file || !(file instanceof File)) continue; // Skip if not a valid File

					// Check file size
					if (file.size > maxFileSize * 1024 * 1024) {
						toast.error(
							`File "${file.name}" is too large. Maximum size is ${maxFileSize}MB.`,
						);
						continue;
					}

					// Check if we've reached max files
					if (files.length + newFiles.length >= maxFiles) {
						toast.error(`Maximum ${maxFiles} files allowed.`);
						break;
					}

					// Check if file already exists
					if (
						files.some(
							(f) => f.file.name === file.name && f.file.size === file.size,
						)
					) {
						toast.error(`File "${file.name}" already added.`);
						continue;
					}

					try {
						const base64Data = await fileToBase64(file);
						const fileType = getFileType(file);

						const attachment: FileAttachment = {
							id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
							file,
							type: fileType,
							data: base64Data,
						};

						// Generate preview for images
						if (fileType === "image") {
							attachment.preview = URL.createObjectURL(file);
						}

						newFiles.push(attachment);
					} catch (error) {
						console.error("Error processing file:", error);
						toast.error(`Failed to process file "${file.name}".`);
					}
				}

				if (newFiles.length > 0) {
					const updatedFiles = [...files, ...newFiles];
					setFiles(updatedFiles);
					onFilesChange(updatedFiles);
					toast.success(`${newFiles.length} file(s) added successfully.`);
				}
			} finally {
				setIsUploading(false);
			}
		},
		[files, maxFiles, maxFileSize, disabled, isUploading, onFilesChange],
	);

	const removeFile = useCallback(
		(fileId: string) => {
			const updatedFiles = files.filter((f) => {
				if (f.id === fileId) {
					// Clean up preview URL if it exists
					if (f.preview) {
						URL.revokeObjectURL(f.preview);
					}
					return false;
				}
				return true;
			});
			setFiles(updatedFiles);
			onFilesChange(updatedFiles);
		},
		[files, onFilesChange],
	);

	const handleDragEnter = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (!disabled) {
				setIsDragActive(true);
			}
		},
		[disabled],
	);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragActive(false);
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragActive(false);

			if (disabled) return;

			const droppedFiles = Array.from(e.dataTransfer.files);
			processFiles(droppedFiles);
		},
		[disabled, processFiles],
	);

	const handleFileInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (e.target.files && e.target.files.length > 0) {
				processFiles(e.target.files);
			}
			// Reset input value to allow selecting the same file again
			e.target.value = "";
		},
		[processFiles],
	);

	return (
		<div
			className="space-y-3"
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			{/* File input trigger */}
			<div className="flex items-center gap-2">
				{(typeof children === "function"
					? children(processFiles)
					: children) || (
					<>
						<input
							type="file"
							multiple
							accept={acceptedTypes.join(",")}
							onChange={handleFileInputChange}
							disabled={disabled || isUploading}
							className="hidden"
							id="file-upload"
						/>
						<label htmlFor="file-upload">
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								disabled={disabled || isUploading}
								asChild
							>
								<span className="cursor-pointer">
									<Paperclip className="h-4 w-4" />
								</span>
							</Button>
						</label>

						<input
							type="file"
							multiple
							accept="image/*"
							onChange={handleFileInputChange}
							disabled={disabled || isUploading}
							className="hidden"
							id="image-upload"
						/>
						<label htmlFor="image-upload">
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								disabled={disabled || isUploading}
								asChild
							>
								<span className="cursor-pointer">
									<ImageIcon className="h-4 w-4" />
								</span>
							</Button>
						</label>
					</>
				)}
			</div>

			{/* Compact attachment badges */}
			{files.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<span className="font-medium text-sm">
							{files.length} attachment{files.length > 1 ? "s" : ""}
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								for (const f of files) {
									if (f.preview) URL.revokeObjectURL(f.preview);
								}
								setFiles([]);
								onFilesChange([]);
							}}
							className="h-6 px-2 text-xs"
						>
							Clear all
						</Button>
					</div>

					{/* Compact badges row */}
					<div className="flex flex-wrap gap-1">
						{files.map((file) => (
							<div
								key={file.id}
								className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1 text-sm"
							>
								{/* Tiny thumbnail for images */}
								{file.type === "image" && file.preview ? (
									<img
										src={file.preview}
										alt={file.file.name}
										className="h-5 w-5 rounded object-cover"
									/>
								) : (
									<FileIcon className="h-4 w-4 text-muted-foreground" />
								)}

								{/* File info */}
								<div className="flex items-center gap-1">
									<span className="max-w-[100px] truncate text-xs">
										{file.type === "image" ? "Image" : file.file.name}
									</span>
									<span className="text-muted-foreground text-xs">
										({formatFileSize(file.file.size)})
									</span>
								</div>

								{/* Remove button */}
								<Button
									variant="ghost"
									size="sm"
									onClick={() => removeFile(file.id)}
									className="h-4 w-4 p-0 hover:bg-destructive/10"
								>
									<X className="h-3 w-3" />
								</Button>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Upload status */}
			{isUploading && (
				<div className="flex items-center gap-2 text-muted-foreground text-sm">
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					Processing files...
				</div>
			)}
		</div>
	);
}
