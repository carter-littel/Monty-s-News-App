// @ts-nocheck
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { sendClaudeMessage } = require("./services/claudeChatService");

function fakeClient(create) {
  return { messages: { create } };
}

describe("sendClaudeMessage", () => {
  it("returns plain text when no tool is called", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Hello there." }],
    });

    const result = await sendClaudeMessage({
      apiKey: "key",
      message: "hi",
      history: [],
      createClient: () => fakeClient(create),
    });

    expect(result).toEqual({
      success: true,
      message: { role: "assistant", content: "Hello there." },
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("returns an error for an empty response", async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "" }] });

    const result = await sendClaudeMessage({
      apiKey: "key",
      message: "hi",
      history: [],
      createClient: () => fakeClient(create),
    });

    expect(result).toEqual({ success: false, error: "Empty response from Claude" });
  });

  it("executes a tool call then returns the follow-up text", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "tool_1",
            name: "add_rss_feed",
            input: { url: "https://example.com/feed", name: "Example", category: "General" },
          },
        ],
      })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "Added it." }] });
    const toolExecutor = vi.fn().mockResolvedValue({ success: true, message: "Added." });

    const result = await sendClaudeMessage({
      apiKey: "key",
      message: "add example.com's feed",
      history: [],
      toolExecutors: { add_rss_feed: toolExecutor },
      createClient: () => fakeClient(create),
    });

    expect(toolExecutor).toHaveBeenCalledWith({
      url: "https://example.com/feed",
      name: "Example",
      category: "General",
    });
    expect(create).toHaveBeenCalledTimes(2);

    const secondCallArgs = create.mock.calls[1][0];
    expect(secondCallArgs.messages.at(-1)).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "tool_1", content: "Added.", is_error: false }],
    });
    expect(result).toEqual({ success: true, message: { role: "assistant", content: "Added it." } });
  });

  it("surfaces a failed tool result to the model with is_error true", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "tool_1", name: "add_rss_feed", input: { url: "bad" } }],
      })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "That URL didn't work." }] });
    const toolExecutor = vi.fn().mockResolvedValue({ success: false, error: "Not a valid URL" });

    const result = await sendClaudeMessage({
      apiKey: "key",
      message: "add bad",
      history: [],
      toolExecutors: { add_rss_feed: toolExecutor },
      createClient: () => fakeClient(create),
    });

    const secondCallArgs = create.mock.calls[1][0];
    expect(secondCallArgs.messages.at(-1).content[0]).toEqual({
      type: "tool_result",
      tool_use_id: "tool_1",
      content: "Not a valid URL",
      is_error: true,
    });
    expect(result).toEqual({
      success: true,
      message: { role: "assistant", content: "That URL didn't work." },
    });
  });

  it("gives up after too many tool-call iterations", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "tool_use", id: "tool_1", name: "add_rss_feed", input: {} }],
    });
    const toolExecutor = vi.fn().mockResolvedValue({ success: true, message: "Added." });

    const result = await sendClaudeMessage({
      apiKey: "key",
      message: "add lots",
      history: [],
      toolExecutors: { add_rss_feed: toolExecutor },
      createClient: () => fakeClient(create),
    });

    expect(result).toEqual({
      success: false,
      error: "Claude made too many tool calls without finishing.",
    });
    expect(create).toHaveBeenCalledTimes(4);
  });

  it("returns a typed error when the client throws", async () => {
    const create = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await sendClaudeMessage({
      apiKey: "key",
      message: "hi",
      history: [],
      createClient: () => fakeClient(create),
    });

    expect(result).toEqual({ success: false, error: "network down" });
  });

  it("declares both the add and list tools to the API", async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] });

    await sendClaudeMessage({
      apiKey: "key",
      message: "hi",
      history: [],
      createClient: () => fakeClient(create),
    });

    const toolNames = create.mock.calls[0][0].tools.map((tool) => tool.name);
    expect(toolNames).toEqual(["add_rss_feed", "list_rss_feeds"]);
  });

  it("can call list_rss_feeds and return the follow-up text", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "tool_1", name: "list_rss_feeds", input: {} }],
      })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "Here's what's configured." }] });
    const listExecutor = vi.fn().mockResolvedValue({ success: true, message: "TechCrunch: https://..." });

    const result = await sendClaudeMessage({
      apiKey: "key",
      message: "what feeds do we have?",
      history: [],
      toolExecutors: { list_rss_feeds: listExecutor },
      createClient: () => fakeClient(create),
    });

    expect(listExecutor).toHaveBeenCalledWith({});
    expect(result).toEqual({
      success: true,
      message: { role: "assistant", content: "Here's what's configured." },
    });
  });
});
