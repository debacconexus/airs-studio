'use strict';
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const NEXUS_NAME = process.env.NEXUS_NAME || 'AIRS Nexus';
const TABLE_NAME = process.env.TABLE_NAME || 'records';
const ENTITY_LABEL = process.env.ENTITY_LABEL || 'Record';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function initDB() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (id SERIAL PRIMARY KEY, field_1 TEXT, field_2 TEXT, field_3 TEXT, field_4 TEXT, field_5 TEXT, field_6 TEXT, status VARCHAR(50) DEFAULT 'active', notes TEXT, igm_governed BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS audit_log (id SERIAL PRIMARY KEY, table_name VARCHAR(100), record_id INTEGER, action_type VARCHAR(20), changed_by VARCHAR(255), field_changed VARCHAR(100), old_value TEXT, new_value TEXT, changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS contact_log (id SERIAL PRIMARY KEY, record_id INTEGER, contact_type VARCHAR(100), notes TEXT, author VARCHAR(255), igm_governed BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS documents (id SERIAL PRIMARY KEY, record_id INTEGER, document_type VARCHAR(100), document_source VARCHAR(100), received_via VARCHAR(100), event_date DATE, assigned_to VARCHAR(255), extracted_text TEXT, igm_governed BOOLEAN DEFAULT true, chain_status VARCHAR(50) DEFAULT 'submitted', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS raw_notes (id SERIAL PRIMARY KEY, record_id INTEGER, note_type VARCHAR(50) DEFAULT 'general', content TEXT, author VARCHAR(255), igm_governed BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS calendar_events (id SERIAL PRIMARY KEY, record_id INTEGER, event_date DATE, event_type VARCHAR(100), location VARCHAR(255), assigned_to VARCHAR(255), notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    console.log('[IGM] Database initialized: ' + NEXUS_NAME);
  } catch (err) {
    console.error('[IGM] DB init error:', err.message);
  }
}

async function audit(recordId, action, changedBy) {
  try {
    await pool.query('INSERT INTO audit_log (table_name, record_id, action_type, changed_by) VALUES ($1,$2,$3,$4)', [TABLE_NAME, recordId, action, changedBy || 'system']);
  } catch (err) { console.error('[IGM] Audit error:', err.message); }
}

app.get('/api/records', async (req, res) => {
  try {
    const { search, status } = req.query;
    let q = `SELECT * FROM ${TABLE_NAME}`;
    const params = [];
    const clauses = [];
    if (search) { params.push(`%${search}%`); clauses.push(`(field_1 ILIKE $${params.length} OR field_2 ILIKE $${params.length} OR field_3 ILIKE $${params.length})`); }
    if (status && status !== 'all') { params.push(status); clauses.push(`status = $${params.length}`); }
    if (clauses.length) q += ' WHERE ' + clauses.join(' AND ');
    q += ' ORDER BY created_at DESC';
    const result = await pool.query(q, params);
    res.json({ success: true, records: result.rows, entity: ENTITY_LABEL });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/records/:id', async (req, res) => {
  try {
    const record = await pool.query(`SELECT * FROM ${TABLE_NAME} WHERE id = $1`, [req.params.id]);
    const contacts = await pool.query('SELECT * FROM contact_log WHERE record_id = $1 ORDER BY created_at DESC', [req.params.id]);
    const docs = await pool.query('SELECT * FROM documents WHERE record_id = $1 ORDER BY created_at DESC', [req.params.id]);
    const notes = await pool.query('SELECT * FROM raw_notes WHERE record_id = $1 ORDER BY created_at DESC', [req.params.id]);
    if (!record.rows[0]) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, record: record.rows[0], contacts: contacts.rows, documents: docs.rows, notes: notes.rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/records', async (req, res) => {
  try {
    const { field_1, field_2, field_3, field_4, field_5, field_6, status, notes, created_by } = req.body;
    const result = await pool.query(`INSERT INTO ${TABLE_NAME} (field_1,field_2,field_3,field_4,field_5,field_6,status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [field_1, field_2, field_3, field_4, field_5, field_6, status || 'active', notes]);
    await audit(result.rows[0].id, 'INSERT', created_by);
    res.status(201).json({ success: true, record: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/records/:id', async (req, res) => {
  try {
    const { field_1, field_2, field_3, field_4, field_5, field_6, status, notes, updated_by } = req.body;
    const result = await pool.query(`UPDATE ${TABLE_NAME} SET field_1=$1,field_2=$2,field_3=$3,field_4=$4,field_5=$5,field_6=$6,status=$7,notes=$8,updated_at=CURRENT_TIMESTAMP WHERE id=$9 RETURNING *`, [field_1, field_2, field_3, field_4, field_5, field_6, status, notes, req.params.id]);
    await audit(req.params.id, 'UPDATE', updated_by);
    res.json({ success: true, record: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/records/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM ${TABLE_NAME} WHERE id = $1`, [req.params.id]);
    await audit(req.params.id, 'DELETE', req.body?.deleted_by);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/contacts', async (req, res) => {
  try {
    const { record_id, contact_type, notes, author } = req.body;
    const result = await pool.query('INSERT INTO contact_log (record_id, contact_type, notes, author) VALUES ($1,$2,$3,$4) RETURNING *', [record_id, contact_type, notes, author]);
    res.status(201).json({ success: true, contact: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/notes', async (req, res) => {
  try {
    const { record_id } = req.query;
    const q = record_id ? 'SELECT * FROM raw_notes WHERE record_id = $1 ORDER BY created_at DESC' : 'SELECT * FROM raw_notes ORDER BY created_at DESC LIMIT 100';
    const result = record_id ? await pool.query(q, [record_id]) : await pool.query(q);
    res.json({ success: true, notes: result.rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/notes', async (req, res) => {
  try {
    const { record_id, note_type, content, author, igm_governed } = req.body;
    const result = await pool.query('INSERT INTO raw_notes (record_id, note_type, content, author, igm_governed) VALUES ($1,$2,$3,$4,$5) RETURNING *', [record_id || null, note_type || 'general', content, author, igm_governed || false]);
    if (igm_governed) await audit(record_id, 'GOVERNED_NOTE', author);
    res.status(201).json({ success: true, note: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/documents', async (req, res) => {
  try {
    const { record_id } = req.query;
    const q = record_id ? 'SELECT * FROM documents WHERE record_id = $1 ORDER BY created_at DESC' : 'SELECT * FROM documents ORDER BY created_at DESC LIMIT 100';
    const result = record_id ? await pool.query(q, [record_id]) : await pool.query(q);
    res.json({ success: true, documents: result.rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/documents', async (req, res) => {
  try {
    const { record_id, document_type, document_source, received_via, event_date, assigned_to, extracted_text } = req.body;
    const result = await pool.query('INSERT INTO documents (record_id, document_type, document_source, received_via, event_date, assigned_to, extracted_text) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [record_id || null, document_type, document_source, received_via, event_date || null, assigned_to, extracted_text]);
    await audit(record_id, 'DOCUMENT_ADDED', assigned_to);
    res.status(201).json({ success: true, document: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/calendar', async (req, res) => {
  try {
    const { date, location, assigned_to } = req.query;
    let q = `SELECT c.*, r.field_1, r.field_2 FROM calendar_events c LEFT JOIN ${TABLE_NAME} r ON c.record_id = r.id`;
    const params = [];
    const clauses = [];
    if (date) { params.push(date); clauses.push(`c.event_date = $${params.length}`); }
    if (location) { params.push(`%${location}%`); clauses.push(`c.location ILIKE $${params.length}`); }
    if (assigned_to) { params.push(`%${assigned_to}%`); clauses.push(`c.assigned_to ILIKE $${params.length}`); }
    if (clauses.length) q += ' WHERE ' + clauses.join(' AND ');
    q += ' ORDER BY c.event_date ASC';
    const result = await pool.query(q, params);
    res.json({ success: true, events: result.rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/calendar', async (req, res) => {
  try {
    const { record_id, event_date, event_type, location, assigned_to, notes } = req.body;
    const result = await pool.query('INSERT INTO calendar_events (record_id, event_date, event_type, location, assigned_to, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [record_id || null, event_date, event_type, location, assigned_to, notes]);
    res.status(201).json({ success: true, event: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/datalog', async (req, res) => {
  try {
    const { search } = req.query;
    let q = `SELECT r.*, COUNT(c.id) as contact_count, COUNT(d.id) as doc_count FROM ${TABLE_NAME} r LEFT JOIN contact_log c ON c.record_id = r.id LEFT JOIN documents d ON d.record_id = r.id`;
    const params = [];
    if (search) { params.push(`%${search}%`); q += ` WHERE (r.field_1 ILIKE $1 OR r.field_2 ILIKE $1)`; }
    q += ` GROUP BY r.id ORDER BY r.updated_at DESC`;
    const result = await pool.query(q, params);
    res.json({ success: true, records: result.rows, entity: ENTITY_LABEL, nexus: NEXUS_NAME });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/stats', async (req, res) => {
  try {
    const total = await pool.query(`SELECT COUNT(*) FROM ${TABLE_NAME}`);
    const active = await pool.query(`SELECT COUNT(*) FROM ${TABLE_NAME} WHERE status = 'active'`);
    const completed = await pool.query(`SELECT COUNT(*) FROM ${TABLE_NAME} WHERE status = 'completed'`);
    const recent = await pool.query(`SELECT COUNT(*) FROM ${TABLE_NAME} WHERE created_at > NOW() - INTERVAL '30 days'`);
    const auditCount = await pool.query('SELECT COUNT(*) FROM audit_log');
    const timeSeries = await pool.query(`SELECT DATE(created_at) as date, COUNT(*) as count FROM ${TABLE_NAME} WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date ASC`);
    const statusBreakdown = await pool.query(`SELECT status, COUNT(*) as count FROM ${TABLE_NAME} GROUP BY status`);
    const fieldDist = await pool.query(`SELECT field_3, COUNT(*) as count FROM ${TABLE_NAME} WHERE field_3 IS NOT NULL AND field_3 != '' GROUP BY field_3 ORDER BY count DESC LIMIT 10`);
    const govActivity = await pool.query(`SELECT DATE(changed_at) as date, COUNT(*) as count FROM audit_log WHERE changed_at > NOW() - INTERVAL '30 days' GROUP BY DATE(changed_at) ORDER BY date ASC`);
    res.json({ success: true, stats: { total: parseInt(total.rows[0].count), active: parseInt(active.rows[0].count), completed: parseInt(completed.rows[0].count), recent_30_days: parseInt(recent.rows[0].count), audit_entries: parseInt(auditCount.rows[0].count), nexus_name: NEXUS_NAME, entity_label: ENTITY_LABEL, igm_governed: true }, charts: { time_series: timeSeries.rows, status_breakdown: statusBreakdown.rows, field_distribution: fieldDist.rows, governance_activity: govActivity.rows } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, nexus: NEXUS_NAME, entity: ENTITY_LABEL, igm: 'GOVERNED', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDB().then(() => {
  app.listen(PORT, () => { console.log('[IGM] ' + NEXUS_NAME + ' live on port ' + PORT); });
});
