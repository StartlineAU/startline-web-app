// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeRichTextClient } from "@/lib/sanitize-html-client";
import { sanitizeHtml } from "@/lib/sanitize-html";

// The listing editor and its preview write an organiser's description into
// the page for admins and co-members. These payloads must come out inert.
describe("sanitizeRichTextClient", () => {
  it("keeps the allowed rich-text subset unchanged", () => {
    const html =
      "<p><strong>Bold</strong> and <em>italic</em> and <u>underlined</u></p>" +
      "<h3>Heading</h3><h4>Sub</h4><ul><li>One</li></ul><ol><li>Two</li></ol><p>a<br>b</p>";
    expect(sanitizeRichTextClient(html)).toBe(html);
  });

  it("drops event-handler payloads entirely", () => {
    const out = sanitizeRichTextClient(
      '<img src=x onerror="alert(1)"><p onclick="alert(2)">Text</p><svg onload=alert(3)><circle/></svg>',
    );
    expect(out).toBe("<p>Text</p>");
  });

  it("removes scripts, styles and their contents", () => {
    expect(sanitizeRichTextClient('<p>Safe</p><script>alert("x")</script><style>p{}</style>')).toBe("<p>Safe</p>");
  });

  it("keeps the text of disallowed wrappers but not the wrapper or its attributes", () => {
    expect(
      sanitizeRichTextClient('<div style="x"><a href="javascript:alert(1)">there</a></div>'),
    ).toBe("there");
  });

  it("does not let entity-encoded markup become live markup", () => {
    const out = sanitizeRichTextClient("<p>&lt;img src=x onerror=alert(1)&gt;</p>");
    expect(out).toBe("<p>&lt;img src=x onerror=alert(1)&gt;</p>");
  });

  it("neutralises malformed and nested script tags", () => {
    const out = sanitizeRichTextClient("<scr<script>ipt>alert(1)</scr</script>ipt>");
    expect(out).not.toMatch(/<(?!\/?(p|br|strong|b|em|i|u|h3|h4|ul|ol|li)\b)[a-z]/i);
  });

  it("drops comments, iframes and template content", () => {
    expect(
      sanitizeRichTextClient("<!-- x --><iframe src=//evil></iframe><template><img src=x onerror=alert(1)></template><p>ok</p>"),
    ).toBe("<p>ok</p>");
  });

  it("returns an empty string for empty input", () => {
    expect(sanitizeRichTextClient("")).toBe("");
    expect(sanitizeRichTextClient(null)).toBe("");
  });

  it("agrees with the server sanitizer on what the editor emits", () => {
    const html = "<p><b>Race</b> <i>day</i></p><ul><li>Bring <strong>water</strong></li></ul>";
    expect(sanitizeRichTextClient(html)).toBe(sanitizeHtml(html));
  });
});
