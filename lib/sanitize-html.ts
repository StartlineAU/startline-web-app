import sanitize from "sanitize-html";

/**
 * Allow-list sanitizer for organiser-authored rich text (bold/italic/underline,
 * h3/h4, paragraphs and bullet lists from the listing wizard).
 *
 * The editor only emits that small subset (components/ui/RichTextEditor.tsx),
 * so everything else is discarded: links, images, inline styles, event handlers
 * and embedded elements. Delegating to sanitize-html instead of stripping tags
 * with regular expressions means malformed or nested payloads cannot slip a
 * tag through.
 */
const RICH_TEXT: sanitize.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "h3", "h4", "ul", "ol", "li"],
  allowedAttributes: {},
  disallowedTagsMode: "discard",
};

export function sanitizeHtml(html: string): string {
  return sanitize(html, RICH_TEXT);
}

/** Flatten rich text to plain text for previews and metadata descriptions. */
export function stripHtml(html: string): string {
  return sanitize(html, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
