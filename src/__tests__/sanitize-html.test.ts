import { describe, expect, it } from "vitest";
import { sanitizeHtml, stripHtml } from "@/lib/sanitize-html";

describe("sanitizeHtml", () => {
  it("keeps the allowed rich-text subset", () => {
    const html =
      "<p><strong>Bold</strong> and <em>italic</em> and <u>underlined</u></p>" +
      "<h3>Heading</h3><ul><li>One</li></ul>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("removes script elements and their contents", () => {
    expect(sanitizeHtml('<p>Safe</p><script>alert("xss")</script>')).toBe("<p>Safe</p>");
  });

  it("removes event handler attributes", () => {
    expect(sanitizeHtml('<p onclick="alert(1)">Text</p>')).toBe("<p>Text</p>");
  });

  it("drops links and images even when they carry script payloads", () => {
    expect(
      sanitizeHtml('<p>Hello <a href="javascript:alert(1)">there</a><img src=x onerror=alert(1)></p>'),
    ).toBe("<p>Hello there</p>");
  });

  it("removes nested or malformed script tags", () => {
    const result = sanitizeHtml("<scr<script>ipt>alert(1)</scr</script>ipt>");
    expect(result).not.toContain("<script");
    expect(result).not.toMatch(/<[^>]*>/);
  });

  it("removes embedded frames and their contents", () => {
    expect(sanitizeHtml('<iframe src="https://example.com"></iframe><p>Safe</p>')).toBe(
      "<p>Safe</p>",
    );
  });
});

describe("stripHtml", () => {
  it("flattens tags while keeping entity-escaped text inert", () => {
    expect(stripHtml("<p>Rock &amp; Roll</p>")).toBe("Rock &amp; Roll");
  });

  it("drops script contents", () => {
    expect(stripHtml("<p>Hello</p><script>alert(1)</script>")).toBe("Hello");
  });

  it("collapses whitespace", () => {
    expect(stripHtml("<p>Hello   <strong>world</strong></p>")).toBe("Hello world");
  });
});
