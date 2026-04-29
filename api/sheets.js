const { fetchAllSheetRows, fetchSheetRows, normalizeBranch, sendJson } = require('./_lib');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    const branch = req.query.branch ? normalizeBranch(req.query.branch) : '';
    const force = String(req.query.force || '') === '1';
    if (branch) {
      const data = await fetchSheetRows(branch, force);
      return sendJson(res, 200, { ok: true, ...data });
    }
    const rows = await fetchAllSheetRows(force);
    return sendJson(res, 200, { ok: true, rows, rowCount: rows.length, lastSync: new Date().toISOString() });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message || 'Sheet API failed' });
  }
};
