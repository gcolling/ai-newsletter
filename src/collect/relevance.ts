/**
 * Keyword rules that decide whether a general-tech item is about AI. Terms are matched with word
 * boundaries; a term without the `i` flag is case-sensitive on purpose (AI, LLM, MCP, RAG, Grok).
 */

export interface Term {
  /** Stable name used to count distinct terms ("agent" and "agents" are one term). */
  id: string;
  /** Must not use the `g` flag: it is run with `exec` and has to stay stateless. */
  pattern: RegExp;
  /** So common in an AI digest that it is not worth showing as a reason. */
  generic?: boolean;
}

export interface TermMatch {
  id: string;
  /** The words as written in the text, for "Matched: …" reasons. */
  text: string;
  generic: boolean;
}

function term(id: string, pattern: RegExp, generic = false): Term {
  return { id, pattern, generic };
}

export const STRONG_TERMS: Term[] = [
  term("AI", /\b(?:Gen)?AI\b|\bA\.I\./, true),
  term("artificial intelligence", /\bartificial intelligence\b/i, true),
  term("machine learning", /\bmachine learning\b/i),
  term("deep learning", /\bdeep learning\b/i),
  term("neural network", /\bneural net(?:work)?s?\b/i),
  term("LLM", /\bLLMs?\b/),
  term("language model", /\b(?:large|small) language models?\b/i),
  term("foundation model", /\b(?:foundation|frontier|reasoning|multimodal) models?\b/i),
  term("open weights", /\bopen[- ]weights?\b/i),
  term("AGI", /\bAGI\b/),
  term("superintelligence", /\bsuperintelligen(?:ce|t)\b/i),
  term("ChatGPT", /\bChatGPT\b/i),
  // OpenAI writes "GPT‑5" with a non-breaking hyphen as often as with a plain one.
  term("GPT", /\bGPT[-‑]\w+/),
  term("OpenAI", /\bOpenAI\b/i),
  term("Codex", /\bCodex\b/),
  term("Sora", /\bSora\b/),
  term("Anthropic", /\bAnthropic\b/),
  term("Claude", /\bClaude\b/),
  term("Gemini", /\bGemini\b/),
  term("Gemma", /\bGemma\b/),
  term("DeepMind", /\bDeepMind\b/i),
  term("Llama", /\bLlama[- ]?\d|\bLlama models?\b/i),
  term("Mistral", /\bMistral\b/),
  term("Mixtral", /\bMixtral\b/i),
  term("Qwen", /\bQwen\w*/i),
  term("DeepSeek", /\bDeepSeek\b/i),
  term("Kimi", /\bKimi\b/),
  term("Grok", /\bGrok\b/),
  term("xAI", /\bxAI\b/),
  term("Hugging Face", /\bHugging ?Face\b/i),
  term("Perplexity", /\bPerplexity\b/),
  term("Ollama", /\bOllama\b/i),
  term("vLLM", /\bvLLM\b/i),
  term("llama.cpp", /\bllama\.cpp\b/i),
  term("MLX", /\bMLX\b/),
  term("Copilot", /\bCopilot\b/),
  term("Cursor IDE", /\bCursor (?:AI|IDE)\b/),
  term("Windsurf", /\bWindsurf\b/),
  term("Devin", /\bDevin (?:AI|agent)\b/),
  term("Cline", /\bCline\b/),
  term("opencode", /\bOpenCode\b/i),
  term("OpenHands", /\bOpenHands\b/i),
  term("Aider", /\bAider\b/),
  term("Junie", /\bJunie\b/),
  term("agentic", /\bagentic\b/i),
  term("AI agent", /\bAI agents?\b/i),
  term("coding agent", /\bcoding agents?\b/i),
  term("multi-agent", /\bmulti-agent\b/i),
  term("agent SDK", /\bagents? (?:SDK|framework)s?\b/i),
  term("MCP", /\bMCP\b/),
  term("Model Context Protocol", /\bModel Context Protocol\b/i),
  term("A2A", /\bA2A\b/),
  term("tool calling", /\b(?:tool|function) calling\b/i),
  term("computer use", /\bcomputer[- ]use\b/i),
  term("RAG", /\bRAG\b/),
  term("retrieval-augmented", /\bretrieval[- ]augmented\b/i),
  term("embeddings", /\bembeddings?\b/i),
  term("vector database", /\bvector (?:database|search|store)s?\b/i),
  term("fine-tuning", /\bfine[- ]?tun(?:e|ed|es|ing)\b/i),
  term("RLHF", /\bRLHF\b/),
  term("post-training", /\bpost-training\b/i),
  term("distillation", /\bdistillation\b/i),
  term("quantization", /\bquantiz(?:ation|ed)\b/i),
  term("prompt engineering", /\bprompt engineering\b/i),
  term("prompt injection", /\bprompt injections?\b/i),
  term("context engineering", /\bcontext engineering\b/i),
  term("context window", /\bcontext windows?\b/i),
  term("jailbreak", /\bjailbreak(?:s|ing|ed)?\b/i),
  term("vibe coding", /\bvibe[- ]?cod(?:e|ed|er|ers|ing)\b/i),
  term("hallucination", /\bhallucinat(?:e|es|ed|ing|ion|ions)\b/i),
  term("diffusion model", /\bdiffusion models?\b/i),
  term("text-to-image", /\btext-to-(?:image|video|speech)\b/i),
  term("speech-to-text", /\bspeech-to-text\b/i),
  term("LangChain", /\bLangChain\b/i),
  term("LangGraph", /\bLangGraph\b/i),
  term("LlamaIndex", /\bLlamaIndex\b/i),
  term("CrewAI", /\bCrewAI\b/i),
  term("AutoGen", /\bAutoGen\b/),
  term("Semantic Kernel", /\bSemantic Kernel\b/i),
  term("Pydantic AI", /\bPydantic AI\b/i),
  term("DSPy", /\bDSPy\b/i),
  term("n8n", /\bn8n\b/i),
  term("Zapier", /\bZapier\b/i),
  term("Make.com", /\bMake\.com\b/i),
  term("workflow automation", /\bworkflow automation\b/i),
  term("iPaaS", /\biPaaS\b/),
  term("RPA", /\bRPA\b/),
  term("durable execution", /\bdurable execution\b/i),
];

