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
});
