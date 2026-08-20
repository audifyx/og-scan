import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AiBootstrap, AiConversation, AiMessage } from "@/lib/orbitxAi";

const conversation: AiConversation = {
  id: "c1",
  title: "New conversation",
  model: "meta/llama-3.3-70b-instruct",
  walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  archived: false,
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const bootstrap: AiBootstrap = {
  ok: true,
  gate: { hasAccess: true, meetsRequirement: true, mint: "mint", minUsd: 5 },
  walletAddress: conversation.walletAddress ?? null,
  models: [{ id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B" }],
  defaultModel: "meta/llama-3.3-70b-instruct",
  conversations: [conversation],
  generations: [],
  tools: [
    {
      name: "orbitx_dex_chart",
      description: "Live DexScreener chart for a token.",
      category: "Markets",
      requiresConfirmation: false,
      parameters: [
        { name: "mint", type: "string", description: "Token mint", required: true, options: [] },
      ],
    },
    {
      name: "orbitx_social_post",
      description: "Post to OrbitX social.",
      category: "Social",
      requiresConfirmation: true,
      parameters: [
        { name: "text", type: "string", description: "Post body", required: true, options: [] },
      ],
    },
  ],
};

function message(overrides: Partial<AiMessage>): AiMessage {
  return {
    id: `m-${Math.random().toString(36).slice(2)}`,
    conversationId: conversation.id,
    role: "assistant",
    content: "",
    model: bootstrap.defaultModel,
    toolEvents: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const api = vi.hoisted(() => ({
  fetchAiGate: vi.fn(),
  unlockOrbitXAi: vi.fn(),
  bootstrapOrbitXAi: vi.fn(),
  fetchAiMessages: vi.fn(),
  sendAiMessage: vi.fn(),
  createAiConversation: vi.fn(),
  deleteAiConversation: vi.fn(),
  renameAiConversation: vi.fn(),
  generateAiMedia: vi.fn(),
  pollAiMedia: vi.fn(),
  executeAiTool: vi.fn(),
  cancelAiTool: vi.fn(),
}));

vi.mock("@/lib/orbitxAi", () => ({
  ...api,
  OrbitXAiError: class OrbitXAiError extends Error {},
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "tester@orbitx.world" }, loading: false }),
}));

vi.mock("@/components/WalletConnectButton", () => ({
  WalletConnectButton: () => <button type="button">Connect wallet</button>,
}));

vi.mock("@/components/agent/token-gating-verifier", () => ({
  TokenGatingVerifier: () => <div>verifier</div>,
}));

vi.mock("@/components/agent/McpBurnAccessCard", () => ({
  McpBurnAccessCard: () => <div>burn access</div>,
}));

vi.mock("@solana/wallet-adapter-react", () => ({
  useConnection: () => ({ connection: {} }),
  useWallet: () => ({ publicKey: null, sendTransaction: vi.fn(), connected: false }),
}));

vi.mock("@/lib/xMcp", () => ({
  bootstrapXMcp: vi.fn().mockResolvedValue({ x: { connected: false } }),
  listXAgentQueue: vi.fn().mockResolvedValue({ items: [] }),
  generateXAgentPost: vi.fn(),
  enqueueXAgentItem: vi.fn(),
  approveXAgentQueueItem: vi.fn(),
}));

vi.mock("@/lib/xAuth", () => ({ xStartLogin: vi.fn() }));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

const toastSpy = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastSpy }));

const { default: OrbitXAI } = await import("@/pages/OrbitXAI");

