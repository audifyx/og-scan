/**
 * NVIDIA NIM Model Teams - 40+ Models organized into 5 specialized teams
 * Each team of 8 models specializes in different analysis domains
 * Teams vote on answers through ensemble consensus
 */

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  parameters: string;
  strengths: string[];
  costness: "ultra-fast" | "fast" | "standard" | "thorough";
}

export interface Team {
  id: string;
  name: string;
  description: string;
  specialty: string;
  models: ModelInfo[];
}

export const MODEL_TEAMS: Team[] = [
  {
    id: "reasoning",
    name: "🧠 REASONING & ANALYSIS",
    description: "Deep thinking, complex logic, multi-step reasoning",
    specialty: "Analysis, reasoning, logic, comprehensive evaluation",
    models: [
      {
        id: "meta/llama-3.1-405b-instruct",
        name: "Llama 3.1 405B",
        provider: "Meta",
        description: "Flagship reasoning model, multimodal, best all-around",
        parameters: "405B",
        strengths: ["Complex reasoning", "Long context", "Multimodal", "Code generation"],
        costness: "thorough",
      },
      {
        id: "deepseek/deepseek-v4",
        name: "DeepSeek V4",
        provider: "DeepSeek",
        description: "1M token context, MoE architecture, reasoning expert",
        parameters: "1.4T (MoE)",
        strengths: ["1M context", "Reasoning", "Code", "Efficiency"],
        costness: "thorough",
      },
      {
        id: "mistralai/mistral-large-3-675b",
        name: "Mistral Large 3",
        provider: "Mistral",
        description: "State-of-the-art reasoning for professional tasks",
        parameters: "675B",
        strengths: ["Professional writing", "Complex reasoning", "Code", "Analysis"],
        costness: "thorough",
      },
      {
        id: "qwen/qwen3-next-128b-instruct",
        name: "Qwen 3 Next 128B",
        provider: "Alibaba",
        description: "Hybrid MoE, improved accuracy, reasoning-focused",
        parameters: "128B",
        strengths: ["Reasoning", "Tool calling", "Accuracy", "Context"],
        costness: "standard",
      },
      {
        id: "zhipuai/glm-5.1",
        name: "GLM 5.1",
        provider: "Zhipu",
        description: "Agentic workflows, coding, long-horizon reasoning",
        parameters: "Unknown",
        strengths: ["Agentic tasks", "Reasoning", "Coding", "Long horizon"],
        costness: "standard",
      },
      {
        id: "minimax/minmax-m2.7-instruct",
        name: "MiniMax M2.7",
        provider: "MiniMax",
        description: "230B MoE, competes with Claude on complex tasks",
        parameters: "230B (MoE)",
        strengths: ["Complex reasoning", "Coding", "Analysis", "Professional"],
        costness: "standard",
      },
      {
        id: "nvidia/nemotron-3-ultra-550b-a55b",
        name: "Nemotron 3 Ultra",
        provider: "NVIDIA",
        description: "NVIDIA's flagship reasoning and function calling",
        parameters: "550B",
        strengths: ["Function calling", "Reasoning", "Enterprise", "Safety"],
        costness: "thorough",
      },
      {
        id: "stepfun/step-3.5-flash",
        name: "Step 3.5 Flash",
        provider: "Stepfun",
        description: "Fast reasoning with strong accuracy",
        parameters: "Unknown",
        strengths: ["Fast reasoning", "Accuracy", "Cost efficient"],
        costness: "standard",
      },
    ],
  },

  {
    id: "coding",
    name: "💻 CODE & TECHNICAL",
    description: "Code generation, debugging, technical analysis, development tasks",
    specialty: "Coding, technical analysis, debugging, architecture",
    models: [
      {
        id: "qwen/qwen3-coder-480b-a35b-instruct",
        name: "Qwen 3 Coder 480B",
        provider: "Alibaba",
        description: "Purpose-built for agentic coding, best code generation",
        parameters: "480B (MoE)",
        strengths: ["Code generation", "Debugging", "Agentic coding", "All languages"],
        costness: "thorough",
      },
      {
        id: "deepseek/deepseek-coder-671b-instruct",
        name: "DeepSeek Coder 671B",
        provider: "DeepSeek",
        description: "Expert code generation and analysis",
        parameters: "671B",
        strengths: ["Code generation", "Analysis", "Debugging", "Architecture"],
        costness: "thorough",
      },
      {
        id: "mistralai/devstral-2-123b-instruct",
        name: "Devstral 2 123B",
        provider: "Mistral",
        description: "Dev-focused model, excellent for production code",
        parameters: "123B",
        strengths: ["Development", "Code review", "Debugging", "Tool calling"],
        costness: "standard",
      },
      {
        id: "nvidia/nemotron-3-super-120b-a12b",
        name: "Nemotron 3 Super 120B",
        provider: "NVIDIA",
        description: "Efficient code model, best function calling",
        parameters: "120B (MoE, 12B active)",
        strengths: ["Function calling", "Code", "Efficiency", "Production"],
        costness: "fast",
      },
      {
        id: "meta/llama-3.1-70b-instruct",
        name: "Llama 3.1 70B",
        provider: "Meta",
        description: "Fast reasoning, solid code generation",
        parameters: "70B",
        strengths: ["Fast", "Code", "General tasks", "Popular"],
        costness: "fast",
      },
      {
        id: "microsoft/phi-4-instruct",
        name: "Phi 4 Instruct",
        provider: "Microsoft",
        description: "Lightweight, excellent code understanding",
        parameters: "14B",
        strengths: ["Lightweight", "Code", "Reasoning", "Fast"],
        costness: "ultra-fast",
      },
      {
        id: "nvidia/nv-embedcode-7b-v1",
        name: "NV-EmbedCode 7B",
        provider: "NVIDIA",
        description: "Code-trained embeddings for RAG and retrieval",
        parameters: "7B",
        strengths: ["Code embeddings", "RAG", "Retrieval", "Fast"],
        costness: "ultra-fast",
      },
      {
        id: "bytedance/seed-oss-36b-instruct",
        name: "Seed-OSS 36B",
        provider: "ByteDance",
        description: "Fast, efficient, solid coding capabilities",
        parameters: "36B",
        strengths: ["Fast", "Code", "Efficient", "General"],
        costness: "fast",
      },
    ],
  },

  {
    id: "multilingual",
    name: "🌍 GENERAL & MULTILINGUAL",
    description: "Broad understanding, multiple languages, general knowledge",
    specialty: "General tasks, multilingual, broad knowledge, translation",
    models: [
      {
        id: "meta/llama-4-maverick",
        name: "Llama 4 Maverick",
        provider: "Meta",
        description: "Most popular model (22M uses), multimodal, general purpose",
        parameters: "Unknown",
        strengths: ["Popular", "Multimodal", "General", "Broad knowledge"],
        costness: "standard",
      },
      {
        id: "google/gemma-3-40b-it",
        name: "Gemma 3 40B",
        provider: "Google",
        description: "Lightweight yet capable, multilingual, efficient",
        parameters: "40B",
        strengths: ["Multilingual", "Efficient", "Lightweight", "General"],
        costness: "fast",
      },
      {
        id: "qwen/qwen3-7b-instruct",
        name: "Qwen 3 7B",
        provider: "Alibaba",
        description: "Lightweight multilingual, strong for size",
        parameters: "7B",
        strengths: ["Lightweight", "Multilingual", "Fast", "Efficient"],
        costness: "ultra-fast",
      },
      {
        id: "mistralai/mistral-nemo-12b-instruct",
        name: "Mistral Nemo 12B",
        provider: "Mistral",
        description: "Compact yet capable, best function calling for size",
        parameters: "12B",
        strengths: ["Compact", "Function calling", "Fast", "Efficient"],
        costness: "ultra-fast",
      },
      {
        id: "sarvamai/sarvam-m",
        name: "Sarvam-M",
        provider: "Sarvam AI",
        description: "Indian language expert, 13 languages, specialized",
        parameters: "Unknown",
        strengths: ["Indian languages", "Multilingual", "Regional", "Specialized"],
        costness: "standard",
      },
      {
        id: "aya-expanse/aya-expanse-32b-instruct",
        name: "Aya Expanse 32B",
        provider: "Cohere",
        description: "Multilingual, 26+ languages, balanced performance",
        parameters: "32B",
        strengths: ["26+ languages", "Multilingual", "Balanced", "General"],
        costness: "standard",
      },
      {
        id: "nvidia/nv-embedqwen-7b",
        name: "NV-EmbedQwen 7B",
        provider: "NVIDIA",
        description: "Multilingual embeddings, 26-language support",
        parameters: "7B",
        strengths: ["26 languages", "Embeddings", "RAG", "Retrieval"],
        costness: "ultra-fast",
      },
      {
        id: "nllb-multilingual/nllb-200-3.3b",
        name: "NLLB 200 3.3B",
        provider: "Meta",
        description: "Fast translation, 200+ languages",
        parameters: "3.3B",
        strengths: ["Translation", "200+ languages", "Fast", "Lightweight"],
        costness: "ultra-fast",
      },
    ],
  },

  {
    id: "speed",
    name: "⚡ SPEED OPTIMIZED",
    description: "Lightweight, fast inference, real-time responses",
    specialty: "Speed, efficiency, lightweight, real-time",
    models: [
      {
        id: "microsoft/phi-3.5-mini-instruct",
        name: "Phi 3.5 Mini",
        provider: "Microsoft",
        description: "Ultra-lightweight, 3.8B, surprisingly capable",
        parameters: "3.8B",
        strengths: ["Ultra-lightweight", "Fast", "Capable", "Energy efficient"],
        costness: "ultra-fast",
      },
      {
        id: "meta/llama-3.2-1b-instruct",
        name: "Llama 3.2 1B",
        provider: "Meta",
        description: "Tiny but functional, edge deployment ready",
        parameters: "1B",
        strengths: ["Tiny", "Fast", "Edge ready", "Lightweight"],
        costness: "ultra-fast",
      },
      {
        id: "meta/llama-3.2-3b-instruct",
        name: "Llama 3.2 3B",
        provider: "Meta",
        description: "Lightweight but functional",
        parameters: "3B",
        strengths: ["Lightweight", "Fast", "General", "Efficient"],
        costness: "ultra-fast",
      },
      {
        id: "google/gemma-2-2b-it",
        name: "Gemma 2 2B",
        provider: "Google",
        description: "Lightweight, efficient instruction-following",
        parameters: "2B",
        strengths: ["Lightweight", "Fast", "Efficient", "Instruction-follow"],
        costness: "ultra-fast",
      },
      {
        id: "mistralai/mistral-7b-instruct",
        name: "Mistral 7B",
        provider: "Mistral",
        description: "Fast, quality, lightweight goldilocks model",
        parameters: "7B",
        strengths: ["Fast", "Lightweight", "Quality", "Balanced"],
        costness: "fast",
      },
      {
        id: "tiiuae/falcon-7b-instruct",
        name: "Falcon 7B",
        provider: "TII",
        description: "Fast, lightweight, efficient",
        parameters: "7B",
        strengths: ["Fast", "Lightweight", "Efficient", "Production"],
        costness: "fast",
      },
      {
        id: "deepseek/deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        provider: "DeepSeek",
        description: "284B MoE, flash-optimized for speed",
        parameters: "284B (MoE)",
        strengths: ["Fast", "1M context", "Coding", "Efficient"],
        costness: "fast",
      },
      {
        id: "mistralai/mistral-small-instruct",
        name: "Mistral Small",
        provider: "Mistral",
        description: "Small but mighty, balanced performance",
        parameters: "22B",
        strengths: ["Balanced", "Fast", "Efficient", "General"],
        costness: "fast",
      },
    ],
  },

  {
    id: "specialized",
    name: "🎯 VISION & SPECIALIZED",
    description: "Multimodal, vision, domain-specific, specialized tasks",
    specialty: "Vision, multimodal, specialized domains",
    models: [
      {
        id: "nvidia/nemotron-nano-omni-4b",
        name: "Nemotron Nano Omni",
        provider: "NVIDIA",
        description: "Omni-modal: images, video, speech, text understanding",
        parameters: "4B",
        strengths: ["Omni-modal", "Video", "Speech", "Lightweight"],
        costness: "ultra-fast",
      },
      {
        id: "nvidia/nemotron-nano-12b-vl",
        name: "Nemotron Nano 12B VL",
        provider: "NVIDIA",
        description: "Multi-image, video, visual Q&A, summarization",
        parameters: "12B",
        strengths: ["Multi-image", "Video", "Visual QA", "Summarization"],
        costness: "fast",
      },
      {
        id: "meta/llama-3.2-90b-vision-instruct",
        name: "Llama 3.2 90B Vision",
        provider: "Meta",
        description: "High-quality vision understanding and reasoning",
        parameters: "90B",
        strengths: ["Vision", "Reasoning", "Document analysis", "Image understanding"],
        costness: "standard",
      },
      {
        id: "deepseek/deepseek-vl2-small-4b",
        name: "DeepSeek VL2 Small",
        provider: "DeepSeek",
        description: "Lightweight vision language model",
        parameters: "4B",
        strengths: ["Vision", "Lightweight", "Fast", "Document understanding"],
        costness: "ultra-fast",
      },
      {
        id: "qwen/qwen2-vl-7b-instruct",
        name: "Qwen 2 VL 7B",
        provider: "Alibaba",
        description: "Vision language understanding",
        parameters: "7B",
        strengths: ["Vision", "Lightweight", "Fast", "General"],
        costness: "fast",
      },
      {
        id: "nvidia/nv-reriitnersearch-14b",
        name: "NV-Reritter Search 14B",
        provider: "NVIDIA",
        description: "Text/image retrieval, document understanding",
        parameters: "14B",
        strengths: ["Document retrieval", "Text extraction", "RAG", "Specialized"],
        costness: "standard",
      },
      {
        id: "nvidia/nv-content-filter",
        name: "NV Content Filter",
        provider: "NVIDIA",
        description: "Safety, content moderation, policy enforcement",
        parameters: "Specialized",
        strengths: ["Safety", "Moderation", "Policy enforcement", "Specialized"],
        costness: "standard",
      },
      {
        id: "google/gemma-3-27b-instruct-vision",
        name: "Gemma 3 27B Vision",
        provider: "Google",
        description: "Vision understanding, document analysis",
        parameters: "27B",
        strengths: ["Vision", "Documents", "Analysis", "Efficient"],
        costness: "standard",
      },
    ],
  },
];

// Flatten all models for quick lookup
export const ALL_MODELS: ModelInfo[] = MODEL_TEAMS.flatMap((team) => team.models);

// Get models by team
export const getTeamModels = (teamId: string): ModelInfo[] => {
  const team = MODEL_TEAMS.find((t) => t.id === teamId);
  return team ? team.models : [];
};

// Get all model IDs for the API
export const getAllModelIds = (): string[] => {
  return ALL_MODELS.map((m) => m.id);
};

// Random model from team for quick selection
export const getRandomTeamModel = (teamId: string): ModelInfo | null => {
  const models = getTeamModels(teamId);
  return models[Math.floor(Math.random() * models.length)] || null;
};
