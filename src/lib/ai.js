// AI provider abstraction — supports Anthropic Claude and local Ollama
// Configure via env vars:
//   VITE_AI_PROVIDER=anthropic|ollama  (default: anthropic)
//   VITE_ANTHROPIC_API_KEY=sk-...
//   VITE_OLLAMA_BASE_URL=http://localhost:11434
//   VITE_OLLAMA_CHAT_MODEL=qwen2.5
//   VITE_OLLAMA_VISION_MODEL=llava

const PROVIDER = import.meta.env.VITE_AI_PROVIDER || "anthropic";
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const OLLAMA_URL = import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434";
const CHAT_MODEL = import.meta.env.VITE_OLLAMA_CHAT_MODEL || "qwen2.5";
const VISION_MODEL = import.meta.env.VITE_OLLAMA_VISION_MODEL || "llava";

const ANTHROPIC_HEADERS = {
  "Content-Type": "application/json",
  "x-api-key": ANTHROPIC_KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
};

// Convert Anthropic tool format to OpenAI format for Ollama
function toOpenAITools(tools) {
  return tools.map(t => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

// Normalised response: { text: string|null, toolCalls: [{name, input}] }

export async function chatWithTools(messages, tools, systemPrompt) {
  return PROVIDER === "ollama"
    ? ollamaChatWithTools(messages, tools, systemPrompt)
    : anthropicChatWithTools(messages, tools, systemPrompt);
}

async function anthropicChatWithTools(messages, tools, systemPrompt) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: ANTHROPIC_HEADERS,
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || "Anthropic API error");

  const text = data.content.find(b => b.type === "text")?.text || null;
  const toolCalls = data.content
    .filter(b => b.type === "tool_use")
    .map(b => ({ name: b.name, input: b.input }));
  return { text, toolCalls };
}

async function ollamaChatWithTools(messages, tools, systemPrompt) {
  const resp = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      tools: toOpenAITools(tools),
      stream: false,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || "Ollama API error");

  const msg = data.choices[0].message;
  const text = msg.content || null;
  const toolCalls = (msg.tool_calls || []).map(tc => ({
    name: tc.function.name,
    input: typeof tc.function.arguments === "string"
      ? JSON.parse(tc.function.arguments)
      : tc.function.arguments,
  }));
  return { text, toolCalls };
}

// Image/text → macro estimate: { name, description, calories, protein, carbs, fat }
export async function analyzeImage(base64OrNull, textDescription) {
  return PROVIDER === "ollama"
    ? ollamaAnalyzeImage(base64OrNull, textDescription)
    : anthropicAnalyzeImage(base64OrNull, textDescription);
}

const MACRO_JSON_PROMPT =
  'You are a nutrition expert. Estimate macros for the food described/shown. ' +
  'Reply ONLY in JSON: {"name":"...","description":"...","calories":0,"protein":0,"carbs":0,"fat":0}';

async function anthropicAnalyzeImage(base64OrNull, textDescription) {
  const content = base64OrNull
    ? [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64OrNull } },
        { type: "text", text: MACRO_JSON_PROMPT },
      ]
    : [{ type: "text", text: `${MACRO_JSON_PROMPT}\n\nFood: ${textDescription}` }];

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: ANTHROPIC_HEADERS,
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || "Anthropic API error");

  const text = data.content[0].text;
  return JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
}

async function ollamaAnalyzeImage(base64OrNull, textDescription) {
  const body = base64OrNull
    ? {
        model: VISION_MODEL,
        messages: [{ role: "user", content: MACRO_JSON_PROMPT, images: [base64OrNull] }],
        stream: false,
        format: "json",
      }
    : {
        model: CHAT_MODEL,
        messages: [{ role: "user", content: `${MACRO_JSON_PROMPT}\n\nFood: ${textDescription}` }],
        stream: false,
        format: "json",
      };

  const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Ollama API error");

  return JSON.parse(data.message.content.match(/\{[\s\S]*\}/)[0]);
}