describe("/ai OrbitX AI page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchAiGate.mockResolvedValue({ gate: bootstrap.gate, walletAddress: bootstrap.walletAddress });
    api.bootstrapOrbitXAi.mockResolvedValue(bootstrap);
    api.fetchAiMessages.mockResolvedValue({ conversation, messages: [] });
  });

  it("boots into the chat surface once the gate passes", async () => {
    render(<OrbitXAI />);
    expect(await screen.findByPlaceholderText("Message OrbitX AI…")).toBeInTheDocument();
    expect(api.bootstrapOrbitXAi).toHaveBeenCalled();
  });

  it("asks for the authorization code before the AI boots", async () => {
    api.fetchAiGate.mockResolvedValue({
      gate: {
        hasAccess: false,
        meetsRequirement: false,
        mint: "mint",
        minUsd: 5,
        launchCode: "Orbitx mcp",
        remainingFree: 25,
        burnTokens: 500,
        message:
          "Please send the authorization code to gain access or get access right away by burning 500 $ORBITX.",
      },
      walletAddress: conversation.walletAddress ?? null,
    });
    render(<OrbitXAI />);
    expect(await screen.findByRole("button", { name: /Unlock with code/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Please send the authorization code/i).length).toBeGreaterThan(0);
    expect(api.bootstrapOrbitXAi).not.toHaveBeenCalled();
  });

  it("sends a message and renders the assistant reply", async () => {
    api.sendAiMessage.mockResolvedValue({
      ok: true,
      conversation,
      userMessage: message({ role: "user", content: "what is orbitx?" }),
      assistantMessage: message({ role: "assistant", content: "OrbitX is a crypto super app." }),
    });

    render(<OrbitXAI />);
    const input = await screen.findByPlaceholderText("Message OrbitX AI…");
    fireEvent.change(input, { target: { value: "what is orbitx?" } });
    fireEvent.click(screen.getByLabelText("Send message"));

    await waitFor(() => expect(api.sendAiMessage).toHaveBeenCalledTimes(1));
    expect(api.sendAiMessage.mock.calls[0][0]).toMatchObject({ message: "what is orbitx?" });
    expect(await screen.findByText("OrbitX is a crypto super app.")).toBeInTheDocument();
  });

  it("restores the draft and surfaces the reason when a send fails", async () => {
    api.sendAiMessage.mockRejectedValue(new Error("The model returned an empty response."));

    render(<OrbitXAI />);
    const input = await screen.findByPlaceholderText("Message OrbitX AI…");
    fireEvent.change(input, { target: { value: "break please" } });
    fireEvent.click(screen.getByLabelText("Send message"));

    await waitFor(() =>
      expect(toastSpy.error).toHaveBeenCalledWith("The model returned an empty response."),
    );
    expect(await screen.findByDisplayValue("break please")).toBeInTheDocument();
  });

  it("renders a completed tool card without crashing on sparse results", async () => {
    api.fetchAiMessages.mockResolvedValue({
      conversation,
      messages: [
        message({
          role: "assistant",
          content: "Here is the health check.",
          toolEvents: [
            { id: "e1", tool: "orbitx_health", args: {}, status: "completed", result: null },
          ],
        }),
      ],
    });

    render(<OrbitXAI />);
    expect(await screen.findByText("health")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("confirms a guarded tool through the confirmation card", async () => {
    const pending = message({
      role: "assistant",
      content: "Confirm the post below.",
      toolEvents: [
        {
          id: "e2",
          tool: "orbitx_social_post",
          args: { text: "gm" },
          status: "confirmation_required",
          result: { message: "Review and confirm this action." },
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        },
      ],
    });
    api.fetchAiMessages.mockResolvedValue({ conversation, messages: [pending] });
    api.executeAiTool.mockResolvedValue({
      ok: true,
      event: { id: "e2", tool: "orbitx_social_post", args: { text: "gm" }, status: "completed", result: { ok: true } },
      message: message({ role: "tool", content: "orbitx_social_post completed." }),
    });

    render(<OrbitXAI />);
    const confirm = await screen.findByRole("button", { name: /Confirm action/i });
    fireEvent.click(confirm);

    await waitFor(() => expect(api.executeAiTool).toHaveBeenCalledTimes(1));
    expect(api.executeAiTool.mock.calls[0][0]).toMatchObject({
      conversationId: "c1",
      messageId: pending.id,
      eventId: "e2",
    });
    await waitFor(() => expect(toastSpy.success).toHaveBeenCalledWith("OrbitX action completed"));
  });

  it("cancels a guarded tool", async () => {
    const pending = message({
      role: "assistant",
      content: "Confirm the post below.",
      toolEvents: [
        {
          id: "e3",
          tool: "orbitx_social_post",
          args: { text: "gm" },
          status: "confirmation_required",
          result: {},
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        },
      ],
    });
    api.fetchAiMessages.mockResolvedValue({ conversation, messages: [pending] });
    api.cancelAiTool.mockResolvedValue({
      ok: true,
      event: { id: "e3", tool: "orbitx_social_post", args: {}, status: "cancelled", result: {} },
    });

    render(<OrbitXAI />);
    fireEvent.click(await screen.findByRole("button", { name: /^Cancel$/i }));
    await waitFor(() => expect(api.cancelAiTool).toHaveBeenCalledTimes(1));
  });

  it("lists the live MCP catalog in the tools tab and launches a tool into chat", async () => {
    api.sendAiMessage.mockResolvedValue({
      ok: true,
      conversation,
      userMessage: message({ role: "user", content: "run it" }),
      assistantMessage: message({ role: "assistant", content: "Running." }),
    });

    render(<OrbitXAI />);
    fireEvent.click(await screen.findByRole("button", { name: /Tools/i }));
    expect(await screen.findByText("Dex Chart")).toBeInTheDocument();
    expect(screen.getByText("Social Post")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Open in chat/i })[0]);
    await waitFor(() => expect(api.sendAiMessage).toHaveBeenCalledTimes(1));
    expect(api.sendAiMessage.mock.calls[0][0].message).toContain("orbitx_dex_chart");
  });

  it("shows the locked screen with the server reason when bootstrap fails", async () => {
    api.bootstrapOrbitXAi.mockRejectedValue(new Error("MCP access required"));
    render(<OrbitXAI />);
    expect(await screen.findByText("MCP access required")).toBeInTheDocument();
  });
});
