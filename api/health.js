const { sendJson } = require('./_lib');

module.exports = function handler(req, res) {
  return sendJson(res, 200, {
    ok: true,
    service: 'vizva-dashboard-api',
    time: new Date().toISOString()
  });
};
