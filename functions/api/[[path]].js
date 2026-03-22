// functions/api/[[path]].js

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 所有 /api/ 開頭的路由
    if (!pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'Not Found' }, 404, corsHeaders);
    }

    // 公開路由：登入
    if (pathname === '/api/login' && method === 'POST') {
      return await login(request, env.DB, corsHeaders);
    }

    // 以下都需要驗證身份
    const session = await authenticate(request, env.DB);
    if (!session) {
      return jsonResponse({ error: '未登录' }, 401, corsHeaders);
    }

    // 登出
    if (pathname === '/api/logout' && method === 'POST') {
      return await logout(request, env.DB, corsHeaders);
    }

    // 取得當前使用者資訊
    if (pathname === '/api/me' && method === 'GET') {
      return jsonResponse({ id: session.user_id, username: session.username }, 200, corsHeaders);
    }

    // 取得所有使用者
    if (pathname === '/api/users' && method === 'GET') {
      return await getUsers(env.DB, corsHeaders);
    }

    // 筆記相關
    if (pathname === '/api/notes') {
      if (method === 'GET') {
        return await getNotes(env.DB, corsHeaders);
      }
      if (method === 'POST') {
        return await createNote(request, env.DB, corsHeaders, session.user_id);
      }
    }

    // 單筆筆記： /api/notes/123
    const noteMatch = pathname.match(/^\/api\/notes\/(\d+)$/);
    if (noteMatch) {
      const id = parseInt(noteMatch[1], 10);

      if (method === 'PUT') {
        return await updateNote(id, request, env.DB, corsHeaders);
      }
      if (method === 'DELETE') {
        return await deleteNote(id, env.DB, corsHeaders);
      }
    }

    return jsonResponse({ error: 'Not Found' }, 404, corsHeaders);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: err.message || 'Internal Server Error' }, 500, corsHeaders);
  }
}

// ────────────────────────────────────────────────
// 輔助函式（保持原樣）
// ────────────────────────────────────────────────

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function parseCookies(request) {
  const cookie = request.headers.get('Cookie') || '';
  const pairs = {};
  cookie.split(';').forEach(pair => {
    const [key, ...rest] = pair.trim().split('=');
    if (key) pairs[key] = rest.join('=');
  });
  return pairs;
}

async function authenticate(request, db) {
  const cookies = parseCookies(request);
  const token = cookies['session_token'];
  if (!token) return null;

  const row = await db
    .prepare(
      'SELECT sessions.user_id, users.username FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ?'
    )
    .bind(token)
    .first();

  return row || null;
}

async function login(request, db, corsHeaders) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return jsonResponse({ error: '請輸入用戶名和密碼' }, 400, corsHeaders);
  }

  const user = await db
    .prepare('SELECT id, username FROM users WHERE username = ? AND password = ?')
    .bind(username, password)
    .first();

  if (!user) {
    return jsonResponse({ error: '用戶名和密碼錯誤' }, 401, corsHeaders);
  }

  const token = generateToken();
  await db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').bind(token, user.id).run();

  return new Response(JSON.stringify({ id: user.id, username: user.username }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `session_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`,
      ...corsHeaders,
    },
  });
}

async function logout(request, db, corsHeaders) {
  const cookies = parseCookies(request);
  const token = cookies['session_token'];
  if (token) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
      ...corsHeaders,
    },
  });
}

async function getUsers(db, corsHeaders) {
  const { results } = await db.prepare('SELECT id, username, created_at FROM users').all();
  return jsonResponse(results, 200, corsHeaders);
}

async function getNotes(db, corsHeaders) {
  const { results } = await db
    .prepare(
      `SELECT notes.id, notes.title, notes.content, notes.user_id,
              users.username, notes.created_at, notes.updated_at
       FROM notes
       JOIN users ON notes.user_id = users.id
       ORDER BY notes.updated_at DESC`
    )
    .all();
  return jsonResponse(results, 200, corsHeaders);
}

async function createNote(request, db, corsHeaders, userId) {
  const { title, content } = await request.json();
  if (!title) {
    return jsonResponse({ error: 'title is required' }, 400, corsHeaders);
  }

  const result = await db
    .prepare('INSERT INTO notes (title, content, user_id) VALUES (?, ?, ?)')
    .bind(title, content || '', userId)
    .run();

  return jsonResponse(
    { id: result.meta.last_row_id, title, content, user_id: userId },
    201,
    corsHeaders
  );
}

async function updateNote(id, request, db, corsHeaders) {
  const { title, content } = await request.json();
  if (!title) {
    return jsonResponse({ error: 'title is required' }, 400, corsHeaders);
  }

  await db
    .prepare("UPDATE notes SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(title, content || '', id)
    .run();

  return jsonResponse({ id, title, content }, 200, corsHeaders);
}

async function deleteNote(id, db, corsHeaders) {
  await db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true }, 200, corsHeaders);
}
