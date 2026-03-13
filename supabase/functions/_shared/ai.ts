const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

if (!LOVABLE_API_KEY) {
  console.warn("LOVABLE_API_KEY não configurada. As chamadas de embedding irão falhar.");
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY não configurada");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 768,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Embedding error:", response.status, errorText);
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

