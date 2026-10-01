type AiAssistInput = {
  propertyAddress: string;
  suburb: string;
  evidence: Array<{
    id: string;
    signalCategory: string;
    sourceTitle: string;
    excerpt: string;
    eventDate?: string | null;
    verificationStatus: string;
  }>;
  whyNow: string;
  missingInfo: string[];
};

export type AiAssistResult = {
  summary: string;
  opportunityExplanation: string;
  missingToVerify: string[];
  suggestedNextAction: string;
  usedModel: string;
};

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function generateAiAssist(
  input: AiAssistInput
): Promise<AiAssistResult | { error: string }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { error: "AI is not configured. Set OPENAI_API_KEY to enable." };
  }

  const evidenceBlock = input.evidence
    .map(
      (e) =>
        `- [${e.id}] ${e.signalCategory} | ${e.sourceTitle} | ${e.verificationStatus} | ${e.eventDate ?? "no event date"} | ${e.excerpt}`
    )
    .join("\n");

  const prompt = `You assist commercial property agents researching Western Sydney industrial opportunities.
Use ONLY the supplied evidence. Every factual claim must cite an evidence id like [evid_xxx].
Do not invent ownership, lease details, contacts, or transaction intentions.
Do not output confidence percentages.

Property: ${input.propertyAddress}, ${input.suburb}
Rule-based why-now: ${input.whyNow}
Known gaps: ${input.missingInfo.join("; ") || "none listed"}

Evidence:
${evidenceBlock || "(none)"}

Return JSON with keys: summary, opportunityExplanation, missingToVerify (string array), suggestedNextAction.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a careful research assistant. Never invent facts. Cite evidence ids.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `AI request failed: ${res.status} ${text.slice(0, 200)}` };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { error: "Empty AI response" };
    const parsed = JSON.parse(content) as AiAssistResult;
    return {
      summary: parsed.summary,
      opportunityExplanation: parsed.opportunityExplanation,
      missingToVerify: parsed.missingToVerify ?? [],
      suggestedNextAction: parsed.suggestedNextAction,
      usedModel: data.model || process.env.OPENAI_MODEL || "gpt-4o-mini",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI request failed" };
  }
}
