import { describe, expect, it } from "vitest";
import { readOpenAiChatResponse } from "../../api/orbitx/ai-stream.js";

function streamResponse(chunks) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

describe("OrbitX AI NVIDIA stream parser", () => {
  it("emits live content and reconstructs the final assistant message", async () => {
    const emitted = [];
    const response = streamResponse([
      'data: {"choices":[{"delta":{"role":"assistant","content":"Orbit"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"X live"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);

    const message = await readOpenAiChatResponse(response, {
      onContent: (chunk) => emitted.push(chunk),
    });

    expect(emitted).toEqual(["Orbit", "X live"]);
    expect(message.content).toBe("OrbitX live");
    expect(message.tool_calls).toEqual([]);
  });

  it("reassembles fragmented OpenAI tool-call deltas", async () => {
    const response = streamResponse([
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"orbitx_","arguments":"{\\"q\\":"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"search","arguments":"\\"SOL\\"}"}}]}}]}\n\n',
      "data: [DONE]\n\n",
    ]);

    const message = await readOpenAiChatResponse(response);

    expect(message.tool_calls).toHaveLength(1);
    expect(message.tool_calls[0].id).toBe("call_1");
    expect(message.tool_calls[0].function.name).toBe("orbitx_search");
    expect(message.tool_calls[0].function.arguments).toBe('{"q":"SOL"}');
  });

  it("accepts providers that fall back to a normal JSON response", async () => {
    const emitted = [];
    const response = new Response(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: "Ready", tool_calls: [] } }],
      }),
      { headers: { "Content-Type": "application/json" } },
    );

    const message = await readOpenAiChatResponse(response, {
      onContent: (chunk) => emitted.push(chunk),
    });

    expect(message.content).toBe("Ready");
    expect(emitted).toEqual(["Ready"]);
  });
});
