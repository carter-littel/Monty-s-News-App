// flash-lite trades a bit of quality for a meaningfully higher free-tier
// quota than the full flash model — worth it for a chat sidebar.
const GEMINI_MODEL = "gemini-2.0-flash-lite";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const CHAT_TIMEOUT_MS = 30000;
const MAX_TOOL_ITERATIONS = 4;

const { buildSystemPrompt } = require("./chatPromptShared");
const {
  RSS_TOOL_NAME,
  RSS_TOOL_DESCRIPTION,
  RSS_TOOL_PARAMETERS,
  LIST_TOOL_NAME,
  LIST_TOOL_DESCRIPTION,
  LIST_TOOL_PARAMETERS,
  executeTool,
} = require("./chatTools");
const { sendClaudeMessage } = require("./claudeChatService");
const { sendOpenAIMessage } = require("./openaiChatService");

const PROVIDER_LABELS = { gemini: "Gemini", claude: "Claude", openai: "ChatGPT" };
const VALID_PROVIDERS = new Set(["gemini", "claude", "openai"]);

const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: RSS_TOOL_NAME,
        description: RSS_TOOL_DESCRIPTION,
        parameters: RSS_TOOL_PARAMETERS,
      },
      {
        name: LIST_TOOL_NAME,
        description: LIST_TOOL_DESCRIPTION,
        parameters: LIST_TOOL_PARAMETERS,
      },
    ],
  },
];

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

function createChatService({
  getApiKey,
  fetchImpl = fetch,
  claudeSender = sendClaudeMessage,
  openaiSender = sendOpenAIMessage,
  toolExecutors = {},
}) {
  async function sendGeminiMessage({ apiKey, message, history = [], context }) {
    const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const contents = toGeminiContents(history, message);
    const systemInstruction = { parts: [{ text: buildSystemPrompt(context) }] };

    try {
      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
        const body = {
          contents,
          systemInstruction,
          tools: GEMINI_TOOLS,
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        };

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
        const parts = payload?.candidates?.[0]?.content?.parts;
        const functionCallParts = Array.isArray(parts)
          ? parts.filter((part) => part.functionCall)
          : [];

        if (functionCallParts.length === 0) {
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
        }

        contents.push({ role: "model", parts });

        const functionResponseParts = [];
        for (const part of functionCallParts) {
          const result = await executeTool(
            toolExecutors,
            part.functionCall.name,
            part.functionCall.args ?? {},
          );
          functionResponseParts.push({
            functionResponse: {
              name: part.functionCall.name,
              response: { result: result.success ? result.message : result.error },
            },
          });
        }
        contents.push({ role: "user", parts: functionResponseParts });
      }

      return { success: false, error: "Gemini made too many tool calls without finishing." };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown chat error",
      };
    }
  }

  async function sendMessage({ provider, message, history = [], context } = {}) {
    if (!message) {
      return { success: false, error: "Message is required" };
    }

    const resolvedProvider = VALID_PROVIDERS.has(provider) ? provider : "gemini";
    const apiKey = getApiKey(resolvedProvider);

    if (!apiKey) {
      return {
        success: false,
        error: `No ${PROVIDER_LABELS[resolvedProvider]} API key configured. Add one in Settings.`,
      };
    }

    if (resolvedProvider === "claude") {
      return claudeSender({ apiKey, message, history, context, toolExecutors });
    }

    if (resolvedProvider === "openai") {
      return openaiSender({ apiKey, message, history, context, toolExecutors });
    }

    return sendGeminiMessage({ apiKey, message, history, context });
  }

  return { sendMessage };
}

module.exports = {
  createChatService,
};
