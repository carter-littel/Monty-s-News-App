import { Article } from "@/lib/types";

export const RECALL_IMPORT_URL = "https://app.recall.it/items";

const BOOKMARK_DOC_HEADER =
  '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n' +
  '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n' +
  "<TITLE>Bookmarks</TITLE>\n" +
  "<H1>Bookmarks</H1>\n";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toUnixSeconds(value: string | undefined): number {
  if (!value) return Math.floor(Date.now() / 1000);
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return Math.floor(Date.now() / 1000);
  return Math.floor(ms / 1000);
}

export function buildBookmarksHtml(articles: Article[], now: Date = new Date()): string {
  const exportable = articles.filter((article) => Boolean(article.url));
  const folderName = `news_agg — ${now.toISOString().slice(0, 10)}`;
  const folderTimestamp = Math.floor(now.getTime() / 1000);

  const lines: string[] = [BOOKMARK_DOC_HEADER, "<DL><p>"];
  lines.push(
    `    <DT><H3 ADD_DATE="${folderTimestamp}" LAST_MODIFIED="${folderTimestamp}">${escapeHtml(
      folderName,
    )}</H3>`,
  );
  lines.push("    <DL><p>");

  for (const article of exportable) {
    const addDate = toUnixSeconds(article.processed_at || article.date);
    const tags = (article.tags ?? []).map((tag) => tag.replace(/,/g, "")).join(",");
    const href = escapeHtml(article.url as string);
    const title = escapeHtml(article.headline);
    const tagsAttr = tags ? ` TAGS="${escapeHtml(tags)}"` : "";
    lines.push(`        <DT><A HREF="${href}" ADD_DATE="${addDate}"${tagsAttr}>${title}</A>`);
  }

  lines.push("    </DL><p>");
  lines.push("</DL><p>");

  return `${lines.join("\n")}\n`;
}

export function buildExportFilename(now: Date = new Date()): string {
  return `news_agg-recall-${now.toISOString().slice(0, 10)}.html`;
}
