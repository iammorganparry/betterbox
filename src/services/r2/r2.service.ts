import {
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

/**
 * Cloudflare R2 storage service using S3-compatible API
 */

const s3Client = new S3Client({
	region: "auto", // R2 uses "auto" as the region
	endpoint: env.R2_ENDPOINT,
	credentials: {
		accessKeyId: env.R2_ACCESS_KEY,
		secretAccessKey: env.R2_SECRET_KEY,
	},
	forcePathStyle: true, // Required for R2
});

export class R2Service {
	private bucket: string;
	private endpoint: string;

	constructor(private readonly s3Client: S3Client) {
		this.bucket = env.R2_BUCKET;
		this.endpoint = env.R2_ENDPOINT;
	}

	/**
	 * Upload a file to R2
	 * @param key - The path/key in the bucket
	 * @param data - File data as Uint8Array, Buffer, or Readable stream
	 * @param mimeType - MIME type of the file
	 * @param metadata - Optional metadata
	 * @returns The public URL of the uploaded file
	 */
	async upload(
		key: string,
		data: Uint8Array | Buffer | NodeJS.ReadableStream,
		mimeType: string,
		metadata?: Record<string, string>,
	): Promise<string> {
		try {
			console.log(`📤 Uploading to R2: ${key} (${mimeType})`);

			const command = new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				// @ts-expect-error - data is a valid type
				Body: data,
				ContentType: mimeType,
				Metadata: metadata,
			});

			await this.s3Client.send(command);

			// Return public URL - assuming public bucket for now
			// For private buckets, this would return a signed URL
			const publicUrl = `${this.endpoint}/${this.bucket}/${key}`;

			console.log(`✅ Successfully uploaded to R2: ${publicUrl}`);
			return publicUrl;
		} catch (error) {
			console.error(`❌ Failed to upload ${key} to R2:`, error);
			throw new Error(
				`R2 upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Check if a file exists in R2
	 * @param key - The path/key in the bucket
	 * @returns True if the file exists, false otherwise
	 */
	async exists(key: string): Promise<boolean> {
		try {
			const command = new HeadObjectCommand({
				Bucket: this.bucket,
				Key: key,
			});

			await this.s3Client.send(command);
			return true;
		} catch (error) {
			// HeadObject throws an error if the object doesn't exist
			return false;
		}
	}

	/**
	 * Generate a signed URL for private access
	 * @param key - The path/key in the bucket
	 * @param expiresInSeconds - URL expiration time in seconds (default: 24 hours)
	 * @returns Signed URL
	 */
	async getSignedUrl(key: string, expiresInSeconds = 86400): Promise<string> {
		try {
			const command = new GetObjectCommand({
				Bucket: this.bucket,
				Key: key,
			});

			const signedUrl = await getSignedUrl(this.s3Client, command, {
				expiresIn: expiresInSeconds,
			});

			return signedUrl;
		} catch (error) {
			console.error(`❌ Failed to generate signed URL for ${key}:`, error);
			throw new Error(
				`Failed to generate signed URL: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Generate a unique key for an attachment
	 * @param messageId - The message ID
	 * @param originalFilename - Original filename
	 * @param mimeType - MIME type for extension fallback
	 * @returns Unique key for R2 storage
	 */
	generateAttachmentKey(
		messageId: string,
		originalFilename?: string,
		mimeType?: string,
	): string {
		// Generate random suffix to avoid collisions
		const randomSuffix = Math.random().toString(36).substring(2, 8);

		// Extract extension from filename or derive from MIME type
		let extension = "";
		if (originalFilename?.includes(".")) {
			extension = originalFilename.split(".").pop() || "";
		} else if (mimeType) {
			// Basic MIME to extension mapping
			const mimeToExt: Record<string, string> = {
				"image/jpeg": "jpg",
				"image/jpg": "jpg",
				"image/png": "png",
				"image/gif": "gif",
				"image/webp": "webp",
				"image/svg+xml": "svg",
				"video/mp4": "mp4",
				"video/webm": "webm",
				"video/quicktime": "mov",
				"audio/mpeg": "mp3",
				"audio/wav": "wav",
				"audio/ogg": "ogg",
				"application/pdf": "pdf",
				"text/plain": "txt",
				"application/msword": "doc",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
					"docx",
			};
			extension = mimeToExt[mimeType] || "bin";
		}

		// Create key: attachments/{messageId}/{random}.{ext}
		const filename = extension ? `${randomSuffix}.${extension}` : randomSuffix;
		return `attachments/${messageId}/${filename}`;
	}

	/**
	 * Get the public URL for a key (for public buckets)
	 * @param key - The path/key in the bucket
	 * @returns Public URL
	 */
	getPublicUrl(key: string): string {
		return `${this.endpoint}/${this.bucket}/${key}`;
	}
}

/**
 * Create a new R2Service instance
 */
export function createR2Service(): R2Service {
	return new R2Service(s3Client);
}