export const WEAK_TERMS: Term[] = [
  term("agent", /\bagents?\b/i),
  term("model", /\bmodels?\b/i),
  term("inference", /\binference\b/i),
  term("training", /\btraining\b/i),
  term("dataset", /\bdatasets?\b/i),
  term("synthetic data", /\bsynthetic data\b/i),
  term("GPU", /\bGPUs?\b/i),
  term("TPU", /\bTPUs?\b/),
  term("NVIDIA", /\bNVIDIA\b/i),
  term("chip", /\bchips?\b/i),
  term("data center", /\bdata ?cent(?:er|re)s?\b/i),
  term("compute", /\bcompute\b/i),
  term("benchmark", /\bbenchmarks?\b/i),
  term("eval", /\bevals?\b/i),
  term("alignment", /\balignment\b/i),
  term("safety", /\bsafety\b/i),
  term("reasoning", /\breasoning\b/i),
  term("token", /\btokens?\b/i),
  term("prompt", /\bprompts?\b/i),
  term("chatbot", /\bchatbots?\b/i),
  term("assistant", /\bassistants?\b/i),
  term("transformer", /\btransformers?\b/i),
  term("semantic search", /\bsemantic search\b/i),
  term("vector", /\bvectors?\b/i),
  term("Opus", /\bOpus\b/),
  term("Sonnet", /\bSonnet\b/),
  term("Haiku", /\bHaiku\b/),
  term("Cursor", /\bCursor\b/),
  term("automation", /\bautomat(?:ion|e|es|ed|ing)\b/i),
  term("workflow", /\bworkflows?\b/i),
  term("orchestration", /\borchestration\b/i),
  term("integration", /\bintegrations?\b/i),
  term("API", /\bAPIs?\b/),
  term("SDK", /\bSDKs?\b/),
  term("webhook", /\bwebhooks?\b/i),
  term("robot", /\brobot(?:s|ic|ics)?\b/i),
  term("autonomous", /\bautonomous\b/i),
  term("crawler", /\bcrawl(?:er|ers|ing)\b|\bscrap(?:ing|er|ers)\b/i),
  term("copyright", /\bcopyright\b/i),
  term("Temporal", /\bTemporal\b/),
];

/**
 * Phrases that look like a term but mean something else. They are blanked out before matching,
 * so they neutralise only the term they collide with; the item itself is not dropped.
 * `when` blanks `remove` everywhere once the context is clearly not AI (a horoscope, a Winklevoss).
 */
interface Collision {
  remove: RegExp;
  when?: RegExp;
}

