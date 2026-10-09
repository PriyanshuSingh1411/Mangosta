/**
 * JSON for a <script type="application/ld+json"> tag. Characters that could
 * end the script tag or start HTML (<, >, &) and the two line separators
 * JavaScript treats as newlines are escaped, so text such as a product name
 * containing "</script>" stays plain data and can't break the page.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replaceAll(String.fromCharCode(0x2028), "\\u2028")
    .replaceAll(String.fromCharCode(0x2029), "\\u2029");
}
