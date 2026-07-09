// flash-lite trades a bit of quality for a meaningfully higher free-tier
// quota than the full flash model — worth it for a chat sidebar.
const GEMINI_MODEL = "gemini-2.0-flash-lite";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const CHAT_TIMEOUT_MS = 30000;

function buildSystemPrompt(context) {
  const lines = [
    "You are an assistant embedded in a local tech intelligence dashboard.",
    "Answer questions about the news currently visible to the user.",
    "Be concise. If the visible articles don't cover something, say so instead of guessing.",
  ];

  if (context?.articles?.length) {
    lines.push("", "Articles currently on screen:");
    for (const article of context.articles) {
      lines.push(`- ${article.headline}${article.summary ? `: ${article.summary}` : ""}`);
    }
  }

  return lines.join("\n");
}

function toGeminiContents(history, message) {
  const contents = history.map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));
  contents.push({ role: "user", parts: [{ text: message }] });
  return contents;
}

function extractReplyText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function createChatService({ getApiKey, fetchImpl = fetch }) {
  async function sendMessage({ message, history = [], context } = {}) {
    if (!message) {
      return { success: false, error: "Message is required" };
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: "No Gemini API key configured. Add one in Settings.",
      };
    }

    const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: toGeminiContents(history, message),
      systemInstruction: { parts: [{ text: buildSystemPrompt(context) }] },
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    };

    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          success: false,
          error: `Gemini ${response.status}: ${text.slice(0, 200) || "request failed"}`,
        };
      }

      const payload = await response.json();
      const replyText = extractReplyText(payload);

      if (!replyText) {
        const blockReason = payload?.promptFeedback?.blockReason;
        return {
          success: false,
          error: blockReason ? `Response blocked: ${blockReason}` : "Empty response from Gemini",
        };
      }

      return {
        success: true,
        message: { role: "assistant", content: replyText },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown chat error",
      };
    }
  }

  return { sendMessage };
}

module.exports = {
  createChatService,
};
