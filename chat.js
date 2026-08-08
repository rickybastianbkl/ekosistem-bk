export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { message } = await request.json();

    // Mengambil API Key rahasia dari environment Cloudflare
    const API_KEY = env.GEMINI_API_KEY;
    const MODEL = "gemini-1.5-flash";

    if (!API_KEY) {
      return new Response(JSON.stringify({ reply: "API Key belum dikonfigurasi di server." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Panggil API Google Gemini dari Backend
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: { text: "Kamu adalah Lili, AI Resepsionis dan Guru BK yang ramah, profesional, dan empatik. Jawablah pertanyaan siswa dengan ringkas dan suportif." }
        },
        contents: [{ role: "user", parts: [{ text: message }] }],
        tools: [{ googleSearch: {} }]
      })
    });

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, Lili tidak dapat merespons saat ini.";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ reply: "Terjadi kesalahan pada server backend AI." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}