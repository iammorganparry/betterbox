import { describe, it, expect, vi } from "vitest";

/**
 * Unit tests for attachment processing logic
 * These tests focus specifically on the attachment data transformation
 */

// Extract the attachment processing logic for isolated testing
function processAttachmentData(attachment: any) {
  return {
    id: attachment.id || attachment.attachment_id,
    type: (attachment.type || attachment.attachment_type) as
      | "img"
      | "video"
      | "audio"
      | "file"
      | "linkedin_post"
      | "video_meeting"
      | undefined,
    url:
      attachment.url ||
      attachment.content_url ||
      attachment.download_url ||
      attachment.media_url ||
      attachment.src ||
      attachment.href,
    filename: attachment.filename || attachment.file_name || attachment.name,
    file_size: attachment.file_size || attachment.size,
    mime_type: attachment.mime_type || attachment.mimetype,
    unavailable: attachment.unavailable,
  };
}

describe("Attachment Processing Logic", () => {
  describe("Field Mapping", () => {
    it("should map standard attachment fields", () => {
      const webhookAttachment = {
        id: "att-123",
        type: "img",
        url: "https://example.com/image.jpg",
        filename: "photo.jpg",
        file_size: 1024000,
        mime_type: "image/jpeg",
        unavailable: false,
      };

      const result = processAttachmentData(webhookAttachment);

      expect(result).toEqual({
        id: "att-123",
        type: "img",
        url: "https://example.com/image.jpg",
        filename: "photo.jpg",
        file_size: 1024000,
        mime_type: "image/jpeg",
        unavailable: false,
      });
    });

    it("should map alternative field names", () => {
      const webhookAttachment = {
        attachment_id: "att-456",
        attachment_type: "file",
        content_url: "https://cdn.example.com/document.pdf",
        file_name: "report.pdf",
        size: 2048000,
        mimetype: "application/pdf",
      };

      const result = processAttachmentData(webhookAttachment);

      expect(result).toEqual({
        id: "att-456",
        type: "file",
        url: "https://cdn.example.com/document.pdf",
        filename: "report.pdf",
        file_size: 2048000,
        mime_type: "application/pdf",
        unavailable: undefined,
      });
    });

    it("should prioritize standard fields over alternatives", () => {
      const webhookAttachment = {
        id: "standard-id",
        attachment_id: "alt-id",
        url: "https://example.com/standard.jpg",
        content_url: "https://example.com/alternative.jpg",
        filename: "standard.jpg",
        file_name: "alternative.jpg",
      };

      const result = processAttachmentData(webhookAttachment);

      expect(result.id).toBe("standard-id");
      expect(result.url).toBe("https://example.com/standard.jpg");
      expect(result.filename).toBe("standard.jpg");
    });

    it("should fall back to alternative fields when standard fields are missing", () => {
      const webhookAttachment = {
        attachment_id: "fallback-id",
        download_url: "https://example.com/download.pdf",
        name: "fallback.pdf",
      };

      const result = processAttachmentData(webhookAttachment);

      expect(result.id).toBe("fallback-id");
      expect(result.url).toBe("https://example.com/download.pdf");
      expect(result.filename).toBe("fallback.pdf");
    });

    it("should handle URL field priority correctly", () => {
      const webhookAttachment = {
        id: "url-test",
        // Test URL field priority: url > content_url > download_url > media_url > src > href
        href: "https://example.com/href.jpg",
        src: "https://example.com/src.jpg",
        media_url: "https://example.com/media.jpg",
        download_url: "https://example.com/download.jpg",
        content_url: "https://example.com/content.jpg",
        url: "https://example.com/url.jpg",
      };

      const result = processAttachmentData(webhookAttachment);
      expect(result.url).toBe("https://example.com/url.jpg");

      // Test without url field
      delete webhookAttachment.url;
      const result2 = processAttachmentData(webhookAttachment);
      expect(result2.url).toBe("https://example.com/content.jpg");

      // Test without content_url field
      delete webhookAttachment.content_url;
      const result3 = processAttachmentData(webhookAttachment);
      expect(result3.url).toBe("https://example.com/download.jpg");
    });
  });

  describe("Edge Cases", () => {
    it("should handle completely empty attachment", () => {
      const result = processAttachmentData({});

      expect(result).toEqual({
        id: undefined,
        type: undefined,
        url: undefined,
        filename: undefined,
        file_size: undefined,
        mime_type: undefined,
        unavailable: undefined,
      });
    });

    it("should handle null and undefined values", () => {
      const webhookAttachment = {
        id: null,
        type: undefined,
        url: "", // Empty string
        filename: null,
      };

      const result = processAttachmentData(webhookAttachment);

      // The || operator will return the first truthy value, or the last value if all are falsy
      expect(result.id).toBeUndefined(); // null || undefined = undefined
      expect(result.type).toBeUndefined();
      // Empty string is falsy, so || chain returns undefined (the last falsy value)
      expect(result.url).toBeUndefined(); 
      expect(result.filename).toBeUndefined(); // null || undefined = undefined
    });

    it("should handle mixed field types", () => {
      const webhookAttachment = {
        id: "mixed-test",
        file_size: "1024000", // String instead of number
        size: 2048000, // Number
        unavailable: "false", // String instead of boolean
      };

      const result = processAttachmentData(webhookAttachment);

      expect(result.file_size).toBe("1024000"); // Should preserve the first value found
      expect(result.unavailable).toBe("false"); // Should preserve as-is
    });
  });

  describe("LinkedIn Specific Cases", () => {
    it("should handle LinkedIn post attachments", () => {
      const webhookAttachment = {
        id: "linkedin-post-123",
        type: "linkedin_post",
        href: "https://www.linkedin.com/feed/update/activity-123456789",
        name: "Shared LinkedIn Post",
      };

      const result = processAttachmentData(webhookAttachment);

      expect(result).toEqual({
        id: "linkedin-post-123",
        type: "linkedin_post",
        url: "https://www.linkedin.com/feed/update/activity-123456789",
        filename: "Shared LinkedIn Post",
        file_size: undefined,
        mime_type: undefined,
        unavailable: undefined,
      });
    });

    it("should handle video meeting attachments", () => {
      const webhookAttachment = {
        id: "meeting-123",
        type: "video_meeting",
        href: "https://www.linkedin.com/video/meeting/123",
        name: "Team Meeting",
      };

      const result = processAttachmentData(webhookAttachment);

      expect(result.type).toBe("video_meeting");
      expect(result.url).toBe("https://www.linkedin.com/video/meeting/123");
    });
  });
});

