import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();

// 1. Enable CORS for the frontend
app.use('/api/*', cors());

// 2. Health Check
app.get('/api/ping', (c) => {
  return c.json({ status: 'ok', environment: 'cloudflare-workers' });
});

// 3. Get Personnel (All)
app.get('/api/dashboard/personnel', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM personnel ORDER BY id ASC'
    ).all();
    return c.json({ rows: results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 4. Search Pass Requests
app.get('/api/search', async (c) => {
  const query = c.req.query('q');
  if (!query) return c.json({ error: 'Missing query q' }, 400);

  const likeQuery = `%${query}%`;
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM pass_requests 
       WHERE phone LIKE ? 
          OR first_name LIKE ? 
          OR last_name LIKE ? 
          OR plate LIKE ?
       ORDER BY timestamp DESC LIMIT 100`
    )
      .bind(likeQuery, likeQuery, likeQuery, likeQuery)
      .all();
    return c.json({ results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 5. Search Personnel Table (Admin)
app.get('/api/admin/personnel/search', async (c) => {
  const query = c.req.query('q');
  if (!query) return c.json({ error: 'Missing query q' }, 400);

  const likeQuery = `%${query}%`;
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM personnel 
       WHERE first_name LIKE ? 
          OR last_name LIKE ? 
          OR military_id LIKE ? 
          OR phone LIKE ?
       LIMIT 100`
    )
      .bind(likeQuery, likeQuery, likeQuery, likeQuery)
      .all();
    return c.json({ results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 6. CCTV Cameras
app.get('/api/cameras', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM cameras ORDER BY name').all();
    return c.json(results);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/cameras', async (c) => {
  const body = await c.req.json();
  const { id, name, description, lat, lng, type, status } = body;

  try {
    if (id) {
      // Update
      await c.env.DB.prepare(
        `UPDATE cameras SET name=?, description=?, lat=?, lng=?, type=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
      )
        .bind(name, description, lat, lng, type, status, id)
        .run();
      return c.json({ status: 'updated', id });
    } else {
      // Insert
      const result = await c.env.DB.prepare(
        `INSERT INTO cameras (name, description, lat, lng, type, status) VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(name, description, lat, lng, type, status)
        .run();
      return c.json({ status: 'created', id: result.meta.last_row_id });
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 7. File Upload (using R2)
app.post('/api/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'] as File;

  if (!file) return c.json({ error: 'No file uploaded' }, 400);

  const filename = `${Date.now()}-${file.name}`;
  try {
    await c.env.BUCKET.put(filename, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    // Return the R2 Public URL (if configured) or a Worker proxy URL
    return c.json({ url: `/api/files/${filename}`, filename });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 8. Serve Files from R2
app.get('/api/files/:filename', async (c) => {
  const filename = c.req.param('filename');
  const file = await c.env.BUCKET.get(filename);

  if (!file) return c.text('Not Found', 404);

  const headers = new Headers();
  file.writeHttpMetadata(headers);
  headers.set('etag', file.httpEtag);

  return c.body(file.body, 200, { headers });
});

export default app;
