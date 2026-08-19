function contentText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("");
}

function mergeToolCall(target, delta) {
  const index = Number.isInteger(delta?.index) ? delta.index : target.length;
  const existing = target[index] || {
    id: "",
    type: "function",
    function: { name: "", arguments: "" },
  };
  target[index] = {
    id: `${existing.id}${typeof delta?.id === "string" ? delta.id : ""}`,
    type: delta?.type || existing.type || "function",
    function: {
      name: `${existing.function.name}${
        typeof delta?.function?.name === "string" ? delta.function.name : ""
      }`,
      arguments: `${existing.function.arguments}${
        typeof delta?.function?.arguments === "string"
          ? delta.function.arguments
          : ""
      }`,
    },
  };
}

function messageFromJson(payload) {
  const message = payload?.choices?.[0]?.message;
  if (!message || typeof message !== "object") return null;
  return {
    ...message,
    content: contentText(message.content) || null,
    tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
  };
}

/**
 * Consume an OpenAI-compatible chat response. NVIDIA NIM normally returns SSE
 * when stream=true, but the JSON fallback keeps the route compatible with
 * models or gateways that ignore streaming.
 */
export async function readOpenAiChatResponse(response, { onContent } = {}) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!response.body || contentType.includes("application/json")) {
    const payload = await response.json();
    const message = messageFromJson(payload);
    if (!message) throw new Error("AI provider returned no assistant message");
    if (message.content && onContent) onContent(message.content);
    return message;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const toolCalls = [];
  let content = "";
  let buffer = "";

  const consumeLine = (rawLine) => {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;

    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    const choice = payload?.choices?.[0];
    const delta = choice?.delta || choice?.message;
    if (!delta || typeof delta !== "object") return;

    const nextContent = contentText(delta.content);
    if (nextContent) {
      content += nextContent;
      if (onContent) onContent(nextContent);
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const toolCall of delta.tool_calls) mergeToolCall(toolCalls, toolCall);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      consumeLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
    if (done) break;
  }
  if (buffer.trim()) consumeLine(buffer);

  return {
    role: "assistant",
    content: content || null,
    tool_calls: toolCalls.filter(Boolean),
  };
}
