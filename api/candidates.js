const {
  WRITE_ENDPOINTS,
  candidatePayload,
  fetchAllSheetRows,
  findDuplicate,
  normalizeBranch,
  postJsonText,
  sendJson
} = require('./_lib');

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

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    const body = await readBody(req);
    const profile = body.profile || body;
    const payload = candidatePayload(profile);
    const branch = normalizeBranch(payload.branch);
    if (!payload.candidate) return sendJson(res, 400, { ok: false, error: 'Candidate name is required' });
    const rows = await fetchAllSheetRows(true);
    const duplicate = findDuplicate(rows, payload);
    if (duplicate) {
      return sendJson(res, 409, { ok: false, duplicate: true, error: 'Duplicate candidate found', match: duplicate });
    }
    const endpoint = WRITE_ENDPOINTS[branch];
    if (!endpoint) return sendJson(res, 400, { ok: false, error: `No write endpoint configured for ${branch}` });
    const remote = await postJsonText(endpoint, payload);
    if (globalThis.__vizvaSheetCache) delete globalThis.__vizvaSheetCache[branch];
    return sendJson(res, 200, { ok: true, branch, remote });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message || 'Candidate API failed' });
  }
};
