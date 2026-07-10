const OpenAI = require("openai");
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

const OPENAI_MODEL = "gpt-4o-mini";
const CHAT_TIMEOUT_MS = 30000;
const MAX_TOOL_ITERATIONS = 4;

const OPENAI_TOOLS = [
  {
    type: "function",
    function: {
      name: RSS_TOOL_NAME,
      description: RSS_TOOL_DESCRIPTION,
      parameters: RSS_TOOL_PARAMETERS,
    },
  },
  {
    type: "function",
    function: {
      name: LIST_TOOL_NAME,
      description: LIST_TOOL_DESCRIPTION,
      parameters: LIST_TOOL_PARAMETERS,
    },
  },
];

function toOpenAIMessages(history, message, context) {
  const messages = [{ role: "system", content: buildSystemPrompt(context) }];
  for (const turn of history) {
    messages.push({ role: turn.role === "assistant" ? "assistant" : "user", content: turn.content });
  }
  messages.push({ role: "user", content: message });
  return messages;
}

function parseToolArguments(rawArguments) {
  try {
    return JSON.parse(rawArguments ?? "{}");
  } catch {
    return {};
  }
}

async function sendOpenAIMessage({
  apiKey,
  message,
  history = [],
  context,
  toolExecutors = {},
  createClient = (key) => new OpenAI({ apiKey: key, timeout: CHAT_TIMEOUT_MS }),
}) {
  try {
    const client = createClient(apiKey);
    const messages = toOpenAIMessages(history, message, context);

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      const response = await client.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 1024,
        messages,
        tools: OPENAI_TOOLS,
      });

      const responseMessage = response.choices?.[0]?.message;
      const toolCalls = responseMessage?.tool_calls ?? [];

      if (toolCalls.length === 0) {
        const replyText = (responseMessage?.content ?? "").trim();
        if (!replyText) {
          return { success: false, error: "Empty response from ChatGPT" };
        }
        return {
          success: true,
          message: { role: "assistant", content: replyText },
        };
      }

      messages.push(responseMessage);

      for (const call of toolCalls) {
        const input = parseToolArguments(call.function?.arguments);
        const result = await executeTool(toolExecutors, call.function?.name, input);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result.success ? result.message : `Error: ${result.error}`,
        });
      }
    }

    return { success: false, error: "ChatGPT made too many tool calls without finishing." };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      return { success: false, error: `ChatGPT ${error.status}: ${error.message}` };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown chat error",
    };
  }
}

module.exports = {
  sendOpenAIMessage,
  OPENAI_MODEL,
};
