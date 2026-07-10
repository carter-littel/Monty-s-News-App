function buildSystemPrompt(context) {
  const lines = [
    "You are an assistant embedded in a local tech intelligence dashboard.",
    "Answer questions about the news currently visible to the user.",
    "Be concise. If the visible articles don't cover something, say so instead of guessing.",
    "If the user asks you to add, subscribe to, or track a news source or RSS/Atom feed, use the add_rss_feed tool.",
    "If the user asks what sources are already configured, or gives you URLs and asks which are new, use list_rss_feeds first — don't guess or blindly try to add without checking.",
  ];

  if (context?.articles?.length) {
    lines.push("", "Articles currently on screen:");
    for (const article of context.articles) {
      lines.push(`- ${article.headline}${article.summary ? `: ${article.summary}` : ""}`);
    }
  }

  return lines.join("\n");
}

module.exports = {
  buildSystemPrompt,
};