const COLLISIONS: Collision[] = [
  { remove: /\bQuantum AI\b/g },
  { remove: /\bJean-Claude\b|\bClaude (?:Monet|Debussy|Van Damme)\b|\bVan Damme\b/g },
  { remove: /\bGemini\b/g, when: /\b(?:zodiac|horoscopes?|astrolog\w*|star signs?)\b/i },
  { remove: /\bGemini\b/g, when: /\bWinklevoss\b|\bGemini (?:crypto|exchange|Trust)\b/i },
  {
    remove:
      /\b(?:Project )?Gemini (?:spacecraft|capsule|missions?|program(?:me)?|astronauts?)\b|\bProject Gemini\b/gi,
  },
  { remove: /\bMistral[- ]class\b|\bmistral winds?\b/gi },
  { remove: /\b(?:Tesla )?Model [3SXY]\b/g },
  { remove: /\b(?:role|business|fashion|data|pricing|revenue|subscription) models?\b/gi },
  {
    remove:
      /\b(?:real[- ]estate|travel|free|secret|FBI|ICE|Border Patrol|federal|CBP|DEA|ATF|immigration|Secret Service|user|chemical|nerve|sports|insurance|talent|booking) agents?\b|\bAgent Orange\b|\bfree agency\b/gi,
  },
  { remove: /\b(?:mouse|database|text|blinking) cursors?\b/gi },
  { remove: /\bOpus (?:codec|Dei)\b|\bmagnum opus\b/gi },
  { remove: /\bHaiku (?:OS|operating system)\b|\bhaikus?(?: poems?| poetry)?\b/g },
  { remove: /\bsonnets?\b/gi, when: /\bShakespeare/i },
  {
    remove: /\btransformers?\b/gi,
    when: /\b(?:Optimus Prime|Hasbro|Bumblebee|Autobots?|Decepticons?)\b|\bTransformers (?:movie|film|toys?)\b/i,
  },
  {
    remove:
      /\bMicrosoft Certified Professionals?\b(?:\s*\(MCPs?\))?|\bMCP (?:certification|certified|exam)s?\b/g,
  },
];

/** Hard drops, matched on the title: shopping, listicles, horoscopes, sponsored posts. */
const DENY_TITLE: RegExp[] = [
  /(?:\b\d+%|\$\d+) off\b/i,
  /\b(?:promo codes?|coupons?|Prime Day|Black Friday|Cyber Monday|gift guide|giveaways?|sweepstakes|all-time low|lowest price)\b/i,
  /\b(?:best|top|early|great|biggest)\b[\w\s-]{0,30}\bdeals\b|\bdeals? of the (?:day|week)\b|^deal:/i,
  /^(?:The )?\d+ (?:best|top)\b/i,
  /\bbest .{0,40}\b(?:apps|tools|software|platforms)\b.{0,10}\b20\d\d\b/i,
  /:\s*\d+ (?:tools|apps|platforms|alternatives)\b/i,
  /\bhow to watch\b/i,
  /\b(?:sponsored|partner content)\b/i,
  /\bhoroscopes?\b/i,
];

/** Hard drops, matched on title and summary: consumer gaming posts that ride AI feeds weekly. */
const DENY_ANYWHERE: RegExp[] = [
  /\b(?:GeForce NOW|GFN Thursday|Game Pass|Nintendo Switch|PlayStation Plus)\b/i,
];

function globalPattern(pattern: RegExp): RegExp {
  return pattern.flags.includes("g") ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
}

/** Blanks out collision phrases so they cannot count as a term. */
export function neutralise(text: string): string {
  let result = text;
  for (const { remove, when } of COLLISIONS) {
    if (when && !when.test(result)) continue;
    result = result.replace(globalPattern(remove), (match) => " ".repeat(match.length));
  }
  return result;
}

/** Distinct terms found in the text, in order of first appearance. */
export function findTerms(text: string, terms: Term[]): TermMatch[] {
  const clean = neutralise(text);
  const found: { index: number; match: TermMatch }[] = [];
  for (const t of terms) {
    const hit = t.pattern.exec(clean);
    if (hit)
      found.push({ index: hit.index, match: { id: t.id, text: hit[0], generic: !!t.generic } });
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.match);
}

export function strongMatches(text: string): TermMatch[] {
  return findTerms(text, STRONG_TERMS);
}

export function weakMatches(text: string): TermMatch[] {
  return findTerms(text, WEAK_TERMS);
}

function passes(text: string): boolean {
  return strongMatches(text).length >= 1 || weakMatches(text).length >= 2;
}

/** Rule for keyword-filtered feeds: title plus the start of the summary. */
export function isRelevant(title: string, summary: string): boolean {
  return passes(`${title}\n${summary.slice(0, 300)}`);
}

/** Stricter rule for Hacker News, where only the title is known. */
export function isRelevantTitle(title: string): boolean {
  return passes(title);
}

/** Paid posts that only say so at the start of the standfirst ("SPONSORED POST: …"). */
const DENY_SUMMARY_START = /^\s*(?:sponsored(?: post| content)?|partner content|advertorial)\b/i;

export function isDenied(title: string, summary: string): boolean {
  if (DENY_TITLE.some((pattern) => pattern.test(title))) return true;
  if (DENY_SUMMARY_START.test(summary)) return true;
  const text = `${title}\n${summary}`;
  return DENY_ANYWHERE.some((pattern) => pattern.test(text));
}
