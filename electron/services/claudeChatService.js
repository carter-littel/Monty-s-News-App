const Anthropic = require("@anthropic-ai/sdk");
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

// Haiku is the cheapest/fastest tier — same reasoning as picking
// gemini-2.0-flash-lite for this chat sidebar.
const CLAUDE_MODEL = "claude-haiku-4-5";
const CHAT_TIMEOUT_MS = 30000;
const MAX_TOOL_ITERATIONS = 4;

const CLAUDE_TOOLS = [
  {
    name: RSS_TOOL_NAME,
    description: RSS_TOOL_DESCRIPTION,
    input_schema: RSS_TOOL_PARAMETERS,
  },
  {
    name: LIST_TOOL_NAME,
    description: LIST_TOOL_DESCRIPTION,
    input_schema: LIST_TOOL_PARAMETERS,
  },
];

function toClaudeMessages(history, message) {
  const messages = history.map((turn) => ({
    role: turn.role === "assistant" ? "assistant" : "user",
    content: turn.content,
  }));
  messages.push({ role: "user", content: message });
  return messages;
}

function extractText(content) {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

async function sendClaudeMessage({
  apiKey,
  message,
  history = [],
  context,
  toolExecutors = {},
  createClient = (key) => new Anthropic({ apiKey: key, timeout: CHAT_TIMEOUT_MS }),
}) {
  try {
    const client = createClient(apiKey);
    const messages = toClaudeMessages(history, message);
    const system = buildSystemPrompt(context);

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system,
        messages,
        tools: CLAUDE_TOOLS,
      });

      const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");

      if (toolUseBlocks.length === 0) {
        const replyText = extractText(response.content);
        if (!replyText) {
          return { success: false, error: "Empty response from Claude" };
        }
        return {
          success: true,
          message: { role: "assistant", content: replyText },
        };
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const block of toolUseBlocks) {
        const result = await executeTool(toolExecutors, block.name, block.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result.success ? result.message : result.error,
          is_error: !result.success,
        });
      }
      messages.push({ role: "user", content: toolResults });
    }

    return { success: false, error: "Claude made too many tool calls without finishing." };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return { success: false, error: `Claude ${error.status}: ${error.message}` };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown chat error",
    };
  }
}

module.exports = {
  sendClaudeMessage,
  CLAUDE_MODEL,
};
