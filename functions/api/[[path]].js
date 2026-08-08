export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // --- 1. API SISWA ---
    if (path === '/api/student/login' && request.method === 'POST') {
      const { studentCode, studentName } = await request.json();
      await env.DB.prepare(
        `INSERT INTO students (code, name) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET name = ?`
      ).bind(studentCode, studentName, studentName).run();
      return new Response(JSON.stringify({ success: true, student: { code: studentCode, name: studentName } }), { headers });
    }

    if (path === '/api/student/score' && request.method === 'POST') {
      const { studentCode, category, score, total, correct } = await request.json();
      const date = new Date().toLocaleString('id-ID');
      await env.DB.prepare(
        `INSERT INTO scores (student_code, category, score, correct, total, date) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(studentCode, category, score, correct, total, date).run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (path === '/api/student/complaint' && request.method === 'POST') {
      const { studentCode, message } = await request.json();
      const date = new Date().toLocaleString('id-ID');
      await env.DB.prepare(
        `INSERT INTO complaints (student_code, message, date) VALUES (?, ?, ?)`
      ).bind(studentCode, message, date).run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // --- 2. API SOAL ---
    if (path === '/api/questions' && request.method === 'GET') {
      const { results } = await env.DB.prepare(`SELECT * FROM questions`).all();
      return new Response(JSON.stringify(results), { headers });
    }

    if (path === '/api/admin/questions' && request.method === 'POST') {
      const { category, questionText, optionA, optionB, optionC, optionD, correctOption } = await request.json();
      await env.DB.prepare(
        `INSERT INTO questions (category, question_text, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(category, questionText, optionA, optionB, optionC, optionD, correctOption).run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (path === '/api/admin/questions' && request.method === 'DELETE') {
      const { id } = await request.json();
      await env.DB.prepare(`DELETE FROM questions WHERE id = ?`).bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // --- 3. API REKAP ---
    if (path === '/api/admin/student-reports' && request.method === 'GET') {
      const { results: students } = await env.DB.prepare(`SELECT * FROM students`).all();
      const { results: scores } = await env.DB.prepare(`SELECT * FROM scores`).all();
      const { results: complaints } = await env.DB.prepare(`SELECT * FROM complaints`).all();

      const reportData = {};
      students.forEach(s => {
        reportData[s.code] = {
          name: s.name,
          scores: scores.filter(sc => sc.student_code === s.code),
          complaints: complaints.filter(c => c.student_code === s.code)
        };
      });
      return new Response(JSON.stringify(reportData), { headers });
    }

    // --- 4. API CHAT AI LILI (GROQ GRATIS TANPA LIMIT) ---
    if (path === '/api/chat' && request.method === 'POST') {
      const { message } = await request.json();
      
      // Gunakan GROQ (gratis, tanpa syarat billing ketat)
      const GROQ_KEY = env.GROQ_API_KEY;

      if (!GROQ_KEY) {
        return new Response(
          JSON.stringify({ reply: "⚠️ Konfigurasi AI belum lengkap. Hubungi admin." }), 
          { status: 503, headers }
        );
      }

      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { 
                role: "system", 
                content: "Kamu adalah Lili, AI Resepsionis dan Guru BK yang ramah, profesional, dan empatik di sebuah sekolah Indonesia. Jawablah pertanyaan siswa dalam Bahasa Indonesia dengan ringkas (maksimal 3 kalimat), suportif, dan menggunakan bahasa yang sopan sesuai norma kesopanan." 
              },
              { role: "user", content: message }
            ],
            temperature: 0.7,
            max_tokens: 300
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Gagal menghubungi server AI');
        }

        const reply = data.choices?.[0]?.message?.content || "Maaf, Lili sedang tidak bisa merespons.";
        return new Response(JSON.stringify({ reply }), { headers });

      } catch (error) {
        console.error("AI Error:", error);
        return new Response(
          JSON.stringify({ reply: `❌ Terjadi gangguan pada AI: ${error.message}` }),
          { status: 500, headers }
        );
      }
    }

    // Default fallback
    return new Response(JSON.stringify({ error: 'Endpoint tidak ditemukan' }), { status: 404, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}