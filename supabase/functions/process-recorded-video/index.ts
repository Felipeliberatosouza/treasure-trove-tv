import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBase64, title, mimeType } = await req.json();

    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "audioBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const audioDataUrl = `data:${mimeType || "audio/webm"};base64,${audioBase64}`;

    // Step 1: Transcribe audio with timestamps
    console.log("Starting transcription...");
    const transcriptionResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Transcreva este áudio em português brasileiro com timestamps precisos. Divida em segmentos curtos de 3-8 segundos cada.`,
                },
                {
                  type: "image_url",
                  image_url: { url: audioDataUrl },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "transcription_result",
                description: "Return transcription segments with timestamps",
                parameters: {
                  type: "object",
                  properties: {
                    segments: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          start: { type: "number", description: "Start time in seconds" },
                          end: { type: "number", description: "End time in seconds" },
                          text: { type: "string", description: "Transcribed text" },
                        },
                        required: ["start", "end", "text"],
                      },
                    },
                  },
                  required: ["segments"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "transcription_result" } },
        }),
      }
    );

    if (!transcriptionResponse.ok) {
      const status = transcriptionResponse.status;
      const errText = await transcriptionResponse.text();
      console.error("Transcription error:", status, errText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione fundos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Transcription failed: ${status}`);
    }

    const transcriptionData = await transcriptionResponse.json();
    let segments: { start: number; end: number; text: string }[] = [];

    try {
      const toolCall = transcriptionData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const parsed = JSON.parse(toolCall.function.arguments);
        segments = parsed.segments || [];
      }
    } catch (e) {
      console.error("Failed to parse transcription:", e);
      // Fallback: try to get text content
      const textContent = transcriptionData.choices?.[0]?.message?.content;
      if (textContent) {
        segments = [{ start: 0, end: 10, text: textContent }];
      }
    }

    console.log(`Transcription complete: ${segments.length} segments`);

    // Step 2: Extract impact words from transcription
    const fullText = segments.map((s) => s.text).join(" ");

    let impactWords: { word: string; timestamp: number; duration: number }[] = [];

    if (fullText.trim()) {
      console.log("Extracting impact words...");
      const impactResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "user",
                content: `Analise esta transcrição de uma aula chamada "${title}" e extraia as 8-12 palavras ou termos-chave mais importantes que reforçam o conteúdo educacional. Para cada palavra, indique o momento (em segundos) em que ela é mencionada e por quantos segundos ela deve ficar visível (mínimo 4 segundos). Distribua as palavras ao longo de toda a duração do vídeo.\n\nTranscrição: ${JSON.stringify(segments)}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "impact_words_result",
                  description: "Return impact words with timestamps",
                  parameters: {
                    type: "object",
                    properties: {
                      words: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            word: { type: "string" },
                            timestamp: { type: "number" },
                            duration: { type: "number" },
                          },
                          required: ["word", "timestamp", "duration"],
                        },
                      },
                    },
                    required: ["words"],
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "impact_words_result" } },
          }),
        }
      );

      if (impactResponse.ok) {
        const impactData = await impactResponse.json();
        try {
          const toolCall = impactData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const parsed = JSON.parse(toolCall.function.arguments);
            impactWords = parsed.words || [];
          }
        } catch (e) {
          console.error("Failed to parse impact words:", e);
        }
      } else {
        console.error("Impact words extraction failed:", impactResponse.status);
        await impactResponse.text(); // consume body
      }

      console.log(`Impact words extracted: ${impactWords.length}`);
    }

    // Generate WebVTT subtitles
    let vtt = "WEBVTT\n\n";
    segments.forEach((seg, i) => {
      vtt += `${i + 1}\n${formatVttTime(seg.start)} --> ${formatVttTime(seg.end)}\n${seg.text}\n\n`;
    });

    return new Response(
      JSON.stringify({
        segments,
        impactWords,
        subtitlesVtt: vtt,
        fullText,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("Process video error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Processing failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
