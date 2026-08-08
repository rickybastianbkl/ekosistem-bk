// FILE: index.js (Cloudflare Worker Entry Point)
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. SERVE STATIC ASSETS
    if (url.pathname === '/' || url.pathname.startsWith('/assets/') || url.pathname.endsWith('.html') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
      let path = url.pathname === '/' ? '/index.html' : url.pathname;
      const asset = await env.ASSETS.fetch(new Request(path));
      return new Response(asset.body, {
        status: asset.status,
        headers: { 'Content-Type': getContentType(path) }
      });
    }

    // API HEALTH
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', time: new Date().toISOString() });
    }

    // AI YU LENI CHAT
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { message } = await request.json();
        const systemPrompt = `Kamu adalah Yu Leni, Konselor Digital Cerdas Sekolah Indonesia. Gaya bicara: Ramah, sabar, menggunakan bahasa Indonesia santun. Tugas: Memberikan motivasi belajar dan managing stress.`;

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message }
            ],
            temperature: 0.7,
            max_tokens: 1024
          })
        });

        const data = await res.json();
        return Response.json({ reply: data.choices[0].message.content });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};
function getContentType(p) { if(p.endsWith('.html')) return 'text/html'; if(p.endsWith('.css')) return 'text/css'; if(p.endsWith('.js')) return 'application/javascript'; return 'text/plain'; }
