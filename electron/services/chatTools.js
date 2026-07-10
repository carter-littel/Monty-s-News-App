const { MEMORY_DOMAINS } = require("../ipcValidate");

const RSS_TOOL_NAME = "add_rss_feed";

const RSS_TOOL_DESCRIPTION =
  "Add a new RSS/Atom feed source to the news aggregator so it starts pulling articles from " +
  "it on future refreshes. Call this when the user asks you to add, subscribe to, or track a " +
  "news source or RSS/Atom feed. The URL is validated by actually fetching it before it's " +
  "added — if that fails, you'll get an error back describing why; explain it to the user " +
  "rather than retrying the same URL blindly.";

const RSS_TOOL_PARAMETERS = {
  type: "object",
  properties: {
    url: { type: "string", description: "The RSS or Atom feed URL." },
    name: {
      type: "string",
      description: "A short human-readable name for the source, e.g. the publication name.",
    },
    category: {
      type: "string",
      enum: MEMORY_DOMAINS,
      description: "Which topic domain this source best fits.",
    },
  },
  required: ["url", "name", "category"],
};

const LIST_TOOL_NAME = "list_rss_feeds";

const LIST_TOOL_DESCRIPTION =
  "List the RSS/Atom feed sources currently configured in the news aggregator (both the " +
  "built-in defaults and any added later). Call this before adding a feed if you need to check " +
  "whether it (or something like it) is already present, or whenever the user asks what " +
  "sources are currently being tracked.";

const LIST_TOOL_PARAMETERS = {
  type: "object",
  properties: {
    category: {
      type: "string",
      enum: MEMORY_DOMAINS,
      description: "Optional — only list feeds in this topic domain. Omit to list everything.",
    },
  },
  required: [],
};

async function executeTool(toolExecutors, name, input) {
  const executor = toolExecutors?.[name];

  if (!executor) {
    return { success: false, error: `Unknown tool: ${name}` };
  }

  try {
    return await executor(input);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Tool execution failed",
    };
  }
}

module.exports = {
  RSS_TOOL_NAME,
  RSS_TOOL_DESCRIPTION,
  RSS_TOOL_PARAMETERS,
  LIST_TOOL_NAME,
  LIST_TOOL_DESCRIPTION,
  LIST_TOOL_PARAMETERS,
  executeTool,
};
