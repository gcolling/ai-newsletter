import type { Section, TopicId } from "./types.ts";

export interface Topic {
  id: TopicId;
  name: string;
  /** Gem-cut stage color. White text passes WCAG AA on every one. */
  color: string;
  gem: string;
  /** Signals that a story belongs here. Title hits count double. */
  keywords: RegExp[];
}

export const topics: Topic[] = [
  {
    id: "models",
    name: "Models & labs",
    color: "#0A2A8F",
    gem: "Deep sapphire",
    keywords: [
      /\b(GPT-?\d[\w.-]*|o\d(-\w+)?|Claude (Opus|Sonnet|Haiku)|Gemini \d[\w.]*|Gemma|Llama \d|Qwen\w*|DeepSeek|Mistral|Mixtral|Kimi|Grok \d|Phi-\d)\b/,
      /\b(open[- ]weights?|foundation models?|frontier models?|reasoning models?|multimodal|model release|new model|text-to-(image|video|speech)|diffusion models?|context window|ChatGPT|Sora)\b/i,
    ],
  },
  {
    id: "agents",
    name: "Agents",
    color: "#5A189A",
    gem: "Amethyst",
    keywords: [
      /\b(agents?|agentic|multi-agent|subagents?|computer use|browser use|autonomous|A2A|tool (use|calling)|function calling|Agents SDK)\b/i,
    ],
  },
  {
    id: "automation",
    name: "Automation & integrations",
    color: "#04573A",
    gem: "Emerald",
    keywords: [
      /\b(automation|automat(e|es|ed|ing)|workflows?|integrations?|iPaaS|RPA|n8n|Zapier|Make\.com|Temporal|durable execution|webhooks?|orchestration|pipelines?|connectors?)\b/i,
      /\b(MCP|Model Context Protocol|APIs?)\b/,
    ],
  },
  {
    id: "tools",
    name: "Dev tools",
    color: "#035A66",
    gem: "Deep teal",
    keywords: [
      /\b(Copilot|Cursor|Claude Code|Codex|Gemini CLI|opencode|OpenHands|Windsurf|Cline|Aider|IDE|VS Code|coding (agents?|assistants?)|code review|vibe ?coding|developers?|SDKs?|CLI|framework|LangChain|LangGraph|LlamaIndex|Pydantic|DSPy|Playwright|testing|tests|debugging|open source|GitHub|terminal|refactor\w*)\b/i,
    ],
  },
  {
    id: "research",
    name: "Research",
    color: "#A84A05",
    gem: "Imperial topaz",
    keywords: [
      /\b(paper|research(ers)?|study|benchmarks?|arXiv|evals?|evaluation|interpretability|alignment|reinforcement learning|RLHF|post-training|pre-?training|distillation|datasets?|scaling laws?|theorem|mathematic\w*)\b/i,
    ],
  },
  {
    id: "infra",
    name: "Chips & infra",
    color: "#7A5300",
    gem: "Citrine",
    keywords: [
      /\b(GPUs?|TPUs?|NVIDIA|AMD|TSMC|chips?|semiconductors?|data ?cent(er|re)s?|inference|compute|H100|H200|B200|Blackwell|Rubin|clusters?|serving|vLLM|Ollama|llama\.cpp|on-device|edge|quantiz\w+|latency|throughput|power grid|energy)\b/i,
    ],
  },
  {
    id: "policy",
    name: "Policy & safety",
    color: "#7C0F4C",
    gem: "Rubellite",
    keywords: [
      /\b(regulat\w+|laws?|lawsuits?|sued|court|judge|copyright|AI Act|policy|government|senate|congress|ban(s|ned)?|safety|security|privacy|vulnerabilit\w+|exploit\w*|prompt injection|jailbreak\w*|deepfakes?|scrap(e|es|ing)|antitrust|FTC|leak(s|ed)?|breach|malware|misuse)\b/i,
    ],
  },
  {
    id: "industry",
    name: "Industry & work",
    color: "#6E0A1E",
    gem: "Almandine",
    keywords: [
      /\b(funding|raises?|raised|valuation|IPO|revenue|acquir(e|es|ed)|acquisition|startups?|layoffs?|hiring|jobs?|workforce|careers?|CEO|partnership|enterprise|pricing|customers?|market|investors?|billion|engineers?|teams?|managers?|productivity)\b/i,
    ],
  },
];

export const topicById = new Map(topics.map((t) => [t.id, t]));

/** Used when no keyword wins. */
export const defaultTopic: Record<Section, TopicId> = {
  labs: "models",
  news: "industry",
  essays: "tools",
  automation: "automation",
  releases: "tools",
  community: "tools",
  papers: "research",
};
