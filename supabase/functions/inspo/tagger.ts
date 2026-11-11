// AI tags: Claude looks at the saved image and names the UI patterns in it,
// so "onboarding" or "pricing" finds things months later.
import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";

// Haiku 5.5: a few cents per 100 images. (Opus 5.5 would be roughly $1–3 per 100.)
export const TAG_MODEL = "claude-haiku-5-5";

// A shared starting vocabulary keeps tags consistent ("pricing" not "pricing-page", "prices").
const VOCAB = [
  "onboarding", "sign up", "login", "paywall", "pricing", "checkout", "dashboard", "settings",
  "profile", "empty state", "error state", "loading", "notification", "navigation", "tab bar",
  "sidebar", "search", "filters", "list", "cards", "table", "form", "modal", "bottom sheet",
  "toast", "chart", "data viz", "calendar", "chat", "feed", "media player", "map",
  "landing page", "hero", "footer", "portfolio", "case study", "typography", "color",
  "gradient", "illustration", "3d", "icons", "branding", "logo", "poster", "motion",
  "micro-interaction", "dark mode", "light mode", "mobile", "web", "desktop", "watch",
  "fintech", "health", "ai", "productivity", "ecommerce", "social", "minimal", "playful",
  "editorial", "glass", "brutalist",
];

const SCHEMA = {
  type: "object",
  properties: {
    tags: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    palette: { type: "array", items: { type: "string" } },
  },
  required: ["tags", "summary", "palette"],
  additionalProperties: false,
};

export type TagResult = { tags: string[]; summary: string; palette: string[] };

export async function tagImages(
  imageUrls: string[],
  context: { body?: string | null; author?: string | null },
  knownTags: string[],
): Promise<TagResult | null> {
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return null; // tagging switches on once the key is set
  if (!imageUrls.length) return null;

  const client = new Anthropic();
  const vocab = Array.from(new Set([...knownTags, ...VOCAB])).slice(0, 150);

  const content: Anthropic.ContentBlockParam[] = imageUrls.slice(0, 4).map((url) => ({
    type: "image",
    source: { type: "url", url },
  }));
  content.push({
    type: "text",
    text: [
      "This is a design reference a designer saved for inspiration.",
      context.body ? `The post's caption: """${context.body.slice(0, 600)}"""` : "",
      "",
      "Return:",
      "- tags: 3 to 8 lowercase tags naming what a designer would search for later: the screen or pattern type, platform, style and domain. Reuse tags from this list whenever one fits; only invent a tag when none fits.",
      `  List: ${vocab.join(", ")}`,
      "- summary: one plain sentence (under 20 words) saying what the design shows and what stands out about it.",
      "- palette: the 3 to 5 most prominent colours as #rrggbb hex codes.",
    ].filter(Boolean).join("\n"),
  });

  try {
    // Haiku 5.5 has no server-side refusal fallback; a refusal just means no tags for that image.
    const res = await client.messages.create({
      model: TAG_MODEL,
      max_tokens: 8000, // thinking counts toward this; too low and the JSON gets cut off
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason !== "end_turn") {
      console.error(`tagger: stopped with ${res.stop_reason}`);
      if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
    }
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const parsed = JSON.parse(text.text) as TagResult;
    return {
      tags: Array.from(new Set(parsed.tags.map((t) => t.toLowerCase().trim()).filter(Boolean))).slice(0, 8),
      summary: parsed.summary.trim(),
      palette: parsed.palette.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 5),
    };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) console.error("tagger: the Claude API key was rejected");
    else if (err instanceof Anthropic.RateLimitError) console.error("tagger: rate limited");
    else if (err instanceof Anthropic.APIError) console.error(`tagger: API error ${err.status}`, err.message);
    else console.error("tagger:", err);
    return null;
  }
}
