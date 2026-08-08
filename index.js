export default {
  async fetch(request, env, ctx) {
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
      // --- 1. API SISWA (LOGIN, SKOR, KELUHAN) ---
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

      // --- 2. API SOAL (KELOLA SOAL ADMIN & UJIAN SISWA) ---
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

      // --- 3. API REKAP MASTER ADMIN ---
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

      // --- 4. API CHAT AI LILI ---
      if (path === '/api/chat' && request.method === 'POST') {
        const { message } = await request.json();
        const API_KEY = env.GEMINI_API_KEY;
        const MODEL = "gemini-1.5-flash";

        if (!API_KEY) {
          return new Response(JSON.stringify({ reply: "API Key (GEMINI_API_KEY) belum dikonfigurasi di Cloudflare Dashboard." }), { headers });
        }

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: { text: "Kamu adalah Lili, AI Resepsionis dan Guru BK yang ramah, profesional, dan empatik. Jawablah pertanyaan siswa dengan ringkas dan suportif." }
            },
            contents: [{ role: "user", parts: [{ text: message }] }]
          })
        });

        const data = await res.json();

        if (!res.ok) {
          const errorMsg = data.error?.message || "Gagal menghubungi Google AI.";
          return new Response(JSON.stringify({ reply: `[Gemini Error]: ${errorMsg}` }), { headers });
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, Lili tidak dapat merespons saat ini.";
        return new Response(JSON.stringify({ reply }), { headers });
      }

      // Jika bukan URL API, layani file tampilan dari folder public/
      return env.ASSETS.fetch(request);

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }
};