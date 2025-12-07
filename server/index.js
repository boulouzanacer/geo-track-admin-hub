import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// Load .env and override any existing conflicting env vars
dotenv.config({ override: true });

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Simple JSON config storage for runtime keys
const CONFIG_PATH = path.resolve(process.cwd(), 'server', 'config.json');
function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch (_) {
    return {};
  }
}
function writeConfig(obj) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(obj, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }
  next();
}

// --- API Routes FIRST ---
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from server!" });
});

app.get('/api/health', async (_req, res) => { 
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, rows });
  } catch (err) {
    console.error('Database error:', err); // <-- Log full error
    res.status(500).json({ 
      ok: false, 
      error: (err && err.message) || 'Unknown error' 
    });
  }
});


// Lightweight readiness endpoint that does not touch the database
app.get('/api/ready', (_req, res) => {
  res.json({ ok: true });
});

// Clients listing endpoint mapped to user shape for UI compatibility
app.get('/api/users', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT client_id AS id, username AS name, phone_number AS email,
              statut, last_login, nbr_phones, expire_date
         FROM clients
         ORDER BY username`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Phones listing endpoint with joined client username, mapped to UI fields
app.get('/api/phones', authMiddleware, async (req, res) => {
  try {
    const isAdmin = !!req.user?.is_admin;
    const currentClientId = req.user?.client_id;
    const requestedUserId = req.query.user_id ? String(req.query.user_id) : null;

    // Build base query and params depending on role
    let sql = `SELECT p.phone_id AS id,
                      p.phone_id,
                      p.phone_name AS name,
                      p.client_id AS user_id,
                      p.last_update,
                      c.username AS user_name
                 FROM phones p
                 LEFT JOIN clients c ON c.client_id = p.client_id`;
    const params = [];

    if (isAdmin) {
      if (requestedUserId) {
        sql += ` WHERE p.client_id = ?`;
        params.push(requestedUserId);
      }
    } else {
      sql += ` WHERE p.client_id = ?`;
      params.push(currentClientId);
    }

    sql += ` ORDER BY p.last_update DESC`;

    const [rows] = await pool.query(sql, params);
    const mapped = rows.map((r) => ({
      id: r.id,
      phone_id: r.phone_id,
      name: r.name,
      user_id: r.user_id,
      last_update: r.last_update,
      users: { name: r.user_name },
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Create phone
app.post('/api/phones', authMiddleware, adminOnly, async (req, res) => {
  const { phone_id, name, user_id } = req.body || {};
  if (!phone_id || !name || !user_id) {
    return res.status(400).json({ error: 'phone_id, name, user_id are required' });
  }
  try {
    await pool.query(
      'INSERT INTO phones (phone_id, phone_name, client_id, last_update) VALUES (?, ?, ?, NOW())',
      [phone_id, name, user_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Update phone name
app.put('/api/phones/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    // Owner or admin check
    const [rows] = await pool.query('SELECT client_id FROM phones WHERE phone_id = ? LIMIT 1', [id]);
    const row = rows[0];
    const isAdmin = !!req.user?.is_admin;
    const currentClientId = req.user?.client_id;
    if (!row) return res.status(404).json({ error: 'Phone not found' });
    if (!isAdmin && String(row.client_id) !== String(currentClientId)) {
      return res.status(403).json({ error: 'Forbidden: cannot modify another user’s phone' });
    }

    const [result] = await pool.query('UPDATE phones SET phone_name = ? WHERE phone_id = ?', [name, id]);
    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Delete phone
app.delete('/api/phones/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    // Owner or admin check
    const [rows] = await pool.query('SELECT client_id FROM phones WHERE phone_id = ? LIMIT 1', [id]);
    const row = rows[0];
    const isAdmin = !!req.user?.is_admin;
    const currentClientId = req.user?.client_id;
    if (!row) return res.status(404).json({ error: 'Phone not found' });
    if (!isAdmin && String(row.client_id) !== String(currentClientId)) {
      return res.status(403).json({ error: 'Forbidden: cannot delete another user’s phone' });
    }

    await pool.query('DELETE FROM locations WHERE phone_id = ?', [id]);
    const [result] = await pool.query('DELETE FROM phones WHERE phone_id = ?', [id]);
    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Locations endpoints
app.get('/api/locations', async (req, res) => {
  const { phone_id, limit = 100 } = req.query;
  if (!phone_id) return res.status(400).json({ error: 'phone_id is required' });
  try {
    const [rows] = await pool.query(
      'SELECT phone_id, latitude, longitude, date_time FROM locations WHERE phone_id = ? ORDER BY date_time DESC LIMIT ?',
      [phone_id, Number(limit)]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

app.get('/api/locations/latest', async (req, res) => {
  const { phone_id } = req.query;
  if (!phone_id) return res.status(400).json({ error: 'phone_id is required' });
  try {
    const [rows] = await pool.query(
      'SELECT phone_id, latitude, longitude, date_time AS timestamp FROM locations WHERE phone_id = ? ORDER BY date_time DESC LIMIT 1',
      [phone_id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// BON (sales/orders) endpoints
// List of sales (BON1) by phone_id
app.get('/api/bon/ventes', async (req, res) => {
  const { phone_id } = req.query;
  if (!phone_id) return res.status(400).json({ error: 'phone_id is required' });
  try {
    const [rows] = await pool.query(
      `SELECT NUM_BON, CODE_CLIENT, CODE_CLIENT AS NOM_CLIENT, DATE_BON, HEURE, TOT_HT, VERSER, LIVRER, CODE_DEPOT, BLOCAGE
         FROM BON1
         WHERE phone_id = ?
         ORDER BY DATE_BON DESC, HEURE DESC`,
      [phone_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[api] /api/bon/ventes error:', err);
    if (err && (err.code === 'ER_NO_SUCH_TABLE' || err.errno === 1146 || err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054)) {
      // Gracefully handle missing tables by returning an empty list
      return res.json([]);
    }
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Sales (BON2) line items by NUM_BON with header from BON1
app.get('/api/bon/ventes/:num_bon', async (req, res) => {
  const { num_bon } = req.params;
  if (!num_bon) return res.status(400).json({ error: 'num_bon is required' });
  try {
    const [headerRows] = await pool.query('SELECT *, CODE_CLIENT AS NOM_CLIENT FROM BON1 WHERE NUM_BON = ?', [num_bon]);
    const [itemRows] = await pool.query(
      `SELECT RECORDID, CODE_BARRE, NUM_BON, PRODUIT, NBRE_COLIS, COLISSAGE, QTE_GRAT, QTE, PV_HT, PA_HT, DESTOCK_TYPE, DESTOCK_CODE_BARRE, DESTOCK_QTE, TVA, CODE_DEPOT
         FROM BON2
         WHERE NUM_BON = ?
         ORDER BY RECORDID ASC`,
      [num_bon]
    );
    res.json({ header: headerRows[0] || null, items: itemRows });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// List of commandes (BON1_TEMP) by phone_id
app.get('/api/bon/commandes', async (req, res) => {
  const { phone_id } = req.query;
  if (!phone_id) return res.status(400).json({ error: 'phone_id is required' });
  try {
    const [rows] = await pool.query(
      `SELECT NUM_BON, CODE_CLIENT, CODE_CLIENT AS NOM_CLIENT, DATE_BON, HEURE, TOT_HT, VERSER, LIVRER, CODE_DEPOT, BLOCAGE
         FROM BON1_TEMP
         WHERE phone_id = ?
         ORDER BY DATE_BON DESC, HEURE DESC`,
      [phone_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[api] /api/bon/commandes error:', err);
    if (err && (err.code === 'ER_NO_SUCH_TABLE' || err.errno === 1146 || err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054)) {
      // Gracefully handle missing tables by returning an empty list
      return res.json([]);
    }
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Commandes (BON2_TEMP) line items by NUM_BON with header from BON1_TEMP
app.get('/api/bon/commandes/:num_bon', async (req, res) => {
  const { num_bon } = req.params;
  if (!num_bon) return res.status(400).json({ error: 'num_bon is required' });
  try {
    const [headerRows] = await pool.query('SELECT *, CODE_CLIENT AS NOM_CLIENT FROM BON1_TEMP WHERE NUM_BON = ?', [num_bon]);
    const [itemRows] = await pool.query(
      `SELECT RECORDID, CODE_BARRE, NUM_BON, PRODUIT, NBRE_COLIS, COLISSAGE, QTE_GRAT, QTE, PV_HT, PA_HT, DESTOCK_TYPE, DESTOCK_CODE_BARRE, DESTOCK_QTE, TVA, CODE_DEPOT
         FROM BON2_TEMP
         WHERE NUM_BON = ?
         ORDER BY RECORDID ASC`,
      [num_bon]
    );
    res.json({ header: headerRows[0] || null, items: itemRows });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Sync endpoint: ingest device info, BON1/BON2 and BON1_TEMP/BON2_TEMP
app.post('/api/bon/sync', async (req, res) => {
  const payload = req.body || {};
  const device = payload.device || {};
  const device_id = device.device_id || device.phone_id || null;
  if (!device_id) return res.status(400).json({ error: 'device_id is required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Ensure a client exists for device syncing (placeholder client)
    const [clientRows] = await conn.query('SELECT client_id FROM clients WHERE username = ? LIMIT 1', ['device_sync']);
    let clientId = clientRows && clientRows[0] && clientRows[0].client_id ? Number(clientRows[0].client_id) : null;
    if (!clientId) {
      const [ins] = await conn.query(
        `INSERT INTO clients (username, password, full_name, email, is_admin, statut, last_login, nbr_phones)
         VALUES ('device_sync', 'sync', 'Device Sync', NULL, 0, 'active', NOW(), 0)`
      );
      clientId = ins.insertId;
    }

    // Ensure phone exists (ne pas écraser phone_name ni client_id si déjà présent)
    const phoneName = device.name || device.device_name || 'Device';
    await conn.query(
      `INSERT INTO phones (phone_id, phone_name, client_id, last_update)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE last_update = NOW()`,
      [device_id, phoneName, clientId]
    );

    // Record latest location, if provided
    if (device.latitude != null && device.longitude != null) {
      const ts = device.timestamp || new Date();
      await conn.query(
        'INSERT INTO locations (phone_id, latitude, longitude, date_time) VALUES (?, ?, ?, ?)',
        [device_id, Number(device.latitude), Number(device.longitude), ts]
      );
    }

    let updatedBon1 = 0;
    let insertedBon2 = 0;
    let updatedBon1Temp = 0;
    let insertedBon2Temp = 0;

    const headersSql = `INSERT INTO BON1 (NUM_BON, CODE_CLIENT, DATE_BON, HEURE, NBR_P, TOT_QTE, MODE_TARIF, CODE_DEPOT, MODE_RG,
                        CODE_VENDEUR, TOT_HT, TOT_TVA, TIMBRE, TIMBRE_CHECK, LATITUDE, LONGITUDE, REMISE,
                        MONTANT_ACHAT, ANCIEN_SOLDE, EXPORTATION, BLOCAGE, VERSER, LIVRER, DATE_LIV,
                        IS_IMPORTED, IS_EXPORTED, phone_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE CODE_CLIENT=VALUES(CODE_CLIENT), DATE_BON=VALUES(DATE_BON), HEURE=VALUES(HEURE),
                        NBR_P=VALUES(NBR_P), TOT_QTE=VALUES(TOT_QTE), MODE_TARIF=VALUES(MODE_TARIF), CODE_DEPOT=VALUES(CODE_DEPOT), MODE_RG=VALUES(MODE_RG),
                        CODE_VENDEUR=VALUES(CODE_VENDEUR), TOT_HT=VALUES(TOT_HT), TOT_TVA=VALUES(TOT_TVA), TIMBRE=VALUES(TIMBRE), TIMBRE_CHECK=VALUES(TIMBRE_CHECK),
                        LATITUDE=VALUES(LATITUDE), LONGITUDE=VALUES(LONGITUDE), REMISE=VALUES(REMISE), MONTANT_ACHAT=VALUES(MONTANT_ACHAT), ANCIEN_SOLDE=VALUES(ANCIEN_SOLDE),
                        EXPORTATION=VALUES(EXPORTATION), BLOCAGE=VALUES(BLOCAGE), VERSER=VALUES(VERSER), LIVRER=VALUES(LIVRER), DATE_LIV=VALUES(DATE_LIV),
                        IS_IMPORTED=VALUES(IS_IMPORTED), IS_EXPORTED=VALUES(IS_EXPORTED), phone_id=VALUES(phone_id)`;

    const itemsSql = `INSERT INTO BON2 (CODE_BARRE, NUM_BON, PRODUIT, NBRE_COLIS, COLISSAGE, QTE_GRAT, QTE, PV_HT, PA_HT, DESTOCK_TYPE, DESTOCK_CODE_BARRE, DESTOCK_QTE, TVA, CODE_DEPOT)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    for (const bon of (payload.bon1 || [])) {
      const h = bon && bon.header ? bon.header : {};
      if (!h.NUM_BON) continue;
      const params = [
        h.NUM_BON,
        h.CODE_CLIENT || null,
        h.DATE_BON || null,
        h.HEURE || null,
        h.NBR_P ?? null,
        h.TOT_QTE ?? null,
        h.MODE_TARIF || null,
        h.CODE_DEPOT || null,
        h.MODE_RG || null,
        h.CODE_VENDEUR || null,
        h.TOT_HT ?? null,
        h.TOT_TVA ?? null,
        h.TIMBRE ?? null,
        h.TIMBRE_CHECK || null,
        (h.LATITUDE != null ? Number(h.LATITUDE) : 0),
        (h.LONGITUDE != null ? Number(h.LONGITUDE) : 0),
        h.REMISE ?? null,
        h.MONTANT_ACHAT ?? null,
        h.ANCIEN_SOLDE ?? null,
        h.EXPORTATION || null,
        h.BLOCAGE || null,
        h.VERSER ?? null,
        h.LIVRER ?? 0,
        h.DATE_LIV || null,
        h.IS_IMPORTED ?? 0,
        h.IS_EXPORTED ?? 0,
        device_id,
      ];
      const [resHeader] = await conn.query(headersSql, params);
      updatedBon1 += resHeader.affectedRows ? 1 : 0;

      // Replace items for this NUM_BON
      await conn.query('DELETE FROM BON2 WHERE NUM_BON = ?', [h.NUM_BON]);
      for (const it of (bon.items || [])) {
        const p = [
          it.CODE_BARRE || null,
          h.NUM_BON,
          it.PRODUIT || null,
          it.NBRE_COLIS ?? null,
          it.COLISSAGE ?? null,
          it.QTE_GRAT ?? null,
          it.QTE ?? 0,
          it.PV_HT ?? null,
          it.PA_HT ?? null,
          it.DESTOCK_TYPE || null,
          it.DESTOCK_CODE_BARRE || null,
          it.DESTOCK_QTE ?? null,
          it.TVA ?? null,
          it.CODE_DEPOT || h.CODE_DEPOT || null,
        ];
        await conn.query(itemsSql, p);
        insertedBon2 += 1;
      }
    }

    const headersTempSql = `INSERT INTO BON1_TEMP (NUM_BON, CODE_CLIENT, DATE_BON, HEURE, NBR_P, TOT_QTE, MODE_TARIF, CODE_DEPOT, MODE_RG,
                           CODE_VENDEUR, TOT_HT, TOT_TVA, TIMBRE, TIMBRE_CHECK, LATITUDE, LONGITUDE, REMISE,
                           MONTANT_ACHAT, ANCIEN_SOLDE, EXPORTATION, BLOCAGE, VERSER, LIVRER, DATE_LIV,
                           IS_IMPORTED, IS_EXPORTED, phone_id)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                           ON DUPLICATE KEY UPDATE CODE_CLIENT=VALUES(CODE_CLIENT), DATE_BON=VALUES(DATE_BON), HEURE=VALUES(HEURE),
                           NBR_P=VALUES(NBR_P), TOT_QTE=VALUES(TOT_QTE), MODE_TARIF=VALUES(MODE_TARIF), CODE_DEPOT=VALUES(CODE_DEPOT), MODE_RG=VALUES(MODE_RG),
                           CODE_VENDEUR=VALUES(CODE_VENDEUR), TOT_HT=VALUES(TOT_HT), TOT_TVA=VALUES(TOT_TVA), TIMBRE=VALUES(TIMBRE), TIMBRE_CHECK=VALUES(TIMBRE_CHECK),
                           LATITUDE=VALUES(LATITUDE), LONGITUDE=VALUES(LONGITUDE), REMISE=VALUES(REMISE), MONTANT_ACHAT=VALUES(MONTANT_ACHAT), ANCIEN_SOLDE=VALUES(ANCIEN_SOLDE),
                           EXPORTATION=VALUES(EXPORTATION), BLOCAGE=VALUES(BLOCAGE), VERSER=VALUES(VERSER), LIVRER=VALUES(LIVRER), DATE_LIV=VALUES(DATE_LIV),
                           IS_IMPORTED=VALUES(IS_IMPORTED), IS_EXPORTED=VALUES(IS_EXPORTED), phone_id=VALUES(phone_id)`;

    const itemsTempSql = `INSERT INTO BON2_TEMP (CODE_BARRE, NUM_BON, PRODUIT, NBRE_COLIS, COLISSAGE, QTE_GRAT, QTE, PV_HT, PA_HT, DESTOCK_TYPE, DESTOCK_CODE_BARRE, DESTOCK_QTE, TVA, CODE_DEPOT)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    for (const bon of (payload.bon1_temp || [])) {
      const h = bon && bon.header ? bon.header : {};
      if (!h.NUM_BON) continue;
      const params = [
        h.NUM_BON,
        h.CODE_CLIENT || null,
        h.DATE_BON || null,
        h.HEURE || null,
        h.NBR_P ?? null,
        h.TOT_QTE ?? null,
        h.MODE_TARIF || null,
        h.CODE_DEPOT || null,
        h.MODE_RG || null,
        h.CODE_VENDEUR || null,
        h.TOT_HT ?? null,
        h.TOT_TVA ?? null,
        h.TIMBRE ?? null,
        h.TIMBRE_CHECK || null,
        (h.LATITUDE != null ? Number(h.LATITUDE) : 0),
        (h.LONGITUDE != null ? Number(h.LONGITUDE) : 0),
        h.REMISE ?? null,
        h.MONTANT_ACHAT ?? null,
        h.ANCIEN_SOLDE ?? null,
        h.EXPORTATION || null,
        h.BLOCAGE || null,
        h.VERSER ?? null,
        h.LIVRER ?? 0,
        h.DATE_LIV || null,
        h.IS_IMPORTED ?? 0,
        h.IS_EXPORTED ?? 0,
        device_id,
      ];
      const [resHeader] = await conn.query(headersTempSql, params);
      updatedBon1Temp += resHeader.affectedRows ? 1 : 0;

      await conn.query('DELETE FROM BON2_TEMP WHERE NUM_BON = ?', [h.NUM_BON]);
      for (const it of (bon.items || [])) {
        const p = [
          it.CODE_BARRE || null,
          h.NUM_BON,
          it.PRODUIT || null,
          it.NBRE_COLIS ?? null,
          it.COLISSAGE ?? null,
          it.QTE_GRAT ?? null,
          it.QTE ?? 0,
          it.PV_HT ?? null,
          it.PA_HT ?? null,
          it.DESTOCK_TYPE || null,
          it.DESTOCK_CODE_BARRE || null,
          it.DESTOCK_QTE ?? null,
          it.TVA ?? null,
          it.CODE_DEPOT || h.CODE_DEPOT || null,
        ];
        await conn.query(itemsTempSql, p);
        insertedBon2Temp += 1;
      }
    }

    await conn.commit();
    res.json({
      success: true,
      device_id,
      stats: {
        updatedBon1,
        insertedBon2,
        updatedBon1Temp,
        insertedBon2Temp,
      },
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error('[api] /api/bon/sync error:', err);
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  } finally {
    conn.release();
  }
});

app.post('/api/locations', async (req, res) => {
  const { phone_id, latitude, longitude, date_time } = req.body || {};
  if (!phone_id || latitude == null || longitude == null) {
    return res.status(400).json({ error: 'phone_id, latitude, longitude are required' });
  }
  try {
    await pool.query(
      'INSERT INTO locations (phone_id, latitude, longitude, date_time) VALUES (?, ?, ?, ?)',
      [phone_id, latitude, longitude, date_time || new Date()]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Auth endpoints using clients table
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
  try {
    const [rows] = await pool.query('SELECT * FROM clients WHERE username = ? LIMIT 1', [username]);
    const client = rows[0];
    if (!client) return res.status(401).json({ error: 'Invalid credentials' });
    if (client.statut && client.statut.toLowerCase() === 'disabled') return res.status(403).json({ error: 'Account disabled' });

    const stored = client.password || '';
    const looksHashed = typeof stored === 'string' && stored.startsWith('$2');
    let ok = false;
    if (looksHashed) {
      try {
        ok = await bcrypt.compare(password, stored);
      } catch (_) {
        ok = false;
      }
    } else {
      // Plaintext fallback when password is not hashed
      ok = password === stored;
    }
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Update last_login using username to avoid column name mismatches
    await pool.query('UPDATE clients SET last_login = NOW() WHERE username = ?', [client.username]);

    const clientId = client.client_id ?? client.id ?? null;
    const token = jwt.sign({ client_id: clientId, username: client.username, statut: client.statut, is_admin: client.is_admin ? 1 : 0 }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: clientId, name: client.username, statut: client.statut, expire_date: client.expire_date, is_admin: !!client.is_admin } });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    // Fetch by username to avoid depending on specific PK column naming
    const [rows] = await pool.query('SELECT * FROM clients WHERE username = ? LIMIT 1', [req.user.username]);
    const row = rows[0];
    if (!row) return res.json(null);
    const id = row.client_id ?? row.id ?? null;
    res.json({ id, name: row.username, statut: row.statut, expire_date: row.expire_date, is_admin: !!row.is_admin });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Phone auth endpoint
// Reçoit: phone_id, device_name, email, username, password
// Réponses:
// - {code: 200, message: "Connecté"} si l'utilisateur existe, non désactivé et mot de passe valide
// - {code: 330, message: "Utilisateur bloqué"} si l'utilisateur est désactivé
// - {code: 340, message: "Utilisateur n'est pas encore inscrit"} si l'utilisateur n'existe pas
// - {code: 401, message: "Identifiants invalides"} si le mot de passe est incorrect
app.post('/api/phone-auth', async (req, res) => {
  const { phone_id, device_name, email, username, password } = req.body || {};

  // Validation minimale: au moins username ou email + password
  if (!password || (!username && !email)) {
    return res.status(200).json({ code: 400, message: 'username ou email et password requis' });
  }

  try {
    const lookupField = username ? 'username' : 'email';
    const lookupValue = username || email;
    const [rows] = await pool.query(`SELECT * FROM clients WHERE ${lookupField} = ? LIMIT 1`, [lookupValue]);
    const client = rows[0];

    if (!client) {
      return res.status(200).json({ code: 340, message: "Utilisateur n'est pas encore inscrit" });
    }

    // Vérifier le statut
    if (client.statut && String(client.statut).toLowerCase() === 'disabled') {
      return res.status(200).json({ code: 330, message: 'Utilisateur bloqué' });
    }

    // Vérifier le mot de passe (bcrypt si hashé, sinon en clair)
    const stored = client.password || '';
    const looksHashed = typeof stored === 'string' && stored.startsWith('$2');
    let ok = false;
    if (looksHashed) {
      try {
        ok = await bcrypt.compare(password, stored);
      } catch (_) {
        ok = false;
      }
    } else {
      ok = password === stored;
    }

    if (!ok) {
      return res.status(200).json({ code: 401, message: 'Identifiants invalides' });
    }

    // Enregistrer la dernière connexion
    try {
      await pool.query('UPDATE clients SET last_login = NOW() WHERE client_id = ?', [client.client_id ?? client.id]);
    } catch (_) {}

    // Auto-enregistrer le téléphone si première connexion et phone_id encore absent
    // Si le téléphone existe mais appartient à un autre client, ne rien faire et renvoyer code 360
    try {
      const cid = client.client_id ?? client.id;
      let phoneConflictOtherOwner = false;
      if (phone_id && cid) {
        const [prows] = await pool.query('SELECT phone_id, phone_name, client_id FROM phones WHERE phone_id = ? LIMIT 1', [phone_id]);
        const exists = Array.isArray(prows) && prows.length > 0;
        const deviceNameTrimmed = device_name && String(device_name).trim().length > 0 ? String(device_name).trim() : null;
        if (!exists) {
          const phoneName = deviceNameTrimmed || String(phone_id);
          await pool.query(
            'INSERT INTO phones (phone_id, phone_name, client_id, last_update) VALUES (?, ?, ?, NOW())',
            [phone_id, phoneName, cid]
          );
        } else {
          const current = prows[0];
          if (String(current.client_id) !== String(cid)) {
            phoneConflictOtherOwner = true;
          } else if (deviceNameTrimmed && deviceNameTrimmed !== current.phone_name) {
            await pool.query(
              'UPDATE phones SET phone_name = ?, last_update = NOW() WHERE phone_id = ?',
              [deviceNameTrimmed, phone_id]
            );
          }
        }
      }
      if (phoneConflictOtherOwner) {
        return res.status(200).json({ code: 360, message: 'Téléphone enregistrer a un autre compte' });
      }
    } catch (e) {
      // Ignorer les erreurs de modification pour ne pas bloquer l'auth
    }

    // Optionnel: capturer phone_id/device_name à des fins de logs (non demandé de créer/lier téléphone)
    // On renvoie simplement la réussite d'authentification
    return res.status(200).json({ code: 200, message: 'Connecté' });
  } catch (err) {
    return res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Dev-only: Bootstrap an admin user if none exists
app.post('/api/dev/bootstrap-admin', async (req, res) => {
  try {
    const nodeEnv = process.env.NODE_ENV || 'development';
    // Block in production for safety
    if (nodeEnv === 'production') {
      return res.status(403).json({ error: 'Forbidden in production' });
    }

    // Check if any admin exists
    const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM clients WHERE is_admin = 1');
    const cnt = (rows && rows[0] && rows[0].cnt) ? Number(rows[0].cnt) : 0;
    if (cnt > 0) {
      return res.status(409).json({ error: 'Admin already exists' });
    }

    const { username, password, email, name } = req.body || {};
    const uname = username || 'admin';
    const pass = password || '123456';
    const fullName = name || 'Administrator';
    const mail = email || 'admin@example.com';

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(pass, salt);
    const [result] = await pool.query(
      `INSERT INTO clients (username, password, full_name, email, is_admin, statut, last_login, nbr_phones)
       VALUES (?, ?, ?, ?, 1, 'active', NOW(), 0)`,
      [uname, hash, fullName, mail]
    );
    const insertedId = result.insertId;

    const token = jwt.sign({ client_id: insertedId, username: uname, statut: 'active', is_admin: 1 }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: insertedId, name: uname, statut: 'active', is_admin: true } });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Dev-only: GET variant for convenience when testing via browser/tools
app.get('/api/dev/bootstrap-admin', async (req, res) => {
  try {
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      return res.status(403).json({ error: 'Forbidden in production' });
    }

    const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM clients WHERE is_admin = 1');
    const cnt = (rows && rows[0] && rows[0].cnt) ? Number(rows[0].cnt) : 0;
    if (cnt > 0) {
      return res.status(409).json({ error: 'Admin already exists' });
    }

    const uname = (req.query.username && String(req.query.username)) || 'admin';
    const pass = (req.query.password && String(req.query.password)) || '123456';
    const fullName = (req.query.name && String(req.query.name)) || 'Administrator';
    const mail = (req.query.email && String(req.query.email)) || 'admin@example.com';

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(pass, salt);
    const [result] = await pool.query(
      `INSERT INTO clients (username, password, full_name, email, is_admin, statut, last_login, nbr_phones)
       VALUES (?, ?, ?, ?, 1, 'active', NOW(), 0)`,
      [uname, hash, fullName, mail]
    );
    const insertedId = result.insertId;

    const token = jwt.sign({ client_id: insertedId, username: uname, statut: 'active', is_admin: 1 }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: insertedId, name: uname, statut: 'active', is_admin: true } });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Admin-only user management (clients CRUD)
app.get('/api/admin/users', authMiddleware, adminOnly, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT client_id AS id, username, full_name, email, phone_number,
              is_admin, statut, last_login, nbr_phones, expire_date
         FROM clients
         ORDER BY username`
    );
    const mapped = rows.map((r) => ({
      id: r.id,
      name: r.full_name || r.username,
      email: r.email || r.username,
      role: r.is_admin ? 'admin' : 'user',
      created_at: r.last_login || null,
      enabled: (r.statut ?? 'active') !== 'disabled',
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

app.post('/api/admin/users', authMiddleware, adminOnly, async (req, res) => {
  const { name, email, password, role, enabled, username } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const uname = username || email || name;
    const fullName = name || uname;
    const isAdmin = role === 'admin' ? 1 : 0;
    const statut = enabled === false ? 'disabled' : 'active';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const [result] = await pool.query(
      `INSERT INTO clients (username, password, full_name, email, is_admin, statut, last_login, nbr_phones)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), 0)`,
      [uname, hash, fullName, email, isAdmin, statut]
    );
    const insertedId = result.insertId;
    res.json({
      id: insertedId,
      name: fullName,
      email,
      role: isAdmin ? 'admin' : 'user',
      enabled: statut !== 'disabled',
    });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

app.put('/api/admin/users/:id', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { name, email, role, enabled, password } = req.body || {};
  try {
    const fields = [];
    const values = [];
    if (name != null) { fields.push('full_name = ?'); values.push(name); }
    if (email != null) { fields.push('email = ?'); values.push(email); }
    if (role != null) { fields.push('is_admin = ?'); values.push(role === 'admin' ? 1 : 0); }
    if (enabled != null) { fields.push('statut = ?'); values.push(enabled ? 'active' : 'disabled'); }
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      fields.push('password = ?');
      values.push(hash);
    }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    const [result] = await pool.query(`UPDATE clients SET ${fields.join(', ')} WHERE client_id = ?`, values);
    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

app.delete('/api/admin/users/:id', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM clients WHERE client_id = ?', [id]);
    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Public: Read map keys (safe to expose; keys should be referrer-restricted)
app.get('/api/config/map-keys', async (_req, res) => {
  try {
    const cfg = readConfig();
    // Env fallback if not set in config
    const googleMapsKey = (Object.prototype.hasOwnProperty.call(cfg, 'googleMapsKey'))
      ? cfg.googleMapsKey
      : (process.env.VITE_GOOGLE_MAPS_KEY || '');
    const mapboxToken = (Object.prototype.hasOwnProperty.call(cfg, 'mapboxToken'))
      ? cfg.mapboxToken
      : (process.env.VITE_MAPBOX_TOKEN || '');
    const enableGoogleMaps = typeof cfg.enableGoogleMaps === 'boolean' ? cfg.enableGoogleMaps : true;
    const enableMapbox = typeof cfg.enableMapbox === 'boolean' ? cfg.enableMapbox : true;
    const mapDefaultZoom = Number.isFinite(cfg.mapDefaultZoom) ? Number(cfg.mapDefaultZoom) : 10;
    res.json({ googleMapsKey, mapboxToken, enableGoogleMaps, enableMapbox, mapDefaultZoom });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Admin: Write map keys
app.post('/api/admin/config/map-keys', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { googleMapsKey, mapboxToken, enableGoogleMaps, enableMapbox, mapDefaultZoom } = req.body || {};

    // Coerce possible string values to booleans for robustness
    const coerceBoolean = (val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        const lower = val.trim().toLowerCase();
        if (lower === 'true' || lower === '1') return true;
        if (lower === 'false' || lower === '0') return false;
      }
      if (typeof val === 'number') return val !== 0;
      return undefined;
    };

    const cfg = readConfig();
    const next = { ...cfg };
    if (typeof googleMapsKey === 'string') next.googleMapsKey = googleMapsKey;
    if (typeof mapboxToken === 'string') next.mapboxToken = mapboxToken;
    const egm = coerceBoolean(enableGoogleMaps);
    const emb = coerceBoolean(enableMapbox);
    if (typeof egm === 'boolean') next.enableGoogleMaps = egm;
    if (typeof emb === 'boolean') next.enableMapbox = emb;
    if (mapDefaultZoom != null) {
      const z = Math.max(1, Math.min(20, Math.round(Number(mapDefaultZoom))));
      if (Number.isFinite(z)) next.mapDefaultZoom = z;
    }

    const ok = writeConfig(next);
    if (!ok) return res.status(500).json({ error: 'Failed to persist config' });

    // Return the updated effective config
    const googleKeyOut = (Object.prototype.hasOwnProperty.call(next, 'googleMapsKey'))
      ? next.googleMapsKey
      : (process.env.VITE_GOOGLE_MAPS_KEY || '');
    const mapboxTokenOut = (Object.prototype.hasOwnProperty.call(next, 'mapboxToken'))
      ? next.mapboxToken
      : (process.env.VITE_MAPBOX_TOKEN || '');
    const enableGoogleMapsOut = typeof next.enableGoogleMaps === 'boolean' ? next.enableGoogleMaps : true;
    const enableMapboxOut = typeof next.enableMapbox === 'boolean' ? next.enableMapbox : true;
    const mapDefaultZoomOut = Number.isFinite(next.mapDefaultZoom) ? Number(next.mapDefaultZoom) : 10;
    res.json({ success: true, config: { googleMapsKey: googleKeyOut, mapboxToken: mapboxTokenOut, enableGoogleMaps: enableGoogleMapsOut, enableMapbox: enableMapboxOut, mapDefaultZoom: mapDefaultZoomOut } });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Unknown error' });
  }
});

// Basic error logging to avoid silent crashes in development
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught Exception:', err);
});

// Prefer platform-provided PORT (e.g., cPanel Passenger, PaaS), then API_PORT
const port = Number(process.env.PORT || process.env.API_PORT || 3000);
// Bind explicitly to IPv4 to avoid localhost resolution quirks on Windows
const host = '0.0.0.0';
// Serve built frontend (SPA) from 'dist'
const distDir = path.resolve(process.cwd(), 'dist');
app.use(express.static(distDir));

// SPA fallback for non-API routes
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});
const server = app.listen(port, host, () => {
  console.log(`[server] API listening on http://${host}:${port}`);
});
server.on('error', (err) => {
  console.error('[server] HTTP server error:', err);
});
