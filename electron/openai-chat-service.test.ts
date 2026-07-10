// @ts-nocheck
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { sendOpenAIMessage } = require("./services/openaiChatService");

function fakeClient(create) {
  return { chat: { completions: { create } } };
}

function chatResponse(message) {
  return { choices: [{ message }] };
}

describe("sendOpenAIMessage", () => {
  it("returns plain text when no tool is called", async () => {
    const create = vi.fn().mockResolvedValue(chatResponse({ role: "assistant", content: "Hello there." }));

    const result = await sendOpenAIMessage({
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
    const create = vi.fn().mockResolvedValue(chatResponse({ role: "assistant", content: "" }));

    const result = await sendOpenAIMessage({
      apiKey: "key",
      message: "hi",
      history: [],
      createClient: () => fakeClient(create),
    });

    expect(result).toEqual({ success: false, error: "Empty response from ChatGPT" });
  });

  it("executes a tool call then returns the follow-up text", async () => {
    const toolCallMessage = {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: {
            name: "add_rss_feed",
            arguments: JSON.stringify({
              url: "https://example.com/feed",
              name: "Example",
              category: "General",
            }),
          },
        },
      ],
    };
    const create = vi
      .fn()
      .mockResolvedValueOnce(chatResponse(toolCallMessage))
      .mockResolvedValueOnce(chatResponse({ role: "assistant", content: "Added it." }));
    const toolExecutor = vi.fn().mockResolvedValue({ success: true, message: "Added." });

    const result = await sendOpenAIMessage({
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
      role: "tool",
      tool_call_id: "call_1",
      content: "Added.",
    });
    expect(result).toEqual({ success: true, message: { role: "assistant", content: "Added it." } });
  });

  it("surfaces a failed tool result back to the model", async () => {
    const toolCallMessage = {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "add_rss_feed", arguments: JSON.stringify({ url: "bad" }) },
        },
      ],
    };
    const create = vi
      .fn()
      .mockResolvedValueOnce(chatResponse(toolCallMessage))
      .mockResolvedValueOnce(chatResponse({ role: "assistant", content: "That URL didn't work." }));
    const toolExecutor = vi.fn().mockResolvedValue({ success: false, error: "Not a valid URL" });

    const result = await sendOpenAIMessage({
      apiKey: "key",
      message: "add bad",
      history: [],
      toolExecutors: { add_rss_feed: toolExecutor },
      createClient: () => fakeClient(create),
    });

    const secondCallArgs = create.mock.calls[1][0];
    expect(secondCallArgs.messages.at(-1)).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: "Error: Not a valid URL",
    });
    expect(result).toEqual({
      success: true,
      message: { role: "assistant", content: "That URL didn't work." },
    });
  });

  it("gives up after too many tool-call iterations", async () => {
    const toolCallMessage = {
      role: "assistant",
      content: null,
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "add_rss_feed", arguments: "{}" } },
      ],
    };
    const create = vi.fn().mockResolvedValue(chatResponse(toolCallMessage));
    const toolExecutor = vi.fn().mockResolvedValue({ success: true, message: "Added." });

    const result = await sendOpenAIMessage({
      apiKey: "key",
      message: "add lots",
      history: [],
      toolExecutors: { add_rss_feed: toolExecutor },
      createClient: () => fakeClient(create),
    });

    expect(result).toEqual({
      success: false,
      error: "ChatGPT made too many tool calls without finishing.",
    });
    expect(create).toHaveBeenCalledTimes(4);
  });

  it("returns a typed error when the client throws", async () => {
    const create = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await sendOpenAIMessage({
      apiKey: "key",
      message: "hi",
      history: [],
      createClient: () => fakeClient(create),
    });

    expect(result).toEqual({ success: false, error: "network down" });
  });

  it("declares both the add and list tools to the API", async () => {
    const create = vi.fn().mockResolvedValue(chatResponse({ role: "assistant", content: "ok" }));

    await sendOpenAIMessage({
      apiKey: "key",
      message: "hi",
      history: [],
      createClient: () => fakeClient(create),
    });

    const toolNames = create.mock.calls[0][0].tools.map((tool) => tool.function.name);
    expect(toolNames).toEqual(["add_rss_feed", "list_rss_feeds"]);
  });
});
