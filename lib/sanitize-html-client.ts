/**
 * Browser-side twin of `sanitizeHtml` in lib/sanitize-html.ts, for client
 * components that put organiser rich text into the page (the listing editor
 * and its preview). `sanitize-html` is a Node library, so it is not used here.
 *
 * The input is parsed into an inert document (DOMParser runs no scripts and
 * loads no resources), then a fresh tree is built from it: allow-listed tags
 * are re-created by name with no attributes, text is copied as text, and
 * everything else is dropped, keeping the text of unknown wrappers but not of
 * script-like elements. Because nothing is copied from the parsed nodes except
 * a tag name from the allow-list and text, no attribute or handler can survive.
 *
 * Keep ALLOWED_TAGS in step with RICH_TEXT in lib/sanitize-html.ts.
 */

const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "h3", "h4", "ul", "ol", "li"]);

// Elements whose text content is code or markup, not prose. Dropped whole.
const DROP_WITH_CONTENT = new Set([
  "script", "style", "template", "noscript", "iframe", "object", "embed",
  "svg", "math", "textarea", "select", "option", "title",
]);

function copyChildren(from: Node, to: Node, doc: Document): void {
  from.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      to.appendChild(doc.createTextNode(child.textContent ?? ""));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return; // comments, CDATA, PIs

    const tag = (child as Element).localName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) return;

    if (ALLOWED_TAGS.has(tag)) {
      const clean = doc.createElement(tag);
      copyChildren(child, clean, doc);
      to.appendChild(clean);
    } else {
      // Unknown wrapper (div, span, a, …): keep what it says, not the element.
      copyChildren(child, to, doc);
    }
  });
}

export function sanitizeRichTextClient(html: string | null | undefined): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    // Never render unsanitised markup during SSR: fall back to nothing and
    // let the client fill it in.
    return "";
  }
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const out = document.implementation.createHTMLDocument("");
  const root = out.createElement("div");
  copyChildren(parsed.body, root, out);
  return root.innerHTML;
}
