const SHEET_URLS = {
  GGR: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRQNADKu7K0WHsFCb9lS624muJl6kPwNHVL9gAShBwz_mNiN9vlV258InPu0mRuosLnC67hpDuFcUfq/pub?output=csv',
  LKN: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ5c9qNYGNCZ6Wzgxy1kdmuWdpyFnxbWr0_gRObDLetfGXQ2iph8dhYzcR_EKE5K0eilhAA63lz3Cbj/pub?output=csv',
  AMD: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSQWQ4tqEWR26vaTGCd1_UlUuVQi2RJAAmlltj-ZN-9ioFa3t68-L4ebKfIhf5-fP06qDgV843krEpv/pub?output=csv'
};

const WRITE_ENDPOINTS = {
  GGR: 'https://script.google.com/macros/s/AKfycby0OJKlqCHXxoor9s8lSNeekdriODwhTycMfV69OWU_Qu3kQoWCVMGo8AeDl8DWtPnJ/exec',
  LKN: 'https://script.google.com/macros/s/AKfycbwQi9jVXPKNprC2sf8cLN8yeevM5ebjuFmZnbD2zu9BqcopaVv1WTaijL_G_4ZoU5tN/exec',
  AMD: 'https://script.google.com/macros/s/AKfycbyIxXLC1fB_X7IE-VImmvW6ZGpwGP3itmrqjm7gCKm3uCQTAvSnVlKf8ybrVHwTMuSu/exec'
};

const ACCESS_USERS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxg3QnCx4EWL8nSz_HD1woL5VteQ1w7PQQNGWTy42HFp0tmVvbaQo7KTpS5R7fqiHutZQ/exec';
const CACHE_TTL_MS = 30000;

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(data));
}

function sendOptions(res) {
  res.statusCode = 204;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end();
}

function normalizeBranch(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'GGR' || raw.includes('GURGAON')) return 'GGR';
  if (raw === 'LKN' || raw.includes('LUCKNOW')) return 'LKN';
  if (raw === 'AMD' || raw.includes('AHMEDABAD')) return 'AMD';
  return raw || 'GGR';
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < String(text || '').length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell);
      if (row.some(v => String(v || '').trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some(v => String(v || '').trim())) rows.push(row);
  return rows;
}

