// @ts-nocheck
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createChatService } = require("./services/chatService");

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("chatService.sendMessage", () => {
  it("returns an error without calling fetch when no API key is configured", async () => {
    const fetchImpl = vi.fn();
    const service = createChatService({ getApiKey: () => "", fetchImpl });

    const result = await service.sendMessage({ message: "hi", history: [] });

    expect(result).toEqual({
      success: false,
      error: "No Gemini API key configured. Add one in Settings.",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns an error when message is missing", async () => {
    const fetchImpl = vi.fn();
    const service = createChatService({ getApiKey: () => "key", fetchImpl });

    const result = await service.sendMessage({ message: "", history: [] });

    expect(result).toEqual({ success: false, error: "Message is required" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends history and context, and returns the assistant reply on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [
          { content: { parts: [{ text: "Here is a summary." }], role: "model" } },
        ],
      }),
    );
    const service = createChatService({ getApiKey: () => "test-key", fetchImpl });

    const result = await service.sendMessage({
      message: "Summarize the top story",
      history: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello" }],
      context: { articles: [{ headline: "AI chips advance", summary: "New packaging." }] },
    });

    expect(result).toEqual({
      success: true,
      message: { role: "assistant", content: "Here is a summary." },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain("key=test-key");
    const body = JSON.parse(options.body);
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Hi" }] },
      { role: "model", parts: [{ text: "Hello" }] },
      { role: "user", parts: [{ text: "Summarize the top story" }] },
    ]);
    expect(body.systemInstruction.parts[0].text).toContain("AI chips advance");
  });

  it("returns a typed error when the API responds with a non-OK status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ error: "bad request" }, { ok: false, status: 400 }),
    );
    const service = createChatService({ getApiKey: () => "test-key", fetchImpl });

    const result = await service.sendMessage({ message: "hi", history: [] });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Gemini 400");
  });

  it("returns a typed error when fetch throws", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const service = createChatService({ getApiKey: () => "test-key", fetchImpl });

    const result = await service.sendMessage({ message: "hi", history: [] });

    expect(result).toEqual({ success: false, error: "network down" });
  });

  it("returns a typed error when the response has no reply text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [{ text: "" }] } }] }),
    );
    const service = createChatService({ getApiKey: () => "test-key", fetchImpl });

    const result = await service.sendMessage({ message: "hi", history: [] });

    expect(result).toEqual({ success: false, error: "Empty response from Gemini" });
  });

  it("surfaces a block reason when the prompt was blocked", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ candidates: [], promptFeedback: { blockReason: "SAFETY" } }),
    );
    const service = createChatService({ getApiKey: () => "test-key", fetchImpl });

    const result = await service.sendMessage({ message: "hi", history: [] });

    expect(result).toEqual({ success: false, error: "Response blocked: SAFETY" });
  });

  it("executes a tool call and sends the function response back to finish the turn", async () => {
    const functionCallResponse = jsonResponse({
      candidates: [
        {
          content: {
            role: "model",
            parts: [
              {
                functionCall: {
                  name: "add_rss_feed",
                  args: { url: "https://example.com/feed", name: "Example", category: "General" },
                },
              },
            ],
          },
        },
      ],
    });
    const finalResponse = jsonResponse({
      candidates: [{ content: { parts: [{ text: "Added Example's feed." }] } }],
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(functionCallResponse)
      .mockResolvedValueOnce(finalResponse);

    const toolExecutor = vi.fn().mockResolvedValue({ success: true, message: "Added." });
    const service = createChatService({
      getApiKey: () => "test-key",
      fetchImpl,
      toolExecutors: { add_rss_feed: toolExecutor },
    });

    const result = await service.sendMessage({ message: "add example.com's feed", history: [] });

    expect(toolExecutor).toHaveBeenCalledWith({
      url: "https://example.com/feed",
      name: "Example",
      category: "General",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const secondBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(secondBody.contents.at(-1)).toEqual({
      role: "user",
      parts: [{ functionResponse: { name: "add_rss_feed", response: { result: "Added." } } }],
    });

    expect(result).toEqual({
      success: true,
      message: { role: "assistant", content: "Added Example's feed." },
    });
  });

  it("gives up after too many tool-call iterations", async () => {
    const functionCallResponse = jsonResponse({
      candidates: [
        {
          content: {
            parts: [{ functionCall: { name: "add_rss_feed", args: { url: "https://x.com/feed" } } }],
          },
        },
      ],
    });
    const fetchImpl = vi.fn().mockResolvedValue(functionCallResponse);
    const toolExecutor = vi.fn().mockResolvedValue({ success: true, message: "Added." });
    const service = createChatService({
      getApiKey: () => "test-key",
      fetchImpl,
      toolExecutors: { add_rss_feed: toolExecutor },
    });

    const result = await service.sendMessage({ message: "add feeds forever", history: [] });

    expect(result).toEqual({
      success: false,
      error: "Gemini made too many tool calls without finishing.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("declares both the add and list tools to the API", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
    );
    const service = createChatService({ getApiKey: () => "test-key", fetchImpl });

    await service.sendMessage({ message: "hi", history: [] });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const names = body.tools[0].functionDeclarations.map((decl) => decl.name);
    expect(names).toEqual(["add_rss_feed", "list_rss_feeds"]);
  });
});

describe("chatService.sendMessage provider dispatch", () => {
  it("dispatches to the claude sender when provider is claude", async () => {
    const claudeSender = vi.fn().mockResolvedValue({
      success: true,
      message: { role: "assistant", content: "hi from claude" },
    });
    const service = createChatService({ getApiKey: () => "key", claudeSender });

    const result = await service.sendMessage({
      provider: "claude",
      message: "hi",
      history: [],
      context: { articles: [] },
    });

    expect(claudeSender).toHaveBeenCalledWith({
      apiKey: "key",
      message: "hi",
      history: [],
      context: { articles: [] },
      toolExecutors: {},
    });
    expect(result).toEqual({ success: true, message: { role: "assistant", content: "hi from claude" } });
  });

  it("dispatches to the openai sender when provider is openai", async () => {
    const openaiSender = vi.fn().mockResolvedValue({
      success: true,
      message: { role: "assistant", content: "hi from chatgpt" },
    });
    const service = createChatService({ getApiKey: () => "key", openaiSender });

    const result = await service.sendMessage({ provider: "openai", message: "hi", history: [] });

    expect(openaiSender).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, message: { role: "assistant", content: "hi from chatgpt" } });
  });

  it("defaults to gemini when provider is missing or invalid", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [{ text: "gemini reply" }] } }] }),
    );
    const claudeSender = vi.fn();
    const openaiSender = vi.fn();
    const service = createChatService({ getApiKey: () => "key", fetchImpl, claudeSender, openaiSender });

    const result = await service.sendMessage({ provider: "not-a-real-provider", message: "hi" });

    expect(claudeSender).not.toHaveBeenCalled();
    expect(openaiSender).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, message: { role: "assistant", content: "gemini reply" } });
  });

  it("reports a provider-specific error when the key is missing", async () => {
    const getApiKey = (provider) => (provider === "claude" ? "" : "key");
    const service = createChatService({ getApiKey });

    const claudeResult = await service.sendMessage({ provider: "claude", message: "hi" });
    expect(claudeResult).toEqual({
      success: false,
      error: "No Claude API key configured. Add one in Settings.",
    });

    const openaiSender = vi.fn();
    const service2 = createChatService({
      getApiKey: (provider) => (provider === "openai" ? "" : "key"),
      openaiSender,
    });
    const openaiResult = await service2.sendMessage({ provider: "openai", message: "hi" });
    expect(openaiResult).toEqual({
      success: false,
      error: "No ChatGPT API key configured. Add one in Settings.",
    });
    expect(openaiSender).not.toHaveBeenCalled();
  });
});
