const { ACCESS_USERS_ENDPOINT, postJsonText, sendJson } = require('./_lib');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

function normalizeUser(row) {
  const rawPages = row.Pages ?? row.pages ?? '';
  const rawBranches = row.Branches ?? row.branches ?? '';
  return {
    id: row.ID || row.Id || row.id || `usr_${String(row.Email || row.email || '').toLowerCase()}`,
    name: row.Name || row.name || '',
    email: String(row.Email || row.email || '').trim().toLowerCase(),
    password: row.Password || row.password || '',
    pages: Array.isArray(rawPages) ? rawPages : String(rawPages || '').split('|').map(x => x.trim()).filter(Boolean),
    branches: Array.isArray(rawBranches) ? rawBranches : String(rawBranches || '').split('|').map(x => x.trim()).filter(Boolean),
    createdAt: row.CreatedAt || row.createdAt || '',
    updatedAt: row.UpdatedAt || row.updatedAt || ''
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const response = await fetch(ACCESS_USERS_ENDPOINT, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Users fetch failed: ${response.status}`);
      const text = await response.text();
      const rows = JSON.parse(text || '[]');
      return sendJson(res, 200, { ok: true, users: rows.map(normalizeUser).filter(u => u.email) });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const result = await postJsonText(ACCESS_USERS_ENDPOINT, body);
      return sendJson(res, 200, { ok: true, result });
    }
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message || 'Users API failed' });
  }
};