function cleanHeader(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function first(row, headers, names, fallbackIndex) {
  for (const name of names) {
    const idx = headers.indexOf(cleanHeader(name));
    if (idx >= 0 && row[idx] != null && String(row[idx]).trim()) return String(row[idx]).trim();
  }
  if (fallbackIndex != null && row[fallbackIndex] != null) return String(row[fallbackIndex]).trim();
  return '';
}

function toNumber(value) {
  const n = Number.parseInt(String(value || '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function mapRows(grid, branch) {
  if (!Array.isArray(grid) || grid.length < 2) return [];
  const headerIndex = grid.findIndex(row => {
    const cleaned = row.map(cleanHeader);
    return cleaned.includes('candidate') && (cleaned.includes('recruiter') || cleaned.includes('teamlead'));
  });
  const start = headerIndex >= 0 ? headerIndex : 0;
  const headers = grid[start].map(cleanHeader);
  return grid.slice(start + 1).map((row, i) => {
    const name = first(row, headers, ['Candidate', 'Candidate Name', 'Name'], 0);
    if (!name) return null;
    return {
      n: name,
      rec: first(row, headers, ['Recruiter', 'Assign Recruiter'], 1),
      tl: first(row, headers, ['Team Lead', 'TL'], 2),
      st: first(row, headers, ['Status'], 3) || 'Active',
      exp: first(row, headers, ['Experience', 'Experience Years'], 4),
      tech: first(row, headers, ['Technology', 'Technology Role', 'Role'], 5),
      visa: first(row, headers, ['Visa', 'Visa Status', 'Visa Type'], 6),
      eadStart: first(row, headers, ['EAD Start Date', 'EAD Start'], 7),
      ead: first(row, headers, ['EAD End Date', 'EAD Expiry', 'EAD'], 8),
      expIn: first(row, headers, ['Expiring In', 'Expiry In'], 9),
      vcs: first(row, headers, ['VCS SST', 'VCS / SST', 'VCS', 'SST'], 10),
      ack: first(row, headers, ['Ack Email', 'Acknowledgement Email'], 11),
      loc: first(row, headers, ['Location'], 12),
      mkt: first(row, headers, ['Marketing Start Date', 'Marketing Start'], 13),
      days: toNumber(first(row, headers, ['Days', 'Marketing Days'], 14)),
      email: first(row, headers, ['Candidate Email Address', 'Email', 'Email ID'], 15),
      phone: first(row, headers, ['Phone Number', 'Contact Number', 'Phone'], 16),
      src: normalizeBranch(first(row, headers, ['Branch'], 17) || branch),
      _id: `${normalizeBranch(branch)}_${i}_${name}`
    };
  }).filter(Boolean);
}

async function fetchSheetRows(branch, force) {
  const src = normalizeBranch(branch);
  const cache = globalThis.__vizvaSheetCache || (globalThis.__vizvaSheetCache = {});
  const cached = cache[src];
  if (!force && cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached;
  const url = SHEET_URLS[src];
  if (!url) throw new Error(`Unknown branch: ${src}`);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);
  const csv = await response.text();
  const rows = mapRows(parseCsv(csv), src);
  const payload = { branch: src, rows, rowCount: rows.length, lastSync: new Date().toISOString(), ts: Date.now() };
  cache[src] = payload;
  return payload;
}

async function fetchAllSheetRows(force) {
  const branches = await Promise.all(Object.keys(SHEET_URLS).map(branch => fetchSheetRows(branch, force)));
  return branches.flatMap(b => b.rows);
}

function candidatePayload(profile) {
  const branch = normalizeBranch(profile?.src || profile?.branch || profile?.br);
  return {
    candidate: profile?.n || profile?.candidate || '',
    recruiter: profile?.rec || profile?.recruiter || '',
    teamLead: profile?.tl || profile?.teamLead || '',
    status: profile?.st || profile?.status || '',
    experience: profile?.exp || profile?.experience || '',
    technology: profile?.tech || profile?.technology || '',
    visa: profile?.visa || profile?.visaStatus || '',
    eadStartDate: profile?.eadStart || profile?.eadStartDate || '',
    eadEndDate: profile?.ead || profile?.eadEndDate || '',
    expiringIn: profile?.expIn ?? profile?.expiringIn ?? '',
    vcsSst: profile?.vcs || profile?.vcsSst || '',
    ackEmail: profile?.ack || profile?.ackEmail || '',
    location: profile?.loc || profile?.location || '',
    marketingStartDate: profile?.mkt || profile?.marketingStartDate || '',
    days: profile?.days ?? '',
    candidateEmailAddress: profile?.email || profile?.candidateEmailAddress || '',
    phoneNumber: profile?.phone || profile?.phoneNumber || '',
    branch
  };
}

function normText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normPhone(value) {
  return String(value || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
}

function findDuplicate(rows, payload) {
  const name = normText(payload.candidate);
  const email = normText(payload.candidateEmailAddress);
  const phone = normPhone(payload.phoneNumber);
  if (!name || (!email && !phone)) return null;
  return rows.find(row => {
    if (normText(row.n) !== name) return false;
    return (email && normText(row.email) === email) || (phone && normPhone(row.phone) === phone);
  }) || null;
}

async function postJsonText(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload || {})
  });
  const text = await response.text().catch(() => '');
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch (_) {}
  if (!response.ok) throw new Error(parsed?.error || text || `POST failed: ${response.status}`);
  if (parsed && parsed.ok === false) throw new Error(parsed.error || 'Remote write failed');
  return parsed || { ok: true, raw: text };
}

module.exports = {
  ACCESS_USERS_ENDPOINT,
  WRITE_ENDPOINTS,
  candidatePayload,
  fetchAllSheetRows,
  fetchSheetRows,
  findDuplicate,
  normalizeBranch,
  postJsonText,
  sendOptions,
  sendJson
};