describe("Attachment ID Generation", () => {
  it("should generate ID when missing", () => {
    const messageId = "msg-123";
    const attachmentIndex = 0;
    
    const webhookAttachment = {
      type: "img",
      url: "https://example.com/no-id.jpg",
    };

    const result = processAttachmentData(webhookAttachment);
    const generatedId = result.id || `${messageId}_${attachmentIndex}`;

    expect(generatedId).toBe("msg-123_0");
  });
});

describe("Message Type Inference", () => {
  function inferMessageType(messageContent: string | null, attachments: any[]) {
    let inferredMessageType = "text";
    
    if (!messageContent && attachments && attachments.length > 0) {
      const firstAttachment = attachments[0];
      if (firstAttachment?.type === "img") {
        inferredMessageType = "image";
      } else if (firstAttachment?.type === "video") {
        inferredMessageType = "video";
      } else if (firstAttachment?.type === "audio") {
        inferredMessageType = "audio";
      } else {
        inferredMessageType = "attachment";
      }
    }
    
    return inferredMessageType;
  }

  it("should infer image type for image-only messages", () => {
    const messageType = inferMessageType(null, [{ type: "img" }]);
    expect(messageType).toBe("image");
  });

  it("should infer video type for video-only messages", () => {
    const messageType = inferMessageType("", [{ type: "video" }]);
    expect(messageType).toBe("video");
  });

  it("should infer attachment type for other attachment-only messages", () => {
    const messageType = inferMessageType(null, [{ type: "file" }]);
    expect(messageType).toBe("attachment");
  });

  it("should keep text type when message has content", () => {
    const messageType = inferMessageType("Hello world", [{ type: "img" }]);
    expect(messageType).toBe("text");
  });

  it("should handle multiple attachments (use first one)", () => {
    const messageType = inferMessageType(null, [
      { type: "img" },
      { type: "file" },
    ]);
    expect(messageType).toBe("image");
  });
});