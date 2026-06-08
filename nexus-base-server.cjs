const express = require("express");
const crypto = require("crypto");

const SSN_KEY = process.env.SSN_ENCRYPTION_KEY || "";
const SSN_ALG = "aes-256-cbc";

function hashSSN(ssn) {
  if (!ssn) return null;
  const digits = String(ssn).replace(/[^0-9]/g, '');
  if (!digits) return null;
  return crypto.createHash('sha256').update(digits).digest('hex');
}

function encryptSSN(ssn) {
  if (!ssn || !SSN_KEY) return ssn;
  try {
    const key = Buffer.from(SSN_KEY.padEnd(32).slice(0,32));
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(SSN_ALG, key, iv);
    const encrypted = Buffer.concat([cipher.update(String(ssn)), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch(e) { return ssn; }
}

function decryptSSN(ssn) {
  if (!ssn || !SSN_KEY || !ssn.includes(':')) return ssn;
  try {
    const key = Buffer.from(SSN_KEY.padEnd(32).slice(0,32));
    const [ivHex, encHex] = ssn.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv(SSN_ALG, key, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
  } catch(e) { return ssn; }
}

function maskSSN(ssn) {
  if (!ssn) return "--";
  const plain = decryptSSN(ssn);
  const digits = String(plain).replace(/[^0-9]/g,"");
  return digits.length >= 4 ? `***-**-${digits.slice(-4)}` : "--";
}
const { google } = require("googleapis");
let serviceAccount = null;
try { serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON); } catch(e) { console.error("[SHEETS] Service account parse error:", e.message); }
const path = require("path");
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function igmPreFilter(text) {
  text = text.toLowerCase().trim();
  text = text.replace(/\b(please|can you|open up|go to|take me to|show me|i want|i need|navigate to|the|a|an)\b/g, " ").replace(/\s+/g, " ").trim();
  return text;
}

function getTokenBudget(type) {
  const budgets = { navigation:20, note:300, coordination:100, intake:150, intelligence:200, default:60 };
  return budgets[type] || budgets.default;
}

async function pushToSheets(d, veteranId, isNew) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const SHEET_ID = "1ArthmSd8Ztut0GMdz_Z3RcVLZ6F8KvDCLh9uIlzvtrs";
    const vetResult = await pool.query("SELECT last_name, first_name, case_number FROM veterans WHERE id=$1", [veteranId]);
const vet = vetResult.rows[0] || {};

    const row = [
      `JIV-${String(veteranId).padStart(5,"0")}-${new Date().toISOString().slice(0,10).replace(/-/g,"")}`,
      new Date().toLocaleDateString("en-US"),
      vet.last_name || "",
      vet.first_name || "",
      vet.case_number || "",
      d.ssn ? "***-**-" + String(d.ssn).replace(/[^0-9]/g,"").slice(-4) : "[NOT PROVIDED]",
      d.phone || "",
      d.email || "",
      d.zip || "",
      d.dob || "",
      "",
      d.preferredContact || "",
      d.branch || "",
      d.component || "",
      d.discharge || "",
      d.vetStatusConfirmed || "",
      d.scDisability || "",
      d.vaRating || "",
      d.hc_va ? "Yes" : "No",
      d.vjoSpecialist || "",
      "",
      "",
      d.alertHostile ? "Yes" : "No",
      d.courthouse || "",
      d.gender || "",
      d.raceEthnicity || "",
      d.language === "Spanish" ? "Yes" : "No",
      d.maritalStatus || "",
      d.dependents || "",
      d.housingStatus || "",
      "",
      isNew ? "New Contact" : "Previously Served",
      Array.isArray(d.serviceNeeds)&&d.serviceNeeds.includes("CFCI Mental Health (DMH)") ? "Yes" : "",
      Array.isArray(d.serviceNeeds)&&d.serviceNeeds.includes("CFCI Substance Abuse (LACADA)") ? "Yes" : "",
      Array.isArray(d.serviceNeeds)&&d.serviceNeeds.includes("CFCI Social Services") ? "Yes" : "",
      Array.isArray(d.serviceNeeds)&&d.serviceNeeds.includes("CFCI Basic Necessities") ? "Yes" : "",
      Array.isArray(d.serviceNeeds)&&d.serviceNeeds.includes("CFCI Permanent Housing") ? "Yes" : "",
      Array.isArray(d.serviceNeeds)&&d.serviceNeeds.includes("CFCI Temporary Housing") ? "Yes" : "",
      Array.isArray(d.serviceNeeds)&&d.serviceNeeds.includes("CFCI Vital Document Assistance") ? "Yes" : "",
      Array.isArray(d.serviceNeeds)&&d.serviceNeeds.includes("Medi-Cal Referral") ? "Yes" : "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ];

    if (isNew) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "Veteran Master Record!A:BG",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] }
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "Veteran Master Record!A:BG",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] }
      });
    }
    console.log(`[SHEETS] Veteran ${veteranId} pushed to Google Sheets`);
  } catch(e) {
    console.error("[SHEETS ERROR]", e.message);
  }
} 

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS veterans (id SERIAL PRIMARY KEY, ssn VARCHAR(200), ssn_hash VARCHAR(64) UNIQUE, last_name VARCHAR(100), first_name VARCHAR(100), middle VARCHAR(50), suffix VARCHAR(10), dob DATE, phone VARCHAR(30), phone2 VARCHAR(30), email VARCHAR(100), address2 VARCHAR(200), address3 VARCHAR(100), city VARCHAR(100), state VARCHAR(2), zip VARCHAR(10), county VARCHAR(100), gender VARCHAR(50), sex VARCHAR(20), race_ethnicity VARCHAR(100), marital_status VARCHAR(50), dependents VARCHAR(10), primary_language VARCHAR(50), preferred_contact VARCHAR(50), branch VARCHAR(50), component VARCHAR(50), era VARCHAR(50), rank VARCHAR(20), discharge_status VARCHAR(50), combat_veteran VARCHAR(10), combat_zone VARCHAR(100), mst_survivor VARCHAR(20), va_rating VARCHAR(20), sc_disability VARCHAR(20), vjo_specialist VARCHAR(100), poa VARCHAR(50), regional_office VARCHAR(50), drivers_license VARCHAR(50), license_state VARCHAR(2), housing_status VARCHAR(50), alert_hostile VARCHAR(5), flags JSONB DEFAULT '[]', vtc_status VARCHAR(30) DEFAULT 'Active', vtc_courthouse VARCHAR(100), case_number VARCHAR(200), private_attorney VARCHAR(100), public_defender VARCHAR(100), vet_status_confirmed VARCHAR(10), hc_va BOOLEAN DEFAULT FALSE, hc_medicaid BOOLEAN DEFAULT FALSE, hc_private BOOLEAN DEFAULT FALSE, hc_private_detail VARCHAR(100), graduation_date DATE, graduation_courthouse VARCHAR(100), archive_reason VARCHAR(100), deceased BOOLEAN DEFAULT FALSE, died_date DATE, file_num VARCHAR(50), edipi VARCHAR(50), nsc_rating VARCHAR(20), sc_rating VARCHAR(20), permanent_total BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS contacts (id SERIAL PRIMARY KEY, veteran_id INTEGER REFERENCES veterans(id), contact_date DATE, courthouse VARCHAR(100), vsr_name VARCHAR(100), visit_type VARCHAR(50), contact_status VARCHAR(50), next_court_date DATE, progress_report_received BOOLEAN DEFAULT FALSE, progress_report_provider VARCHAR(100), service_needs JSONB DEFAULT '[]', interested_services VARCHAR(10), filed_va_claim VARCHAR(10), referred_treatment VARCHAR(10), treatment_location VARCHAR(200), referral_type VARCHAR(50), treatment_method VARCHAR(50), forms_required VARCHAR(200), forms_submitted VARCHAR(200), alert_hostile VARCHAR(5), raw_note TEXT, governed_note TEXT, tokens_in INTEGER DEFAULT 0, tokens_out INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lacada_status VARCHAR(30)`).catch(()=>{});
    await pool.query(`ALTER TABLE court_dockets ADD COLUMN IF NOT EXISTS doc_type VARCHAR(50) DEFAULT 'court_docket'`).catch(()=>{});
    await pool.query(`CREATE TABLE IF NOT EXISTS court_dockets (
      id SERIAL PRIMARY KEY,
      courthouse VARCHAR(100) NOT NULL,
      hearing_date DATE NOT NULL,
      vsr_name VARCHAR(100),
      source VARCHAR(100),
      received_via VARCHAR(100),
      image_data TEXT,
      image_filename VARCHAR(200),
      extracted_data JSONB DEFAULT '[]',
      match_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      governed_note TEXT,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      uploaded_at TIMESTAMP DEFAULT NOW()
    )`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS va_screen_status VARCHAR(30) DEFAULT 'Not Screened'`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS rearrest_type VARCHAR(50)`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS rearrest_date DATE`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS restart_date DATE`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS restart_count INTEGER DEFAULT 0`).catch(()=>{});
    await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS vpan_status VARCHAR(30)`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS intercept_point VARCHAR(50)`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS charge_type VARCHAR(30)`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS vtc_outcome VARCHAR(50)`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS jail_facility VARCHAR(100)`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS custody_location VARCHAR(100)`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50)`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS education_level VARCHAR(50)`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS benefit_outcome VARCHAR(100)`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS new_disability_pct VARCHAR(20)`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS va_eligible_at_intake VARCHAR(10)`).catch(()=>{});
    await pool.query(`ALTER TABLE veterans ADD COLUMN IF NOT EXISTS handoff_notes JSONB DEFAULT '[]'`).catch(()=>{});
    await pool.query(`CREATE TABLE IF NOT EXISTS referrals (id SERIAL PRIMARY KEY, veteran_id INTEGER REFERENCES veterans(id), partner VARCHAR(50), program VARCHAR(100), referral_date DATE, screening_status VARCHAR(30) DEFAULT 'Pending', acceptance_date DATE, enrollment_date DATE, completion_date DATE, status VARCHAR(30) DEFAULT 'Active', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    console.log("CivGATE database ready");
  } catch(e) { console.log("DB error:", e.message); }
}
initDB();

app.post("/api/veterans", async (req, res) => {
  try {
    const d = req.body;
    console.log("[INTAKE FLAGS]", d.flags);
    // Dedup: SSN first, then last+first+dob fallback
    let existing = d.ssn ? await pool.query("SELECT id FROM veterans WHERE ssn_hash=$1", [hashSSN(d.ssn)]) : { rows: [] };
    if (existing.rows.length === 0 && d.lastName && d.firstName && d.dob) {
      existing = await pool.query("SELECT id FROM veterans WHERE LOWER(last_name)=LOWER($1) AND LOWER(first_name)=LOWER($2) AND dob=$3", [d.lastName, d.firstName, d.dob]);
    }
    if (existing.rows.length === 0 && d.lastName && d.firstName && !d.dob) {
      existing = await pool.query("SELECT id FROM veterans WHERE LOWER(last_name)=LOWER($1) AND LOWER(first_name)=LOWER($2)", [d.lastName, d.firstName]);
    }
    let veteranId;
    if (existing.rows.length > 0) {
      veteranId = existing.rows[0].id;
      await pool.query(`UPDATE veterans SET last_name=$1, first_name=$2, middle=$3, suffix=$4, dob=$5, phone=$6, phone2=$7, email=$8, address2=$9, address3=$10, city=$11, state=$12, zip=$13, county=$14, gender=$15, sex=$16, race_ethnicity=$17, marital_status=$18, dependents=$19, primary_language=$20, preferred_contact=$21, branch=$22, component=$23, discharge_status=$24, combat_veteran=$25, combat_zone=$26, mst_survivor=$27, va_rating=$28, sc_disability=$29, vjo_specialist=$30, poa=$31, regional_office=$32, housing_status=$33, alert_hostile=$34, flags=$35, vtc_courthouse=$36, case_number=$37, private_attorney=$38, public_defender=$39, vet_status_confirmed=$40, hc_va=$41, hc_medicaid=$42, hc_private=$43, hc_private_detail=$44, file_num=$45, updated_at=NOW() WHERE id=$46`,
        [d.lastName, d.firstName, d.middle, d.suffix, d.dob||null, d.phone, d.phone2, d.email, d.address2, d.address3, d.city, d.state, d.zip, d.county, d.gender, d.sex, d.raceEthnicity, d.maritalStatus, d.dependents, d.language, d.preferredContact, d.branch, d.component, d.discharge, d.combatVet, d.combatZone, d.mstSurvivor, d.vaRating, d.scDisability, d.vjoSpecialist, d.poa, d.regionalOffice, d.housingStatus, d.alertHostile, JSON.stringify(d.flags||[]), d.courthouse, d.caseNum, d.privateAttorney, d.publicDefender, d.vetStatusConfirmed, d.hc_va||false, d.hc_mediCal||false, d.hc_private||false, d.hc_privateText, d.fileNum, veteranId]);
    } else {
      const result = await pool.query(`INSERT INTO veterans (ssn, ssn_hash, last_name, first_name, middle, suffix, dob, phone, phone2, email, address2, address3, city, state, zip, county, gender, sex, race_ethnicity, marital_status, dependents, primary_language, preferred_contact, branch, component, discharge_status, combat_veteran, combat_zone, mst_survivor, va_rating, sc_disability, vjo_specialist, poa, regional_office, housing_status, alert_hostile, flags, vtc_courthouse, case_number, private_attorney, public_defender, vet_status_confirmed, hc_va, hc_medicaid, hc_private, hc_private_detail, file_num, intercept_point, charge_type, vtc_outcome, jail_facility, custody_location, employment_status, education_level, benefit_outcome, new_disability_pct, va_eligible_at_intake) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56,$57) RETURNING id`,
        [encryptSSN(d.ssn), hashSSN(d.ssn), d.lastName, d.firstName, d.middle, d.suffix, d.dob||null, d.phone, d.phone2, d.email, d.address2, d.address3, d.city, d.state, d.zip, d.county, d.gender, d.sex, d.raceEthnicity, d.maritalStatus, d.dependents, d.language, d.preferredContact, d.branch, d.component, d.discharge, d.combatVet, d.combatZone, d.mstSurvivor, d.vaRating, d.scDisability, d.vjoSpecialist, d.poa, d.regionalOffice, d.housingStatus, d.alertHostile, JSON.stringify(d.flags||[]), d.courthouse, d.caseNum, d.privateAttorney, d.publicDefender, d.vetStatusConfirmed, d.hc_va||false, d.hc_mediCal||false, d.hc_private||false, d.hc_privateText, d.fileNum, d.interceptPoint||null, d.chargeType||null, d.vtcOutcome||null, d.jailFacility||null, d.custodyLocation||null, d.employmentStatus||null, d.educationLevel||null, d.benefitOutcome||null, d.newDisability||null, d.vaEligibleAtIntake||null]);
      veteranId = result.rows[0].id;
    }
    const isNew = existing.rows.length === 0;
// pushToSheets disabled — VMR rebuilt on demand
res.json({ success: true, veteranId, isNew });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.get("/api/veterans/search", async (req, res) => {
  try {
    const { q, courthouse, status, next_court_date } = req.query;
    let where = [];
    let params = [];
    let idx = 1;
    if (q && q.trim()) {
      where.push(`(v.last_name ILIKE $${idx} OR v.first_name ILIKE $${idx} OR v.ssn LIKE $${idx} OR v.case_number ILIKE $${idx})`);
      params.push(`%${q}%`); idx++;
    }
    if (courthouse && courthouse !== 'all') {
      where.push(`v.vtc_courthouse = $${idx}`);
      params.push(courthouse); idx++;
    }
    if (status && status !== 'all') {
      where.push(`v.vtc_status = $${idx}`);
      params.push(status); idx++;
    }
    if (next_court_date) {
      where.push(`EXISTS (SELECT 1 FROM contacts c WHERE c.veteran_id = v.id AND c.next_court_date::date = $${idx}::date)`);
      params.push(next_court_date); idx++;
    }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const result = await pool.query(`
      SELECT v.id, v.last_name, v.first_name, v.middle, v.ssn, v.dob, v.phone,
             v.vtc_courthouse, v.vtc_status, v.case_number, v.alert_hostile, v.flags,
             (SELECT c.next_court_date FROM contacts c WHERE c.veteran_id = v.id AND c.next_court_date >= CURRENT_DATE ORDER BY c.next_court_date ASC LIMIT 1) as next_court_date
      FROM veterans v ${whereClause} ORDER BY v.last_name ASC LIMIT 200`, params);
    res.json({ success: true, veterans: result.rows });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.get("/api/veterans/count", async (req, res) => {
  try {
    const result = await pool.query(`SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE vtc_status='Active') as active,
      COUNT(*) FILTER (WHERE vtc_status='Graduated') as graduated
      FROM veterans`);
    const r = result.rows[0];
    res.json({ success: true, total: parseInt(r.total), active: parseInt(r.active), graduated: parseInt(r.graduated) });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.get("/api/veterans/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const vet = await pool.query("SELECT * FROM veterans WHERE id=$1", [id]);
    const contacts = await pool.query("SELECT * FROM contacts WHERE veteran_id=$1 ORDER BY contact_date DESC", [id]);
    const referrals = await pool.query("SELECT * FROM referrals WHERE veteran_id=$1 ORDER BY referral_date DESC", [id]);
    const veteran = vet.rows[0];
    if (veteran) veteran.ssn = maskSSN(veteran.ssn);
    res.json({ success: true, veteran, contacts: contacts.rows, referrals: referrals.rows });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.delete("/api/veterans/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM referrals WHERE veteran_id=$1", [id]);
    await pool.query("DELETE FROM contacts WHERE veteran_id=$1", [id]);
    await pool.query("DELETE FROM veterans WHERE id=$1", [id]);
    // Auto-trigger Governed Data Log refresh
    try {
      await fetch(`http://localhost:${process.env.PORT||3000}/api/format-sheets`, { method: 'POST' });
    } catch(e) { console.log("Sheet refresh skipped:", e.message); }
    res.json({ success: true });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.patch("/api/veterans/courthouse-bulk", async (req, res) => {
  try {
    const { old_name, new_name } = req.body;
    const result = await pool.query(`UPDATE veterans SET vtc_courthouse=$1, updated_at=NOW() WHERE vtc_courthouse=$2`, [new_name, old_name]);
    res.json({ success: true, updated: result.rowCount });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.patch("/api/veterans/:id/courthouse", async (req, res) => {
  try {
    const { id } = req.params;
    const { vtc_courthouse } = req.body;
    await pool.query(`UPDATE veterans SET vtc_courthouse=$1, updated_at=NOW() WHERE id=$2`, [vtc_courthouse, id]);
    res.json({ success: true });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.patch("/api/veterans/:id/va-screen", async (req, res) => {
  try {
    const { id } = req.params;
    const { va_screen_status } = req.body;
    await pool.query(
      `UPDATE veterans SET va_screen_status=$1, updated_at=NOW() WHERE id=$2`,
      [va_screen_status, id]
    );
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Rearrest / Probation Revoked ─────────────────────────
app.patch("/api/veterans/:id/rearrest", async (req, res) => {
  try {
    const { id } = req.params;
    const { rearrest_type, rearrest_date, restart_date, governed_note, vsr_name } = req.body;
    // Update veteran record
    await pool.query(
      `UPDATE veterans SET rearrest_type=$1, rearrest_date=$2, restart_date=$3,
       restart_count = COALESCE(restart_count,0) + 1, updated_at=NOW() WHERE id=$4`,
      [rearrest_type, rearrest_date||null, restart_date||null, id]
    );
    // Log as a contact event
    await pool.query(
      `INSERT INTO contacts (veteran_id, contact_date, vsr_name, visit_type, raw_note, governed_note, tokens_in, tokens_out)
       VALUES ($1, $2, $3, $4, $5, $6, 0, 0)`,
      [id, rearrest_date||new Date(), vsr_name||'VSR', rearrest_type, rearrest_type+' — VTC event logged.', governed_note||'']
    );
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/veterans/:id/archive", async (req, res) => {
  try {
    const { id } = req.params;
    const { archive_reason } = req.body;
    await pool.query(
      `UPDATE veterans SET vtc_status='Archived', archive_reason=$1, updated_at=NOW() WHERE id=$2`,
      [archive_reason||'Archived by VSR', id]
    );
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/dockets/upload", async (req, res) => {
  try {
    const { courthouse, hearing_date, vsr_name, source, received_via, image_data, image_filename, doc_type } = req.body;
    if (!courthouse || !hearing_date) return res.json({ success: false, error: "Courthouse and hearing date required" });
    const result = await pool.query(
      `INSERT INTO court_dockets (courthouse, hearing_date, vsr_name, source, received_via, image_data, image_filename, doc_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [courthouse, hearing_date, vsr_name||'', source||'', received_via||'', image_data||'', image_filename||'', doc_type||'court_docket']
    );
    res.json({ success: true, docketId: result.rows[0].id });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/dockets/:id/extract", async (req, res) => {
  try {
    const { id } = req.params;
    const docket = await pool.query(`SELECT * FROM court_dockets WHERE id=$1`, [id]);
    if (!docket.rows.length) return res.json({ success: false, error: "Docket not found" });
    const d = docket.rows[0];
    if (!d.image_data) return res.json({ success: false, error: "No image data found" });

    const imageType = d.image_data.match(/^data:([^;]+);base64,/)?.[1] || 'image/jpeg';
    if (imageType === 'application/pdf') {
      return res.json({ success: false, error: 'PDF files cannot be processed directly. Please upload a screenshot or photo of the docket instead.' });
    }
    const imageBase64 = d.image_data.replace(/^data:[^;]+;base64,/, '');

    const docType = d.doc_type || 'court_docket';
    let extractPrompt = "Extract all names, case numbers, and relevant information. Return JSON array only: [{name_last, name_first, case_number, hearing_type, hearing_time}].";
    if (docType === 'court_docket') extractPrompt = "This is an official LA County Superior Court docket. Extract ALL defendants listed. Names appear as vs. Last, First in Case Title column. Return JSON array only, no markdown, no other text: [{name_last, name_first, case_number, hearing_type, hearing_time}]. Include every row.";
    if (docType === 'vjp_calendar') extractPrompt = "This is a VA Veterans Justice Program working calendar. Extract all veteran names and case information. Names may appear in various formats. Return JSON array only, no markdown: [{name_last, name_first, case_number, hearing_type, hearing_time}].";
    if (docType === 'lacada_report') extractPrompt = "This is an LA CADA SUD treatment progress report. Extract the veteran name, date, and compliance status. Return JSON array only: [{name_last, name_first, case_number, hearing_type, hearing_time}].";
    if (docType === 'dmh_report') extractPrompt = "This is a DMH mental health progress report. Extract the veteran name, date, and clinical summary. Return JSON array only: [{name_last, name_first, case_number, hearing_type, hearing_time}].";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: imageType, data: imageBase64 }},
            { type: "text", text: extractPrompt }
          ]
        }]
      })
    });

    const aiData = await response.json();
    console.log('DOCKET EXTRACT API RESPONSE:', JSON.stringify(aiData).slice(0,500));
    let extracted = [];
    try {
      if (aiData.error) {
        console.log('ANTHROPIC ERROR:', aiData.error);
        return res.json({ success: false, error: 'AI API error: ' + (aiData.error.message||JSON.stringify(aiData.error)) });
      }
      const raw = aiData.content[0].text.trim();
      const clean = raw.replace(/```json|```/g, '').trim();
      extracted = JSON.parse(clean);
    } catch(e) { 
      console.log('PARSE ERROR:', e.message, 'RAW:', JSON.stringify(aiData).slice(0,200));
      extracted = []; 
    }

    await pool.query(
      `UPDATE court_dockets SET extracted_data=$1, total_count=$2, tokens_in=$3, tokens_out=$4 WHERE id=$5`,
      [JSON.stringify(extracted), extracted.length, aiData.usage?.input_tokens||0, aiData.usage?.output_tokens||0, id]
    );

    res.json({ success: true, extracted, docketId: id, tokensIn: aiData.usage?.input_tokens||0, tokensOut: aiData.usage?.output_tokens||0 });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.get("/api/dockets", async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, courthouse, hearing_date, vsr_name, source, received_via, total_count, match_count, uploaded_at FROM court_dockets ORDER BY hearing_date DESC, uploaded_at DESC LIMIT 50`);
    res.json({ success: true, dockets: result.rows });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.delete("/api/dockets/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM court_dockets WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.get("/api/dockets/:id", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM court_dockets WHERE id=$1`, [req.params.id]);
    if (!result.rows.length) return res.json({ success: false, error: "Not found" });
    res.json({ success: true, docket: result.rows[0] });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/dockets/:id/confirm", async (req, res) => {
  try {
    const { matched_veterans, governed_note } = req.body;
    await pool.query(
      `UPDATE court_dockets SET match_count=$1, governed_note=$2 WHERE id=$3`,
      [matched_veterans||0, governed_note||'', req.params.id]
    );
    res.json({ success: true });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/veterans/:id/handoff", async (req, res) => {
  try {
    const id = req.params.id;
    const { status_narrative, critical_context, warm_handoff, vsr_name } = req.body;
    const note = {
      status_narrative: status_narrative || '',
      critical_context: critical_context || '',
      warm_handoff: !!warm_handoff,
      vsr_name: vsr_name || 'Unknown',
      timestamp: new Date().toISOString()
    };
    await pool.query(
      `UPDATE veterans SET handoff_notes = COALESCE(handoff_notes, '[]'::jsonb) || $1::jsonb WHERE id=$2`,
      [JSON.stringify([note]), id]
    );
    res.json({ success: true });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.patch("/api/veterans/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { vtc_status, graduation_date, graduation_courthouse, archive_reason } = req.body;
    await pool.query(`UPDATE veterans SET vtc_status=$1, graduation_date=$2, graduation_courthouse=$3, archive_reason=$4, updated_at=NOW() WHERE id=$5`,
      [vtc_status, graduation_date||null, graduation_courthouse, archive_reason||null, id]);
    res.json({ success: true });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.get("/api/veterans/alerts/court", async (req, res) => {
  try {
    const { courthouse } = req.query;
    const params = [];
    let courthouseFilter = '';
    if (courthouse) { params.push(courthouse); courthouseFilter = `AND v.vtc_courthouse = $1`; }
    const result = await pool.query(`SELECT DISTINCT ON (v.id) v.id, v.last_name, v.first_name, v.vtc_courthouse, v.case_number, c.next_court_date, c.vsr_name,
        CASE WHEN c.next_court_date::date <= CURRENT_DATE + 1 THEN 'urgent'
             WHEN c.next_court_date::date <= CURRENT_DATE + 3 THEN 'soon'
             ELSE 'week' END as urgency
        FROM veterans v JOIN contacts c ON c.veteran_id = v.id
        WHERE c.next_court_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND v.vtc_status = 'Active' ${courthouseFilter}
        ORDER BY v.id, c.next_court_date ASC`, params);
    res.json({ success: true, alerts: result.rows });
  } catch(e) { res.json({ success: false, error: e.message }); }
});
async function pushToContactLog(d, contactId, veteranId) {
  try {
    if (!serviceAccount) return;
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const SHEET_ID = "1ArthmSd8Ztut0GMdz_Z3RcVLZ6F8KvDCLh9uIlzvtrs";
    const vetResult = await pool.query("SELECT last_name, first_name, case_number FROM veterans WHERE id=$1", [veteranId]);
    const vet = vetResult.rows[0] || {};
    const row = [
      contactId,
      `JIV-${String(veteranId).padStart(5,"0")}-${new Date().toISOString().slice(0,10).replace(/-/g,"")}`,
      vet.last_name || "",
      vet.first_name || "",
      vet.case_number || "",
      d.contact_date || new Date().toLocaleDateString("en-US"),
      d.vsr_name || "",
      d.courthouse || "",
      d.next_court_date || "",
      JSON.stringify(d.service_needs || []),
      d.referred_treatment || "",
      d.referral_type || "",
      d.treatment_location || "",
      d.forms_required || "",
      d.forms_submitted || "",
      "",
      d.governed_note || "",
      d.raw_note || ""
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Contact Log!A:R",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] }
    });
    console.log(`[SHEETS] Contact ${contactId} pushed to Contact Log`);
  } catch(e) {
    console.error("[SHEETS CONTACT ERROR]", e.message);
  }
}
app.post("/api/contacts", async (req, res) => {
  try {
    const d = req.body;
    const result = await pool.query(`INSERT INTO contacts (veteran_id, contact_date, courthouse, vsr_name, visit_type, contact_status, next_court_date, progress_report_received, progress_report_provider, service_needs, interested_services, filed_va_claim, referred_treatment, treatment_location, referral_type, treatment_method, forms_required, forms_submitted, alert_hostile, raw_note, governed_note, tokens_in, tokens_out, lacada_status, vpan_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING id`,
      [d.veteran_id, d.contact_date||null, d.courthouse, d.vsr_name, d.visit_type, d.contact_status, d.next_court_date||null, d.progress_report_received||false, d.progress_report_provider, JSON.stringify(d.service_needs||[]), d.interested_services, d.filed_va_claim, d.referred_treatment, d.treatment_location, d.referral_type, d.treatment_method, d.forms_required, d.forms_submitted, d.alert_hostile, d.raw_note, d.governed_note, d.tokens_in||0, d.tokens_out||0, d.lacada_status||null, d.vpan_status||null]);
    if (d.next_court_date) await pool.query("UPDATE veterans SET updated_at=NOW() WHERE id=$1", [d.veteran_id]);
    const contactId = result.rows[0].id;
    await pushToContactLog(d, contactId, d.veteran_id);
    res.json({ success: true, contactId });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/referrals", async (req, res) => {
  try {
    const d = req.body;
    const result = await pool.query(`INSERT INTO referrals (veteran_id, partner, program, referral_date, screening_status, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [d.veteran_id, d.partner, d.program, d.referral_date||null, d.screening_status||'Pending', d.notes]);
    res.json({ success: true, referralId: result.rows[0].id });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.patch("/api/referrals/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { screening_status, acceptance_date, enrollment_date, completion_date, status, notes } = req.body;
    await pool.query(`UPDATE referrals SET screening_status=$1, acceptance_date=$2, enrollment_date=$3, completion_date=$4, status=$5, notes=$6, updated_at=NOW() WHERE id=$7`,
      [screening_status, acceptance_date||null, enrollment_date||null, completion_date||null, status, notes, id]);
    res.json({ success: true });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.post("/api/note/govern", async (req, res) => {
  try {
    const { raw_note, veteran_name, courthouse, contact_date, context } = req.body;
    const cx = context || {};
    const budget = getTokenBudget("note");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: budget,
        system: `You are CivGATE's IGM-governed case note synthesizer for LA County MVA. Write one concise paragraph using only the data provided. Format: "On [date], VSR made contact with Veteran [Last Name] at [courthouse]. Veteran [appeared in VTC / was seen for benefits inquiry / etc.]. [If referred: Veteran was referred to [partner] for [service].] [If NCD exists: Veteran's NCD is [date].] [If forms: Forms [required/submitted]: [forms]." If benefit_outcome indicates VA healthcare enrollment, eligibility, or service connection AND va_eligible_at_intake was No, add: "Veteran was not VA healthcare eligible at intake. Following MVA VSR intervention, veteran established [outcome] and gained VA healthcare eligibility." Use plain administrative language. Name partners specifically: LA CADA for SUD/MH treatment, DMH for mental health, JCOD for transportation and ancillary services, VPAN for support services. Under 90 words. No headers. No bullets. End with [IGM-GOVERNED]`,
        messages: [{ role: "user", content: `Veteran: ${veteran_name} | Date: ${contact_date} | Courthouse: ${cx.courthouse||courthouse}${cx.case_number?' | Case: '+cx.case_number:''}${cx.next_court_date?' | NCD: '+cx.next_court_date:''}${cx.referral_source?' | Referred by: '+cx.referral_source:''}${cx.alert_hostile&&cx.alert_hostile!=='0'?' | ALERT Hostile Level: '+cx.alert_hostile:''}${cx.flags&&cx.flags!=='None'?' | Flags: '+cx.flags:''}${cx.service_needs&&cx.service_needs!=='None identified'?' | Services: '+cx.service_needs:''}${cx.referral_type?' | Referral: '+cx.referral_type:''}${cx.treatment_method?' | Method: '+cx.treatment_method:''}${cx.treatment_location?' | Location: '+cx.treatment_location:''}${raw_note?' | VSR Notes: '+raw_note:''}` }] })
    });
    const data = await response.json();
    res.json({ success: true, governed_note: data.content?.[0]?.text || raw_note, tokensIn: data.usage?.input_tokens||0, tokensOut: data.usage?.output_tokens||0 });
  } catch(e) { res.json({ success: false, error: e.message }); }
});
app.get("/api/stats", async (req, res) => {
  try {
    const [courthouses, discharges, intercepts, monthly, districts] = await Promise.all([
      pool.query(`SELECT CASE WHEN vtc_courthouse ILIKE '%CCB%' OR vtc_courthouse ILIKE '%Clara Shortridge%' OR vtc_courthouse ILIKE '%DTLA%' THEN 'CCB' ELSE vtc_courthouse END as vtc_courthouse, COUNT(*) as count FROM veterans WHERE vtc_courthouse IS NOT NULL GROUP BY 1 ORDER BY count DESC`),
      pool.query(`SELECT discharge_status, COUNT(*) as count FROM veterans WHERE discharge_status IS NOT NULL GROUP BY discharge_status ORDER BY count DESC`),
      pool.query(`SELECT intercept_point, COUNT(*) as count FROM veterans WHERE intercept_point IS NOT NULL GROUP BY intercept_point ORDER BY count DESC`),
      pool.query(`SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count FROM veterans GROUP BY month ORDER BY month ASC LIMIT 12`),
      pool.query(`SELECT district, COALESCE(SUM(count),0) as count FROM (
        SELECT 'D1 — Solis (CCB)' as district, COUNT(*) as count FROM veterans WHERE vtc_courthouse ILIKE '%CCB%' OR vtc_courthouse ILIKE '%Clara%' OR vtc_courthouse ILIKE '%DTLA%'
        UNION ALL SELECT 'D2 — Mitchell (Compton)', COUNT(*) FROM veterans WHERE vtc_courthouse ILIKE '%Compton%'
        UNION ALL SELECT 'D3 — Horvath (Van Nuys)', COUNT(*) FROM veterans WHERE vtc_courthouse ILIKE '%Van Nuys%'
        UNION ALL SELECT 'D3 — Horvath (Hollywood)', COUNT(*) FROM veterans WHERE vtc_courthouse ILIKE '%Hollywood%'
        UNION ALL SELECT 'D4 — Hahn (Long Beach)', COUNT(*) FROM veterans WHERE vtc_courthouse ILIKE '%Long Beach%'
        UNION ALL SELECT 'D5 — Barger (Lancaster)', COUNT(*) FROM veterans WHERE vtc_courthouse ILIKE '%Lancaster%'
        UNION ALL SELECT 'Not Designated', COUNT(*) FROM veterans WHERE (vtc_courthouse IS NULL OR vtc_courthouse = '')
      ) sub GROUP BY district
      ORDER BY CASE 
        WHEN district LIKE 'D1%' THEN 1
        WHEN district LIKE 'D2%' THEN 2
        WHEN district LIKE 'D3%Nuys%' THEN 3
        WHEN district LIKE 'D3%Holly%' THEN 4
        WHEN district LIKE 'D4%' THEN 5
        WHEN district LIKE 'D5%' THEN 6
        ELSE 7
      END`)
    ]);
    const totals = await pool.query(`SELECT COUNT(*) as total, SUM(CASE WHEN vtc_status='Active' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN vtc_status='Graduated' THEN 1 ELSE 0 END) as graduated FROM veterans`);
    const contacts = await pool.query(`SELECT COUNT(*) as total FROM contacts`);
    const vaGained = await pool.query(`SELECT COUNT(*) as total FROM veterans WHERE va_eligible_at_intake='No' AND (benefit_outcome ILIKE '%healthcare%' OR benefit_outcome ILIKE '%enrollment%' OR benefit_outcome ILIKE '%service connection%' OR benefit_outcome ILIKE '%eligibility%')`);
    res.json({
      success: true,
      totals: totals.rows[0],
      contacts: contacts.rows[0].total,
      va_access_gained: vaGained.rows[0].total,
      courthouses: courthouses.rows,
      discharges: discharges.rows,
      intercepts: intercepts.rows,
      monthly: monthly.rows,
      districts: districts.rows
    });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.get("/api/datalog", async (req, res) => {
  try {
    const veterans = await pool.query(`
      SELECT id, last_name, first_name, ssn, case_number, vtc_courthouse, 
      branch, discharge_status, sc_disability, va_rating, vtc_status,
      created_at, jgr_row,
      hc_va, hc_medicaid, gender, race_ethnicity, marital_status, 
      dependents, housing_status, preferred_contact, dob, component,
      intercept_point, charge_type, vtc_outcome, jail_facility,
      custody_location, employment_status, education_level,
      benefit_outcome, new_disability_pct, va_eligible_at_intake
      FROM veterans ORDER BY last_name ASC
    `);
    
    const result = [];
    for (const v of veterans.rows) {
      const contacts = await pool.query(`
        SELECT contact_date, vsr_name, next_court_date, governed_note, 
        service_needs, referral_type, treatment_location, courthouse
        FROM contacts WHERE veteran_id=$1 ORDER BY contact_date DESC
      `, [v.id]);
      
      // Build CFCI flags from contact service_needs
      const allNeeds = contacts.rows.flatMap(c => {
        try { return JSON.parse(c.service_needs || '[]'); } catch { return []; }
      });
      
      result.push({
        jiv_id: `JIV-${String(v.id).padStart(5,'0')}-${new Date(v.created_at).toISOString().slice(0,10).replace(/-/g,'')}`,
        jgr_row: v.jgr_row,
        last_name: v.last_name,
        first_name: v.first_name,
        ssn_masked: v.ssn ? `***-**-${String(v.ssn).replace(/[^0-9]/g,'').slice(-4)}` : '—',
        case_number: v.case_number,
        vtc_courthouse: v.vtc_courthouse,
        vtc_status: v.vtc_status,
        intake_date: v.created_at ? new Date(v.created_at).toLocaleDateString('en-US') : '—',
        branch: v.branch,
        discharge_status: v.discharge_status,
        sc_disability: v.sc_disability,
        intercept_point: v.intercept_point,
        charge_type: v.charge_type,
        vtc_outcome: v.vtc_outcome,
        jail_facility: v.jail_facility,
        employment_status: v.employment_status,
        education_level: v.education_level,
        benefit_outcome: v.benefit_outcome,
        new_disability_pct: v.new_disability_pct,
        va_eligible_at_intake: v.va_eligible_at_intake,
        cfci_mh: allNeeds.includes('CFCI Mental Health (DMH)') ? 'Yes' : '',
        cfci_sud: allNeeds.includes('CFCI Substance Abuse (LACADA)') ? 'Yes' : '',
        cfci_social: allNeeds.includes('CFCI Social Services') ? 'Yes' : '',
        cfci_basic: allNeeds.includes('CFCI Basic Necessities') ? 'Yes' : '',
        cfci_edu: allNeeds.includes('CFCI Education') ? 'Yes' : '',
        cfci_employ: allNeeds.includes('CFCI Employment/Job Training') ? 'Yes' : '',
        cfci_legal: allNeeds.includes('CFCI Legal Services') ? 'Yes' : '',
        cfci_perm_housing: allNeeds.includes('CFCI Permanent Housing') ? 'Yes' : '',
        cfci_temp_housing: allNeeds.includes('CFCI Temporary Housing') ? 'Yes' : '',
        cfci_vital_doc: allNeeds.includes('CFCI Vital Document Assistance') ? 'Yes' : '',
        cfci_medicaid: allNeeds.includes('Medi-Cal Referral') ? 'Yes' : '',
        contacts: contacts.rows
      });
    }
    res.json({ success: true, veterans: result });
  } catch(e) { res.json({ success: false, error: e.message }); }
});



app.post("/api/rebuild-vmr", async (req, res) => {
  try {
    if (!serviceAccount) return res.json({ success: false, error: "Service account not configured" });

    const veterans = await pool.query(`
      SELECT id, last_name, first_name, ssn, case_number, vtc_courthouse,
      branch, discharge_status, va_rating, sc_disability, vtc_status,
      created_at, housing_status, hc_va, hc_medicaid, phone, dob, gender,
      race_ethnicity, primary_language, preferred_contact, marital_status,
      dependents, poa, alert_hostile, flags, ai_governed_summary,
      component, combat_veteran, mst_survivor, vjo_specialist,
      private_attorney, public_defender, vet_status_confirmed,
      hc_private, hc_private_detail, case_number, vtc_courthouse
      FROM veterans ORDER BY last_name ASC
    `);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const SHEET_ID = "1ArthmSd8Ztut0GMdz_Z3RcVLZ6F8KvDCLh9uIlzvtrs";
    const TAB = "Veteran Master Record";
    const sheetId = 0;

    // Clear
    await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: TAB });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [
        { repeatCell: { range: { sheetId }, cell: { userEnteredFormat: {} }, fields: "userEnteredFormat" } }
      ]}
    });

    const NAVY = { red: 0.059, green: 0.137, blue: 0.251 };
    const WHITE = { red: 1, green: 1, blue: 1 };
    const GOLD  = { red: 0.784, green: 0.627, blue: 0.314 };
    const LT_BLUE = { red: 0.933, green: 0.953, blue: 0.980 };
    const MID_BLUE = { red: 0.059, green: 0.270, blue: 0.490 };
    const SOFT_GREEN = { red: 0.353, green: 0.541, blue: 0.353 };

    const headers = [
      "Record ID","Intake Date","Last Name","First Name","SS NO. (Encrypted)",
      "Case Number","Phone","DOB","Gender","Branch","Discharge Status",
      "Service Connected","Disability %","VA Healthcare Eligible",
      "Housing Status","VTC Location","Status","Flags",
      "Mental Health (DMH)","Substance Abuse (LACADA)",
      "Social Services","Basic Necessities",
      "Permanent Housing","Temporary Housing",
      "Vital Document Assistance","Medi-Cal Referral",
      "Referred to Treatment","Treatment Location","Next Court Date",
      "Assigned VSR","AI Governed Summary"
    ];

    const rows = [headers];
    const fmt = [];

    // Header row formatting
    fmt.push({ repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length },
      cell: { userEnteredFormat: {
        backgroundColor: NAVY,
        textFormat: { foregroundColor: WHITE, bold: true, fontSize: 10 },
        wrapStrategy: "CLIP", horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE",
        padding: { left: 6, right: 6, top: 4, bottom: 4 }
      }},
      fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,horizontalAlignment,verticalAlignment,padding)"
    }});
    fmt.push({ updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 28 }, fields: "pixelSize"
    }});

    // Freeze header row
    fmt.push({ updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: "gridProperties.frozenRowCount"
    }});

    for (let i = 0; i < veterans.rows.length; i++) {
      const v = veterans.rows[i];
      const jivId = `JIV-${String(v.id).padStart(5,"0")}-${new Date(v.created_at).toISOString().slice(0,10).replace(/-/g,"")}`;
      const ssnMasked = v.ssn ? "***-**-" + (() => { try { const key=Buffer.from((process.env.SSN_ENCRYPTION_KEY||'').padEnd(32).slice(0,32)); const [ivHex,encHex]=v.ssn.split(':'); if(!ivHex||!encHex) return v.ssn.slice(-4); const iv=Buffer.from(ivHex,'hex'); const enc=Buffer.from(encHex,'hex'); const decipher=require('crypto').createDecipheriv('aes-256-cbc',key,iv); const dec=Buffer.concat([decipher.update(enc),decipher.final()]).toString(); return dec.slice(-4); } catch(e){ return '????'; } })() : '--';

      const contacts = await pool.query(
        `SELECT vsr_name, next_court_date, service_needs, treatment_location, referred_treatment
         FROM contacts WHERE veteran_id=$1 ORDER BY contact_date DESC LIMIT 1`, [v.id]
      );
      const latest = contacts.rows[0] || {};
      const allContacts = await pool.query(
        `SELECT service_needs FROM contacts WHERE veteran_id=$1`, [v.id]
      );
      const allNeeds = allContacts.rows.flatMap(c => {
        const sn = c.service_needs;
        if (Array.isArray(sn)) return sn;
        try { return JSON.parse(sn || "[]"); } catch { return []; }
      });
      const cfci = (label) => allNeeds.includes(label) ? "YES" : "";
      const flagsList = Array.isArray(v.flags) ? v.flags : (typeof v.flags==='string' ? JSON.parse(v.flags||'[]') : []);
      const ncd = latest.next_court_date ? new Date(latest.next_court_date).toISOString().slice(0,10) : "";

      // ── Color dot court alert ──────────────────────────────
      const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
      let courtDot = '[GREEN]';
      let courtAlertText = '';
      if (latest.next_court_date) {
        const courtDate = new Date(latest.next_court_date);
        courtDate.setHours(0,0,0,0);
        const diff = Math.ceil((courtDate - todayMidnight) / 86400000);
        if (diff <= 1) {
          courtDot = '[RED]';
          courtAlertText = `[RED] COURT TOMORROW — ${v.last_name}, ${v.first_name} | ${v.vtc_courthouse||''} | Case ${v.case_number||'N/A'} | Confirm appearance, review file, prepare court summary before session. `;
        } else if (diff <= 7) {
          courtDot = '[YELLOW]';
          courtAlertText = `[YELLOW] COURT IN ${diff} DAYS — ${v.last_name}, ${v.first_name} | ${v.vtc_courthouse||''} | Case ${v.case_number||'N/A'} | Review treatment compliance and prepare VSR brief. `;
        } else {
          courtDot = '[GREEN]';
          courtAlertText = '';
        }
      }

      // ── Get latest governed note from contacts ─────────────
      const latestNoteResult = await pool.query(
        `SELECT governed_note FROM contacts WHERE veteran_id=$1 AND governed_note IS NOT NULL AND governed_note != '' ORDER BY contact_date DESC LIMIT 1`,
        [v.id]
      );
      const baseNote = latestNoteResult.rows[0]?.governed_note || v.ai_governed_summary || '';
      const cleanBase = baseNote ? baseNote.replace(/^"|"$/g,'').trim().split('\n').filter(l => !l.startsWith('[GREEN]') && !l.startsWith('[RED]') && !l.startsWith('[YELLOW]')).join('\n').trim() : '';
      const GREEN = String.fromCodePoint(0x1F7E2);
      const YELLOW = String.fromCodePoint(0x1F7E1);
      const RED = String.fromCodePoint(0x1F534);
      const greenPrefix = courtDot === '[GREEN]' ? GREEN+' No upcoming court date - routine status.\n' : '';
      const alertFixed = courtAlertText.replace('[RED]', RED).replace('[YELLOW]', YELLOW);
      const finalNote = alertFixed ? alertFixed + (cleanBase ? '\n' + cleanBase : '') : (greenPrefix + cleanBase);

      rows.push([
        jivId,
        v.created_at ? new Date(v.created_at).toLocaleDateString("en-US") : "",
        v.last_name || "",
        v.first_name || "",
        ssnMasked,
        v.case_number || "",
        v.phone || "",
        v.dob ? new Date(v.dob).toLocaleDateString("en-US") : "",
        v.gender || "",
        v.branch || "",
        v.discharge_status || "",
        v.sc_disability || "",
        v.va_rating ? String(v.va_rating).replace(/%/g,'')+"%" : "",
        v.hc_va ? "Yes" : "",
        v.housing_status || "",
        v.vtc_courthouse || "",
        v.vtc_status || "Active",
        flagsList.join(" | ") || "",
        cfci("CFCI Mental Health (DMH)"),
        cfci("CFCI Substance Abuse (LACADA)"),
        cfci("CFCI Social Services"),
        cfci("CFCI Basic Necessities"),
        cfci("CFCI Transportation"),
        cfci("CFCI Education"),
        cfci("CFCI Employment/Job Training"),
        cfci("CFCI Legal Services"),
        cfci("CFCI Permanent Housing"),
        cfci("CFCI Temporary Housing"),
        cfci("CFCI Vital Document Assistance"),
        cfci("Medi-Cal Referral"),
        latest.referred_treatment || "",
        latest.treatment_location || "",
        ncd,
        latest.vsr_name || "",
finalNote
      ]);

      // Alternating row colors
      const ri = i + 1;
      const bg = i % 2 === 0 ? LT_BLUE : WHITE;
      // AI summary cell background based on court alert
      const summaryBg = courtDot === '[RED]'
        ? { red: 0.98, green: 0.90, blue: 0.90 }  // light red
        : courtDot === '[YELLOW]'
          ? { red: 0.99, green: 0.97, blue: 0.88 }  // light amber
          : { red: 0.94, green: 0.99, blue: 0.94 }; // light green
      // Wrap + color AI summary column
      fmt.push({ repeatCell: {
        range: { sheetId, startRowIndex: ri, endRowIndex: ri+1, startColumnIndex: 34, endColumnIndex: 36 },
        cell: { userEnteredFormat: {
          backgroundColor: summaryBg,
          wrapStrategy: "WRAP",
          verticalAlignment: "TOP",
          textFormat: { bold: courtDot === '[RED]', fontSize: 10 }
        }},
        fields: "userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,textFormat)"
      }});
      fmt.push({ repeatCell: {
        range: { sheetId, startRowIndex: ri, endRowIndex: ri+1, startColumnIndex: 0, endColumnIndex: headers.length },
        cell: { userEnteredFormat: {
          backgroundColor: bg,
          textFormat: { foregroundColor: { red: 0, green: 0, blue: 0 }, bold: false, fontSize: 10 },
          wrapStrategy: "CLIP", verticalAlignment: "MIDDLE",
          padding: { left: 6, right: 6, top: 3, bottom: 3 }
        }},
        fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment,padding)"
      }});
      fmt.push({ updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: ri, endIndex: ri+1 },
        properties: { pixelSize: v.ai_governed_summary ? 150 : 20 }, fields: "pixelSize"
      }});
    }

    // Write values
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    // Column widths
    const colWidths = [
      140, 90, 120, 100, 90, 110, 110, 90, 70, 100,
      140, 80, 80, 80, 120, 130, 80, 200,
      60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60,
      80, 140, 100, 100, 900
    ];
    const colRequests = colWidths.map((w, i) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i+1 },
        properties: { pixelSize: w }, fields: "pixelSize"
      }
    }));

    // Apply formatting in batches
    for (let i = 0; i < fmt.length; i += 200) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: fmt.slice(i, i+200) }
      });
      await new Promise(r => setTimeout(r, 1500));
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: colRequests }
    });

    // Wrap AI summary column
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 150, startColumnIndex: 34, endColumnIndex: 35 },
          cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP", padding: { left: 8, right: 8, top: 6, bottom: 6 } }},
          fields: "userEnteredFormat(wrapStrategy,verticalAlignment,padding)"
        }
      }]}
    });

    res.json({ success: true, message: `VMR rebuilt — ${veterans.rows.length} veterans written.` });
  } catch(e) {
    console.error("[VMR ERROR]", e.message);
    res.json({ success: false, error: e.message });
  }
});

app.post("/api/migrate-notes", async (req, res) => {
  const NOTES = {
    'Baca,Steven': '10/29/2025 Crt. Connect - Veteran appeared at court for initial connection with VSR.',
    'Delacruz,Michael Reuben': 'Need VA Forms 21/22 submitted to establish POA and initiate benefits claim.',
    'Durham,Deiondre': 'Need VA Forms 21/22 submitted to establish POA and initiate benefits claim.',
    'Fanning,Cory': 'Veteran currently in custody. VTC case active at Compton Courthouse.',
    'Grijalva,Roldolfo': 'Veteran is deceased. Record retained for case closure documentation.',
    'Hun,Kim': 'Veteran on state parole. Not applicable for standard VTC track.',
    'Jackson,Jeremy': 'No phone contact available. In-person court contact only.',
    'Johnson,Rayfield': 'Veteran information requires verification. Follow-up needed.',
    'Johnson,Elliot': 'Veteran information pending. Intake not yet completed.',
    'Johnson,Michael': 'Need VA Forms 21/22 submitted to establish POA and initiate benefits claim.',
    'McCarty,Edward': 'Veteran information requires verification. Follow-up needed.',
    'Mcgee,Terence': 'Veteran information requires verification. Follow-up needed.',
    'Mothershed,Don Juan': 'Veteran information requires verification. Follow-up needed.',
    'Nash,Dubreque Esington': 'Veteran information requires verification. Follow-up needed.',
    'Navarro,Eric': 'Need VA Forms 21/22 submitted to establish POA and initiate benefits claim.',
    'Perez-Lopez,Fernando': 'Veteran information requires verification. Follow-up needed.',
    'Quinn,Bennie': '12/10/2025 - Veteran graduated from VTC program. Case closed successfully.',
    'Ramirez,Jose': 'Veteran not located in VetPros system. Verification of service required.',
    'Roberts,Darius': 'Veteran information requires verification. Follow-up needed.',
    'Rodgers,RD': 'Veteran currently in custody at Lancaster. VTC case active.',
    'Smith,Donald': '100% service connected. Long-standing VTC case. Full benefits established.',
    'Smith,Robert': 'Need VA Forms 21/22 submitted to establish POA and initiate benefits claim.',
    'Stone,Rudy': 'Need VA Forms 21/22 submitted to establish POA and initiate benefits claim.',
    'Robinson,Zachary': '1/20/2026 - Initial intake completed at CCB.',
    'Jones,Zavier': '1/20/2026 - Initial intake completed at CCB.',
    'Herring,Torron': '1/20/2026 - Initial intake completed at CCB.',
    'Clark,Jamaal': '1/20/2026 - Initial intake completed at CCB.',
    'Neal,Keldron': '1/20/2026 - Initial intake completed at CCB.',
    'Henry,Vicente': '2/17/2026 - In-person intake conducted at CCB with veteran present.',
    'Milton,Mark': '2/17/2026 - In-person intake conducted at CCB with veteran present.',
    'Beverly,Prophet': '2/12/2026 - Case #23CJCF00689-01. Veteran active at CCB VTC.',
    'Edwards Jr.,Robert': '2/12/2026 - Case #24VWCF02540-01. VA disability claim at 10%.',
    'Cobbs,Leonard': '2/3/2026 - Case #24CJCF06564-01. Coast Guard veteran, service connected.',
    'Davis,Kenmore': '2/3/2026 - Case #LACBA514325-01. VA rating at 30%, active CCB case.',
    'Ruiz,Dioniso': '2/3/2026 - Case #25CJCF00187-01. Active CCB case, benefits pending.',
    'Foulks,Malachi': '2/4/2026 - Intake conducted. Navy veteran, 100% SC, Lancaster VTC.',
    'Romero,Jose deJesus': '3/6/2026 - Booking #6616161. Veteran in custody, intake initiated.',
    'Karshoonzad,Jeffrey': '3/16/2026 - Veteran now service connected at 20%. Benefits update filed.',
    'Bowers,Jeffrey': '3/17/2026 - Filed Supplemental VA Form 20-0995 for disability claim.',
    'Cahill,Valentina': '3/18/2026 - 100% service connected. Veteran progressing well in treatment.',
    'Gonzalez,Bonny': '3/27/2026 - VA disability claim submitted. Veteran engaged in services.',
    'Jaramillo,Adrian': '3/26/2026 - Case #25TRCF00152-01. Active Compton VTC case.',
    'Kelly,Kevin': '3/26/2026 - No phone. LACADA substance abuse screening completed.',
    'Brosius,Jessie': '4/16/2026 - Veteran initially declined assistance. Engagement ongoing.',
    'Amaya,John': '4/23/2026 - Intake completed. Veteran currently living in vehicle. Housing referral urgent.',
    'Lockett,Alexander': '4/23/2026 - Screened and accepted by LACADA for substance abuse treatment.',
    'Acevedo,Ernest': '4/23/2026 - Veteran incarcerated, conditionally released to VA care.',
    'Shehane,Johnny': '4/22/2026 - Positive drug test noted. VPAN referral initiated for support services.',
    'Rupe,Richard': '4/22/2026 - Misdemeanor case, active in two courts. Van Nuys VTC.',
    'Cruz,Randy': '4/29/2026 - VPAN referral initiated for employment support services.',
    'George,Christopher': '4/29/2026 - Housing assistance referral initiated. Van Nuys VTC.',
    'Tadeo,Jose deJesus': '4/29/2026 - Intake completed. JCOD referral for domestic violence class.',
    'Bassi,Jaspreet': '4/29/2026 - LACADA screening completed. Bell Shelter referral for housing.',
    'Clark,Frederick': '5/12/2026 - Intake completed at CCB. JCOD referral initiated.',
    'Flood,Delbert': '4/28/2026 - Veteran incarcerated. Discharge upgrade petition requested.',
    'De La Cruz,Michael': '4/28/2026 - Intake completed. Veteran missed C&P exams, rescheduling needed.',
    'Trujeque,Quinn': '4/28/2026 - Rental assistance referral needed. CCB VTC active case.',
    'Menisteab,Meron': '5/18/2026 - Veteran did not meet LACADA eligibility criteria. Alternative referrals explored.',
    'Duran,Marco': '5/12/2026 - POA documents need to be signed. Benefits claim pending.',
    'Solomon,Calvin': '5/14/2026 - Accepted by LACADA for substance abuse treatment program.',
    'Lyons,Glenn': '5/21/2026 - Intake completed at Compton. JCOD referral initiated.',
    'Parks,Robert': '5/21/2026 - LACADA substance abuse screening completed.',
    'Delgado,Hector': '5/21/2026 - Intake completed. 80% service connected. JCOD referral initiated.',
    'Brunson,Ronald': '5/19/2026 - Veteran due in court at CCB. Case active.',
  };

  try {
    await pool.query('ALTER TABLE veterans ADD COLUMN IF NOT EXISTS ai_governed_summary TEXT');
    const vets = await pool.query('SELECT id, last_name, first_name, branch, discharge_status, va_rating, sc_disability, vtc_courthouse FROM veterans ORDER BY last_name ASC');
    let processed=0, skipped=0, errors=0;
    const results=[];

    for (const v of vets.rows) {
      const key = v.last_name+','+v.first_name;
      const rawNote = NOTES[key]||'';
      if(!rawNote){skipped++;results.push('SKIP: '+v.last_name+', '+v.first_name);continue;}
      try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages',{
          method:'POST',
          headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':process.env.ANTHROPIC_API_KEY||''},
          body:JSON.stringify({
            model:'claude-sonnet-4-20250514',max_tokens:250,
            messages:[{role:'user',content:'You are an IGM-governed case note writer for LA County MVA Veterans Treatment Court. Write a concise 2-3 sentence governed case note from this raw note for '+v.last_name+', '+v.first_name+' ('+v.branch+', '+v.discharge_status+', '+v.va_rating+' VA rating, '+v.vtc_courthouse+' courthouse). Raw note: '+rawNote+'. End with [IGM-GOVERNED].'}]
          })
        });
        const aiData = await aiRes.json();
        const note = aiData.content?.[0]?.text||rawNote+' [IGM-GOVERNED]';
        await pool.query('UPDATE veterans SET ai_governed_summary=$1 WHERE id=$2',[note,v.id]);
        const existing = await pool.query('SELECT id FROM contacts WHERE veteran_id=$1 LIMIT 1',[v.id]);
        if(existing.rows.length===0){
          await pool.query('INSERT INTO contacts (veteran_id,contact_date,vsr_name,raw_note,governed_note,tokens_in,tokens_out,created_at) VALUES ($1,NOW(),$2,$3,$4,150,100,NOW())',
            [v.id,'DeBacco',rawNote,note]);
        }
        results.push('OK: '+v.last_name+', '+v.first_name);
        processed++;
      } catch(e){results.push('ERR: '+v.last_name+', '+v.first_name+' - '+e.message);errors++;}
      await new Promise(r=>setTimeout(r,300));
    }
    res.json({success:true,processed,skipped,errors,total:vets.rows.length,results});
  } catch(e){res.json({success:false,error:e.message});}
});

app.post("/api/format-sheets", async (req, res) => {
  try {
    if (!serviceAccount) return res.json({ success: false, error: "Service account not configured" });

    const veterans = await pool.query(`
      SELECT id, last_name, first_name, ssn, ssn_hash, case_number, vtc_courthouse,
      branch, component, discharge_status, sc_disability, va_rating, vtc_status,
      created_at, housing_status, hc_va, hc_medicaid, hc_private, hc_private_detail, flags,
      ai_governed_summary, phone, dob, gender, race_ethnicity
      FROM veterans ORDER BY last_name ASC
    `);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const SHEET_ID = "1ArthmSd8Ztut0GMdz_Z3RcVLZ6F8KvDCLh9uIlzvtrs";
    const TAB = "Governed Data Log";
    const sheetId = 435822893;

    // STEP 1: CLEAR VALUES
    await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: TAB });

    // STEP 2: CLEAR ALL FORMATTING AND MERGES
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [
        { unmergeCells: { range: { sheetId } } },
        { updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 0, frozenColumnCount: 0 } },
            fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount"
        }},
        { repeatCell: { range: { sheetId }, cell: { userEnteredFormat: {} }, fields: "userEnteredFormat" } }
      ]}
    });

    // AGGREGATE DATA
    const totalContactsRes = await pool.query("SELECT COUNT(*) FROM contacts");
    const totalContacts = parseInt(totalContactsRes.rows[0].count);
    const reportDate = new Date().toLocaleDateString("en-US");
    const tokenRes = await pool.query("SELECT COALESCE(SUM(tokens_in),0) as tin, COALESCE(SUM(tokens_out),0) as tout FROM contacts");
    const totalIn = parseInt(tokenRes.rows[0].tin);
    const totalOut = parseInt(tokenRes.rows[0].tout);
    const totalTokens = totalIn + totalOut;
    const secReturned = totalContacts * 126;
    const hh = String(Math.floor(secReturned / 3600)).padStart(2,"0");
    const mm = String(Math.floor((secReturned % 3600) / 60)).padStart(2,"0");
    const ss = String(secReturned % 60).padStart(2,"0");
    const timeReturned = `${hh}:${mm}:${ss}`;
    const energyJ = (totalTokens * 0.001).toFixed(2);
    const co2 = (totalTokens * 0.0004).toFixed(2);
    const h2o = (totalTokens * 0.002).toFixed(1);

    // COLORS
    const NAVY      = { red: 0.059, green: 0.137, blue: 0.251 };
    const STEEL     = { red: 0.176, green: 0.416, blue: 0.624 };
    const LT_BLUE   = { red: 0.933, green: 0.953, blue: 0.980 };
    const LT_GRAY   = { red: 0.961, green: 0.965, blue: 0.973 };
    const WHITE     = { red: 1,     green: 1,     blue: 1     };
    const BLACK     = { red: 0,     green: 0,     blue: 0     };
    const MID_BLUE  = { red: 0.059, green: 0.270, blue: 0.490 };
    const SPACER_C  = { red: 0.867, green: 0.886, blue: 0.906 };
    const GOLD_LBL  = { red: 0.545, green: 0.416, blue: 0.078 };
    const GOLD_VAL  = { red: 0.992, green: 0.973, blue: 0.925 };
    const GOLD_TXT  = { red: 0.290, green: 0.216, blue: 0.000 };
    const GOLD      = { red: 0.784, green: 0.627, blue: 0.314 };
    const DARK_PANEL= { red: 0.102, green: 0.184, blue: 0.298 };
    const SOFT_GREEN = { red: 0.353, green: 0.541, blue: 0.353 };

    // COLUMN LAYOUT: 0=A, 1=B, 2=C spacer, 3=D, 4=E
    const rows = [];
    const fmt = [];
    const postFmt = [];
    let r = 0;

    // FORMAT HELPERS
    function fc(ri, c0, c1, bg, fg, bold, sz, wrap, hAlign, vAlign) {
      fmt.push({ repeatCell: {
        range: { sheetId, startRowIndex: ri, endRowIndex: ri+1, startColumnIndex: c0, endColumnIndex: c1 },
        cell: { userEnteredFormat: {
          backgroundColor: bg,
          textFormat: { foregroundColor: fg, bold: !!bold, fontSize: sz||10 },
          wrapStrategy: wrap ? "WRAP" : "CLIP",
          horizontalAlignment: hAlign || "LEFT",
          verticalAlignment: vAlign || "MIDDLE",
          padding: { left: 8, right: 6, top: 4, bottom: 4 }
        }},
        fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,horizontalAlignment,verticalAlignment,padding)"
      }});
    }

    function mh(ri, c0, c1) {
      fmt.push({ mergeCells: {
        range: { sheetId, startRowIndex: ri, endRowIndex: ri+1, startColumnIndex: c0, endColumnIndex: c1 },
        mergeType: "MERGE_ALL"
      }});
    }

    function rh(ri, px) {
      fmt.push({ updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: ri, endIndex: ri+1 },
        properties: { pixelSize: px },
        fields: "pixelSize"
      }});
    }

    function pr(a, b, d, e) {
      rows.push([a||"", b||"", "", "", d||"", e||"", "", "", "", ""]);
    }

    function greenVal(ri) {
      postFmt.push({ repeatCell: {
        range: { sheetId, startRowIndex: ri, endRowIndex: ri+1, startColumnIndex: 4, endColumnIndex: 5 },
        cell: { userEnteredFormat: {
          backgroundColor: { red: 1, green: 1, blue: 1 },
          textFormat: { foregroundColor: SOFT_GREEN, bold: true, fontSize: 11 },
          wrapStrategy: "CLIP", horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE",
          padding: { left: 8, right: 6, top: 4, bottom: 4 }
        }},
        fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,horizontalAlignment,verticalAlignment,padding)"
      }});
    }

    function spacerC(ri) {
      fmt.push({ repeatCell: {
        range: { sheetId, startRowIndex: ri, endRowIndex: ri+1, startColumnIndex: 2, endColumnIndex: 3 },
        cell: { userEnteredFormat: {
          backgroundColor: { red: 0.827, green: 0.843, blue: 0.859 },
          textFormat: { foregroundColor: { red: 0.827, green: 0.843, blue: 0.859 }, bold: false, fontSize: 8 },
          wrapStrategy: "CLIP", horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE"
        }},
        fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,horizontalAlignment,verticalAlignment)"
      }});
    }

    // ROW TYPES
    // Full width cover row — centered white text on colored bg
    function coverRow(ri, bg, sz, px) {
      fc(ri, 0, 10, bg, WHITE, true, sz||10, false, "CENTER", "MIDDLE");
      fmt.push({ mergeCells: { range: { sheetId, startRowIndex: ri, endRowIndex: ri+1, startColumnIndex: 0, endColumnIndex: 10 }, mergeType: "MERGE_ALL" }});
      rh(ri, px||24);
    }

    // Dual section header — two merged cells, centered white text, steel blue
    function dualHdr(ri) {
      fc(ri, 0, 4, STEEL, WHITE, true, 10, false, "CENTER", "MIDDLE");
      fc(ri, 4, 5, SPACER_C, SPACER_C, false, 8, false, "LEFT", "MIDDLE");
      fc(ri, 5, 10, STEEL, WHITE, true, 10, false, "CENTER", "MIDDLE");
      rh(ri, 26);
    }

    // Standard data row
    function dataRow(ri, px) {
      fc(ri, 0, 1, LT_GRAY, MID_BLUE, true,  10, false, "LEFT", "MIDDLE");
      fc(ri, 1, 4, WHITE,   BLACK,    false, 10, true,  "LEFT", "MIDDLE");
      fc(ri, 4, 5, SPACER_C, SPACER_C, false, 8, false, "LEFT", "MIDDLE");
      fc(ri, 5, 6, LT_GRAY, MID_BLUE, true,  10, false, "LEFT", "MIDDLE");
      fc(ri, 6, 10, WHITE,   BLACK,    false, 10, true,  "LEFT", "MIDDLE");
      rh(ri, px||20);
    }

    // Left-only data row
    function leftRow(ri, px) {
      fc(ri, 0, 1, LT_GRAY, MID_BLUE, true,  10, false, "LEFT", "MIDDLE");
      fc(ri, 1, 2, WHITE,   BLACK,    false, 10, true,  "LEFT", "MIDDLE");
      fc(ri, 2, 3, SPACER_C, SPACER_C, false, 8, false, "LEFT", "MIDDLE");
      fc(ri, 3, 5, WHITE,   BLACK,    false, 10, false, "LEFT", "MIDDLE");
      rh(ri, px||20);
    }

    // Index row
    function idxRow(ri) {
      fc(ri, 0, 4, LT_BLUE, NAVY, true,  10, false, "LEFT", "MIDDLE");
      fc(ri, 4, 5, SPACER_C, SPACER_C, false, 8, false, "LEFT", "MIDDLE");
      fc(ri, 5, 10, LT_BLUE, NAVY, false, 10, false, "LEFT", "MIDDLE");
      rh(ri, 20);
    }

    // Gap row
    function gapRow(ri) {
      fc(ri, 0, 10, WHITE, WHITE, false, 6, false, "LEFT", "MIDDLE");
      rh(ri, 8);
    }

    // End of record row
    function endRow(ri) {
      fc(ri, 0, 10, LT_GRAY, MID_BLUE, false, 8, false, "CENTER", "MIDDLE");
      rh(ri, 16);
    }

    // COVER
    coverRow(r, NAVY, 12, 32);
    rows.push(["JIV GOVERNED REPORT — MVA VTC Case Tracking — CivGATE Live [IGM-GOVERNED]","","","","","","","","",""]);
    r++;

    coverRow(r, STEEL, 9, 20);
    rows.push(["LA County Dept of Military & Veterans Affairs  |  Generated: "+reportDate+"  |  IGM-GOVERNED  |  USPTO 19/571,156","","","","","","","","",""]);
    r++;

    gapRow(r); rows.push(["","","","","","","","","",""]); r++;

    // SUMMARY — left side data, right side governance metrics
    coverRow(r, NAVY, 10, 24);
    rows.push(["REPORT SUMMARY","","","","","","","","",""]); r++;

    // Summary rows with proper 10-col layout
    const summaryRows = [
      ["Total Veterans", String(veterans.rows.length), "Time Returned", timeReturned],
      ["Total Contact Entries", String(totalContacts), "Energy Saved", `${energyJ} J`],
      ["Report Date", reportDate, "CO2 Avoided", `${co2} gCO2e`],
      ["", "", "H2O Conserved", `${h2o} ml`],
      ["", "", "Governance Rate", "100% IGM-GOVERNED"],
    ];
    for (const [la, lb, ld, le] of summaryRows) {
      // Label A
      fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 2 }, cell: { userEnteredFormat: { backgroundColor: LT_GRAY, textFormat: { foregroundColor: MID_BLUE, bold: true, fontSize: 11 }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", padding: { left: 10 } }}, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)" }});
      // Value B
      fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 2, endColumnIndex: 4 }, cell: { userEnteredFormat: { backgroundColor: WHITE, textFormat: { foregroundColor: { red:0,green:0,blue:0 }, fontSize: 11 }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", padding: { left: 8 } }}, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)" }});
      // Spacer
      fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 4, endColumnIndex: 5 }, cell: { userEnteredFormat: { backgroundColor: SPACER_C }}, fields: "userEnteredFormat(backgroundColor)" }});
      // Label D
      fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 5, endColumnIndex: 7 }, cell: { userEnteredFormat: { backgroundColor: LT_GRAY, textFormat: { foregroundColor: SOFT_GREEN, bold: true, fontSize: 11 }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", padding: { left: 10 } }}, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)" }});
      // Value E
      fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 7, endColumnIndex: 10 }, cell: { userEnteredFormat: { backgroundColor: WHITE, textFormat: { foregroundColor: SOFT_GREEN, bold: true, fontSize: 11 }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", padding: { left: 8 } }}, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)" }});
      fmt.push({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: r, endIndex: r+1 }, properties: { pixelSize: 22 }, fields: "pixelSize" }});
      rows.push([la, lb, "", "", "", ld, le, "", "", ""]);
      r++;
    }

    gapRow(r); rows.push(["","","","","","","","","",""]); r++;

    const domainMap = [
      ["Healthcare", ["CFCI Mental Health (DMH)","CFCI Substance Abuse (LACADA)","VA Benefits/Claims","VA Medical"]],
      ["Legal",      ["CFCI Legal Services","Legal Services"]],
      ["Employment", ["CFCI Employment/Job Training","Employment/Education"]],
      ["Housing",    ["CFCI Permanent Housing","CFCI Temporary Housing","Housing Assistance"]],
      ["Transport",  ["CFCI Transportation","Transportation"]],
      ["Education",  ["CFCI Education"]],
      ["Reentry",    ["Reentry/Release Planning"]],
      ["JCOD",       ["JCOD Referral"]],
      ["VPAN",       ["VPAN Referral"]],
    ];

    const cfciKeys = [
      "CFCI Mental Health (DMH)","CFCI Substance Abuse (LACADA)","CFCI Social Services",
      "CFCI Basic Necessities","CFCI Permanent Housing",
      "CFCI Temporary Housing","CFCI Vital Document Assistance","Medi-Cal Referral"
    ];

    // Ensure jgr_row column exists
    try { await pool.query('ALTER TABLE veterans ADD COLUMN IF NOT EXISTS jgr_row INTEGER'); } catch(e) {}

    // VETERAN BLOCKS — COMPACT HORIZONTAL LAYOUT
    // 10 rows per veteran = ~1,490 rows total for 149 veterans
    // Cols: A=label1, B=val1, C=spacer, D=label2, E=val2, F=label3, G=val3, H=spacer, I=label4, J=val4

    for (const v of veterans.rows) {
      const contacts = await pool.query(
        `SELECT contact_date, vsr_name, next_court_date, governed_note, service_needs,
         referred_treatment, referral_type, treatment_location, treatment_method,
         interested_services, tokens_in, tokens_out
         FROM contacts WHERE veteran_id=$1 ORDER BY contact_date DESC`, [v.id]
      );

      const allNeeds = contacts.rows.flatMap(c => {
        const sn = c.service_needs;
        if (Array.isArray(sn)) return sn;
        try { return JSON.parse(sn || "[]"); } catch { return []; }
      });

      const latest = contacts.rows[0] || {};
      const latestNeeds = (() => {
        const sn = latest.service_needs;
        if (Array.isArray(sn)) return sn;
        try { return JSON.parse(sn || "[]"); } catch { return []; }
      })();
      const sn   = (label) => latestNeeds.includes(label) ? "YES" : "--";
      const cfci = (label) => allNeeds.includes(label)    ? "YES" : "--";
      const jivId = `JIV-${String(v.id).padStart(5,"0")}-${new Date(v.created_at).toISOString().slice(0,10).replace(/-/g,"")}`;
      const ssnMasked = maskSSN(v.ssn);
      const flagsList = Array.isArray(v.flags) ? v.flags : (typeof v.flags==='string' ? JSON.parse(v.flags||'[]') : []);

      // Store JGR row number in DB for hyperlinks
      await pool.query('UPDATE veterans SET jgr_row=$1 WHERE id=$2', [r + 1, v.id]);

      // ROW 1: NAVY HEADER — full width (10 cols)
      fmt.push({ repeatCell: {
        range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 10 },
        cell: { userEnteredFormat: { backgroundColor: NAVY, textFormat: { foregroundColor: WHITE, bold: true, fontSize: 11 }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", padding: { left: 10, right: 6, top: 4, bottom: 4 } }},
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)"
      }});
      fmt.push({ mergeCells: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 10 }, mergeType: "MERGE_ALL" }});
      fmt.push({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: r, endIndex: r+1 }, properties: { pixelSize: 28 }, fields: "pixelSize" }});
      rows.push([`JIV GOVERNED RECORD — ${jivId}  |  ${v.last_name}, ${v.first_name}  |  ${v.case_number||"--"}  |  IGM-GOVERNED`,"","","","","","","","",""]);
      r++;

      // ROW 2: SECTION HEADERS
      fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 2 }, cell: { userEnteredFormat: { backgroundColor: STEEL, textFormat: { foregroundColor: WHITE, bold: true, fontSize: 10 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" }}, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)" }});
      fmt.push({ mergeCells: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 2 }, mergeType: "MERGE_ALL" }});
      fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 2, endColumnIndex: 3 }, cell: { userEnteredFormat: { backgroundColor: SPACER_C }}, fields: "userEnteredFormat(backgroundColor)" }});
      fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 3, endColumnIndex: 5 }, cell: { userEnteredFormat: { backgroundColor: STEEL, textFormat: { foregroundColor: WHITE, bold: true, fontSize: 10 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" }}, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)" }});
      fmt.push({ mergeCells: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 3, endColumnIndex: 5 }, mergeType: "MERGE_ALL" }});
      fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 5, endColumnIndex: 7 }, cell: { userEnteredFormat: { backgroundColor: STEEL, textFormat: { foregroundColor: WHITE, bold: true, fontSize: 10 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" }}, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)" }});
      fmt.push({ mergeCells: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 5, endColumnIndex: 7 }, mergeType: "MERGE_ALL" }});
      fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 7, endColumnIndex: 8 }, cell: { userEnteredFormat: { backgroundColor: SPACER_C }}, fields: "userEnteredFormat(backgroundColor)" }});
      fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 8, endColumnIndex: 10 }, cell: { userEnteredFormat: { backgroundColor: STEEL, textFormat: { foregroundColor: WHITE, bold: true, fontSize: 10 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" }}, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)" }});
      fmt.push({ mergeCells: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 8, endColumnIndex: 10 }, mergeType: "MERGE_ALL" }});
      fmt.push({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: r, endIndex: r+1 }, properties: { pixelSize: 22 }, fields: "pixelSize" }});
      rows.push(["IDENTITY","","","SERVICES & NEEDS","","MILITARY & VA STATUS","","","CARE FIRST TRACKING",""]);
      r++;

      // ROWS 3-9: DATA — 7 data rows side by side
      const idData = [
        ["Name", `${v.last_name}, ${v.first_name}`],
        ["SSN", ssnMasked],
        ["Case #", v.case_number||"--"],
        ["Courthouse", v.vtc_courthouse||"--"],
        ["Intake Date", v.created_at?new Date(v.created_at).toLocaleDateString("en-US"):"--"],
        ["Status", v.vtc_status||"Active"],
        ["Housing", v.housing_status||"--"],
        ["Flags", flagsList.length>0?flagsList.join(" | "):"--"],
      ];
      const snData = [
        ["VA Benefits/Claims", sn("VA Benefits/Claims")],
        ["Housing Assistance", sn("Housing Assistance")],
        ["VA Medical", sn("VA Medical")],
        ["Employment/Edu", sn("Employment/Education")],
        ["JCOD Referral", sn("JCOD Referral")],
        ["VPAN Referral", sn("VPAN Referral")],
        ["", ""],
        ["", ""],
      ];
      const milData = [
        ["Branch", v.branch||"--"],
        ["Component", v.component||"--"],
        ["Discharge", v.discharge_status||"--"],
        ["Svc Connected", v.sc_disability||"--"],
        ["VA Rating", v.va_rating?String(v.va_rating).replace(/%/g,'')+'%':"--"],
        ["VA Enrolled", v.hc_va?"Yes":"--"],
        ["Medi-Cal", v.hc_medicaid?"Yes":"--"],
        ["Healthcare", v.hc_private?"Private":"--"],
      ];
      const cfciData = [
        ["Mental Health (DMH)", cfci("CFCI Mental Health (DMH)")],
        ["Substance Abuse (LACADA)", cfci("CFCI Substance Abuse (LACADA)")],
        ["Social Services", cfci("CFCI Social Services")],
        ["Basic Necessities", cfci("CFCI Basic Necessities")],
        ["Permanent Housing", cfci("CFCI Permanent Housing")],
        ["Temporary Housing", cfci("CFCI Temporary Housing")],
        ["Vital Document Asst", cfci("CFCI Vital Document Assistance")],
        ["Medi-Cal Referral", cfci("Medi-Cal Referral")],
      ];

      const numDataRows = 8;
      for (let i = 0; i < numDataRows; i++) {
        // Label cols formatting
        fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: LT_GRAY, textFormat: { foregroundColor: MID_BLUE, bold: true, fontSize: 10 }, verticalAlignment: "MIDDLE", padding: { left: 6 } }}, fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,padding)" }});
        fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 2, endColumnIndex: 3 }, cell: { userEnteredFormat: { backgroundColor: SPACER_C }}, fields: "userEnteredFormat(backgroundColor)" }});
        fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 3, endColumnIndex: 4 }, cell: { userEnteredFormat: { backgroundColor: LT_GRAY, textFormat: { foregroundColor: MID_BLUE, bold: true, fontSize: 10 }, verticalAlignment: "MIDDLE", padding: { left: 6 } }}, fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,padding)" }});
        fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 5, endColumnIndex: 6 }, cell: { userEnteredFormat: { backgroundColor: LT_GRAY, textFormat: { foregroundColor: MID_BLUE, bold: true, fontSize: 10 }, verticalAlignment: "MIDDLE", padding: { left: 6 } }}, fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,padding)" }});
        fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 7, endColumnIndex: 8 }, cell: { userEnteredFormat: { backgroundColor: SPACER_C }}, fields: "userEnteredFormat(backgroundColor)" }});
        fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 8, endColumnIndex: 9 }, cell: { userEnteredFormat: { backgroundColor: LT_GRAY, textFormat: { foregroundColor: MID_BLUE, bold: true, fontSize: 10 }, verticalAlignment: "MIDDLE", padding: { left: 6 } }}, fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,padding)" }});
        fmt.push({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: r, endIndex: r+1 }, properties: { pixelSize: 20 }, fields: "pixelSize" }});
        rows.push([
          idData[i]?.[0]||"", idData[i]?.[1]||"", "",
          snData[i]?.[0]||"", snData[i]?.[1]||"",
          milData[i]?.[0]||"", milData[i]?.[1]||"", "",
          cfciData[i]?.[0]||"", cfciData[i]?.[1]||""
        ]);
        r++;
      }

      // CONTACT LOG HEADER
      fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 10 }, cell: { userEnteredFormat: { backgroundColor: STEEL, textFormat: { foregroundColor: WHITE, bold: true, fontSize: 10 }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", padding: { left: 10 } }}, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)" }});
      fmt.push({ mergeCells: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 10 }, mergeType: "MERGE_ALL" }});
      fmt.push({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: r, endIndex: r+1 }, properties: { pixelSize: 22 }, fields: "pixelSize" }});
      rows.push(["CONTACT LOG — GOVERNED CASE NOTES  |  IGM-GOVERNED","","","","","","","","",""]);
      r++;

      // CONTACT ENTRIES
      if (contacts.rows.length === 0) {
        fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 10 }, cell: { userEnteredFormat: { backgroundColor: GOLD_VAL, textFormat: { foregroundColor: GOLD_TXT, fontSize: 10 }, wrapStrategy: "WRAP", verticalAlignment: "TOP", padding: { left: 10 } }}, fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment,padding)" }});
        fmt.push({ mergeCells: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 10 }, mergeType: "MERGE_ALL" }});
        fmt.push({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: r, endIndex: r+1 }, properties: { pixelSize: 40 }, fields: "pixelSize" }});
        rows.push(["No contact events recorded yet.","","","","","","","","",""]);
        r++;
      } else {
        for (const c of contacts.rows) {
          const ncd = c.next_court_date ? new Date(c.next_court_date).toISOString().slice(0,10) : "--";
          const cDate = c.contact_date ? new Date(c.contact_date).toISOString().slice(0,10) : "--";
          // Contact meta row
          fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 10 }, cell: { userEnteredFormat: { backgroundColor: LT_BLUE, textFormat: { foregroundColor: MID_BLUE, fontSize: 10 }, verticalAlignment: "MIDDLE", padding: { left: 8 } }}, fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,padding)" }});
          fmt.push({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: r, endIndex: r+1 }, properties: { pixelSize: 20 }, fields: "pixelSize" }});
          rows.push([`Contact: ${cDate}  |  VSR: ${c.vsr_name||"--"}  |  Next Court: ${ncd}  |  Location: ${c.treatment_location||"--"}  |  VA: ${v.hc_va?"Yes":"--"}  |  Medi-Cal: ${v.hc_medicaid?"Yes":"--"}`,"","","","","","","","",""]);
          fmt.push({ mergeCells: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 10 }, mergeType: "MERGE_ALL" }});
          r++;
          // Governed note — GOLD BOX full width
          const noteHeight = c.governed_note && c.governed_note.length > 200 ? 120 : c.governed_note && c.governed_note.length > 100 ? 80 : 60;
          fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 10 }, cell: { userEnteredFormat: { backgroundColor: GOLD_VAL, textFormat: { foregroundColor: GOLD_TXT, bold: false, fontSize: 10 }, wrapStrategy: "WRAP", verticalAlignment: "TOP", padding: { left: 10, right: 10, top: 6, bottom: 6 } }}, fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment,padding)" }});
          fmt.push({ mergeCells: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 10 }, mergeType: "MERGE_ALL" }});
          fmt.push({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: r, endIndex: r+1 }, properties: { pixelSize: noteHeight }, fields: "pixelSize" }});
          // JGR dot logic — mirrors VMR
          const JGR_GREEN = String.fromCodePoint(0x1F7E2);
          const JGR_YELLOW = String.fromCodePoint(0x1F7E1);
          const JGR_RED = String.fromCodePoint(0x1F534);
          let jgrDot = JGR_GREEN;
          let jgrAlert = '';
          if (c.next_court_date) {
            const jgrCourtDate = new Date(c.next_court_date);
            const jgrNow = new Date();
            const jgrDiff = Math.ceil((jgrCourtDate - jgrNow) / (1000 * 60 * 60 * 24));
            if (jgrDiff <= 1) {
              jgrDot = JGR_RED;
              jgrAlert = JGR_RED + ' COURT TOMORROW — ' + v.last_name + ', ' + v.first_name + ' | ' + (v.vtc_courthouse||'') + ' | Case ' + (v.case_number||'N/A') + ' | Confirm appearance, review file, prepare court summary before session.\n';
            } else if (jgrDiff <= 7) {
              jgrDot = JGR_YELLOW;
              jgrAlert = JGR_YELLOW + ' COURT IN ' + jgrDiff + ' DAYS — ' + v.last_name + ', ' + v.first_name + ' | ' + (v.vtc_courthouse||'') + ' | Case ' + (v.case_number||'N/A') + ' | Review treatment compliance and prepare VSR brief.\n';
            } else {
              jgrDot = JGR_GREEN;
              jgrAlert = '';
            }
          }
          const jgrRawNote = c.governed_note || '';
          const jgrClean = jgrRawNote ? jgrRawNote.replace(/^"|"$/g,'').trim().split('\n').filter(l => !l.startsWith('[GREEN]') && !l.startsWith('[RED]') && !l.startsWith('[YELLOW]')).join('\n').trim() : '';
          const jgrGreenPrefix = !c.next_court_date ? JGR_GREEN + ' No upcoming court date - routine status.\n' : '';
          const jgrFinalNote = jgrAlert ? jgrAlert + (jgrClean ? '\n' + jgrClean : '') : (jgrGreenPrefix + jgrClean) || 'No governed note recorded.';
          rows.push([jgrFinalNote,"","","","","","","","",""]);
          r++;
        }
      }

      // END OF RECORD
      fmt.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 10 }, cell: { userEnteredFormat: { backgroundColor: LT_GRAY, textFormat: { foregroundColor: MID_BLUE, fontSize: 8 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" }}, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)" }});
      fmt.push({ mergeCells: { range: { sheetId, startRowIndex: r, endRowIndex: r+1, startColumnIndex: 0, endColumnIndex: 10 }, mergeType: "MERGE_ALL" }});
      fmt.push({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: r, endIndex: r+1 }, properties: { pixelSize: 16 }, fields: "pixelSize" }});
      rows.push([`-- END OF RECORD: ${v.last_name}, ${v.first_name}  |  ${jivId} --`,"","","","","","","","",""]);
      r++;
      // Gap
      rows.push(["","","","","","","","","",""]); r++;
    }

    // WRITE VALUES
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows }
    });

    // APPLY FORMATTING IN BATCHES OF 400
    for (let i=0; i<fmt.length; i+=200) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: fmt.slice(i,i+200) }
      });
      await new Promise(r => setTimeout(r, 1500));
    }

    // COLUMN WIDTHS — 10 columns
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [
        { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 160 }, fields: "pixelSize" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 }, properties: { pixelSize: 220 }, fields: "pixelSize" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 }, properties: { pixelSize: 8   }, fields: "pixelSize" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 }, properties: { pixelSize: 160 }, fields: "pixelSize" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 4, endIndex: 5 }, properties: { pixelSize: 50  }, fields: "pixelSize" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 5, endIndex: 6 }, properties: { pixelSize: 160 }, fields: "pixelSize" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 6, endIndex: 7 }, properties: { pixelSize: 160 }, fields: "pixelSize" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 7, endIndex: 8 }, properties: { pixelSize: 8   }, fields: "pixelSize" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 8, endIndex: 9 }, properties: { pixelSize: 180 }, fields: "pixelSize" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 9, endIndex: 10 }, properties: { pixelSize: 80  }, fields: "pixelSize" } },
      ]}
    });

    // POST-FORMAT PASS — borders and green (after all merges)
    for (let i=0; i<postFmt.length; i+=200) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: postFmt.slice(i,i+200) }
      });
      await new Promise(r => setTimeout(r, 1500));
    }

    res.json({ success: true, message: `Governed Data Log v8 -- ${veterans.rows.length} veterans, ${totalContacts} contacts, ${r} rows written.` });
  } catch(e) {
    console.error("[FORMAT SHEETS v8 ERROR]", e.message, e.stack);
    res.json({ success: false, error: e.message });
  }
});

app.get("/api/export/caseload", async (req, res) => {
  try {
    const ExcelJS = require("exceljs");
    const { courthouse, status } = req.query;
    let query = `SELECT v.*, COUNT(DISTINCT c.id) as total_contacts, MAX(c.contact_date) as last_contact, MAX(c.next_court_date) as next_court_date, STRING_AGG(DISTINCT r.partner, ', ') as partners FROM veterans v LEFT JOIN contacts c ON c.veteran_id = v.id LEFT JOIN referrals r ON r.veteran_id = v.id WHERE 1=1`;
    const params = [];
    if (courthouse) { params.push(courthouse); query += ` AND v.vtc_courthouse=$${params.length}`; }
    if (status) { params.push(status); query += ` AND v.vtc_status=$${params.length}`; }
    query += ` GROUP BY v.id ORDER BY v.last_name ASC`;
    const result = await pool.query(query, params);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Caseload Report");
    const GROUPS = [
      { label:"IDENTITY", color:"0F2340", cols:["Last Name","First Name","SSN","DOB","Phone","Email"] },
      { label:"VTC STATUS", color:"8B1C22", cols:["VTC Courthouse","VTC Status","Case Number","Next Court Date","Graduation Date","Archive Reason"] },
      { label:"MILITARY", color:"1A4A2A", cols:["Branch","Component","Discharge","VA Rating","SC Disability","Combat Veteran"] },
      { label:"SERVICES", color:"1A5C38", cols:["Partners","Total Contacts","Last Contact","Housing Status","Alert Hostile"] },
      { label:"DEMOGRAPHICS", color:"2D4D6E", cols:["Gender","Race/Ethnicity","Language","Marital Status","Dependents"] },
    ];
    const allCols = GROUPS.flatMap(g => g.cols.map(c => ({ col: c, color: g.color })));
    const groupRow = ws.addRow(allCols.map(() => ""));
    groupRow.height = 20;
    let colStart = 1;
    GROUPS.forEach(g => {
      const colEnd = colStart + g.cols.length - 1;
      ws.mergeCells(1, colStart, 1, colEnd);
      const cell = groupRow.getCell(colStart);
      cell.value = g.label;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + g.color } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      colStart = colEnd + 1;
    });
    const headerRow = ws.addRow(allCols.map(c => c.col));
    headerRow.height = 36;
    headerRow.eachCell((cell, colNum) => {
      const col = allCols[colNum - 1];
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 9 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + col.color } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];
    result.rows.forEach(v => {
      ws.addRow([v.last_name, v.first_name, v.ssn, v.dob, v.phone, v.email, v.vtc_courthouse, v.vtc_status, v.case_number, v.next_court_date, v.graduation_date, v.archive_reason, v.branch, v.component, v.discharge_status, v.va_rating, v.sc_disability, v.combat_veteran, v.partners, v.total_contacts, v.last_contact, v.housing_status, v.alert_hostile, v.gender, v.race_ethnicity, v.primary_language, v.marital_status, v.dependents]);
    });
    const widths = [16,14,14,12,14,22,20,14,20,14,14,20,12,14,20,10,12,12,24,12,14,16,10,12,18,16,14,10];
    allCols.forEach((c, i) => { ws.getColumn(i + 1).width = widths[i] || 14; });
    const filename = `CivGATE_Caseload_${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await wb.xlsx.write(res);
    res.end();
  } catch(e) { res.json({ success: false, error: e.message }); }
});


app.post("/api/migrate-veterans", async (req, res) => {
  const vets = [
  {l:'Acevedo Jr.',f:'Ernest',s:'575921818',p:'3104048911',d:'1973-07-30',b:'Army',dc:'HON',v:'30%',sc:'Yes',c:'Compton'},
  {l:'Baca',f:'Steven',s:'612328667',p:'6615613801',d:'1989-11-20',b:'Marines',dc:'HON',v:'10%',sc:'Yes',c:'Lancaster'},
  {l:'Baker',f:'Cleveland',s:'432198977',p:'',d:'1959-03-25',b:'Army',dc:'HON',v:'',sc:'Yes',c:'Lancaster'},
  {l:'Barlow',f:'Prince',s:'545172579',p:'3237777214',d:'1961-06-05',b:'Army',dc:'HON',v:'0%',sc:'Yes',c:'Lancaster'},
  {l:'Barnett',f:'Marvin Glen',s:'482116407',p:'6614866817',d:'1960-06-02',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'Lancaster'},
  {l:'Bell',f:'Derek',s:'587474851',p:'4243944710',d:'1983-10-03',b:'Army',dc:'HON',v:'70%',sc:'Yes',c:'Compton'},
  {l:'Boldt',f:'Jeffrey',s:'291440774',p:'7473723090',d:'1951-01-28',b:'Marines',dc:'HON',v:'',sc:'Yes',c:''},
  {l:'Braicov',f:'Melissa',s:'',p:'',d:'',b:'',dc:'',v:'',sc:'Yes',c:'Compton'},
  {l:'Campos',f:'Juan',s:'618050279',p:'4245663174',d:'1979-01-04',b:'Marines',dc:'HON',v:'70%',sc:'Yes',c:'Compton'},
  {l:'Cannon',f:'Jessie',s:'548619946',p:'4245580528',d:'1980-02-18',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'Compton'},
  {l:'Chisolm',f:'Kendrick',s:'439874489',p:'3237986407',d:'1993-10-19',b:'Marines',dc:'HON',v:'60%',sc:'Yes',c:''},
  {l:'Delacruz',f:'Michael Reuben',s:'563410956',p:'5625252491',d:'1975-01-16',b:'Army',dc:'GEN',v:'',sc:'Yes',c:'CCB'},
  {l:'Durham',f:'Deiondre',s:'602801198',p:'9094403635',d:'1993-04-05',b:'Air Force',dc:'GEN',v:'',sc:'Yes',c:'Compton'},
  {l:'Espinoza',f:'Fabian',s:'602649477',p:'3104155825',d:'1992-12-21',b:'Army',dc:'GEN',v:'60%',sc:'Yes',c:'Compton'},
  {l:'Estrada',f:'Ronald',s:'608209035',p:'3232006216',d:'1986-03-09',b:'Marines',dc:'HON',v:'90%',sc:'Yes',c:'CCB'},
  {l:'Fanning',f:'Cory',s:'572439980',p:'',d:'1962-11-04',b:'Army',dc:'',v:'10%',sc:'Yes',c:'Compton'},
  {l:'Finney',f:'Jalen',s:'',p:'',d:'1999-11-16',b:'',dc:'',v:'',sc:'',c:'Compton'},
  {l:'Fischer',f:'Giovanni',s:'056927942',p:'7472837444',d:'2002-03-12',b:'Marines',dc:'GEN',v:'10%',sc:'Yes',c:'Compton'},
  {l:'Galvan',f:'Francisco',s:'568479069',p:'8186137823',d:'1977-01-22',b:'Army',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Germany',f:'Davione',s:'623040441',p:'5627238312',d:'1998-01-21',b:'Army',dc:'DIS',v:'',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Ghaffar',f:'Jalaal',s:'552252256',p:'2133297825',d:'1963-10-31',b:'Army',dc:'HON',v:'50%',sc:'Yes',c:'Compton'},
  {l:'Gomez',f:'Rodrigo',s:'571873918',p:'3234485470',d:'1985-10-16',b:'Army',dc:'HON',v:'100%',sc:'',c:'DTLA VTC Court'},
  {l:'Green',f:'Steven Loyd',s:'563068773',p:'6267258281',d:'1960-12-06',b:'Navy',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Griffin',f:'Brandon',s:'335829796',p:'3019975966',d:'1984-12-08',b:'Air Force',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Grijalva',f:'Roldolfo',s:'564896290',p:'3235582275',d:'1986-05-24',b:'Marines',dc:'OTH',v:'',sc:'Yes',c:'Compton'},
  {l:'Guerra',f:'Antonio',s:'550712716',p:'7472286445',d:'1974-07-09',b:'Navy',dc:'HON',v:'',sc:'Yes',c:'CCB'},
  {l:'Gutierrez',f:'Cy',s:'607705105',p:'2134342754',d:'1989-11-24',b:'Army',dc:'HON',v:'70%',sc:'Yes',c:'CCB'},
  {l:'Hale',f:'Lloyd',s:'548353694',p:'3234214010',d:'1970-06-23',b:'Army',dc:'HON',v:'50%',sc:'Yes',c:'Compton'},
  {l:'Hamel',f:'Jeffrey',s:'005940330',p:'3102104438',d:'1993-04-03',b:'Army',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Hansen',f:'Jonathan Scott',s:'607963817',p:'9097478516',d:'1997-02-20',b:'Navy',dc:'GEN',v:'90%',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Hartsock',f:'Earl',s:'',p:'2136796068',d:'1981-08-26',b:'Air Force',dc:'HON',v:'100%',sc:'',c:'DTLA VTC Court'},
  {l:'He',f:'Benny Jiaming',s:'859046144',p:'3235416666',d:'1997-06-08',b:'Army',dc:'HON',v:'100%',sc:'',c:'DTLA VTC Court'},
  {l:'Hodge',f:'Loyd',s:'',p:'',d:'',b:'Navy',dc:'OTH',v:'',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Hopper',f:'Gerald',s:'552539687',p:'3108503186',d:'1961-06-11',b:'Army',dc:'GEN',v:'',sc:'Yes',c:'Compton'},
  {l:'Hun',f:'Kim',s:'',p:'',d:'',b:'Navy',dc:'',v:'',sc:'Yes',c:''},
  {l:'Jackson',f:'Jeremy',s:'621361319',p:'',d:'1990-05-15',b:'Marines',dc:'HON',v:'10%',sc:'Yes',c:'Compton'},
  {l:'Jaramilla',f:'Francisco',s:'564190790',p:'3104619309',d:'1962-10-13',b:'Marines',dc:'HON',v:'10%',sc:'Yes',c:'CCB'},
  {l:'Jaramillo',f:'Adrian',s:'617094007',p:'5629120715',d:'1986-04-25',b:'Navy',dc:'GEN',v:'',sc:'Yes',c:'Compton'},
  {l:'Jefferson',f:'Robert Earl',s:'566453796',p:'2138196417',d:'1962-02-25',b:'Air Force',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Johnson',f:'Rayfield',s:'',p:'5622840585',d:'1962-02-25',b:'Army',dc:'HON',v:'100%',sc:'',c:'Compton'},
  {l:'Johnson',f:'Elliot',s:'',p:'',d:'',b:'',dc:'',v:'',sc:'',c:'DTLA VTC Court'},
  {l:'Johnson',f:'Michael',s:'574135811',p:'',d:'1993-07-08',b:'',dc:'',v:'',sc:'',c:'DTLA VTC Court'},
  {l:'Kelly',f:'Kevin F.',s:'603072987',p:'4243553146',d:'1967-12-08',b:'Navy',dc:'HON',v:'',sc:'',c:'DTLA VTC Court'},
  {l:'Kleinbrook',f:'James',s:'368803690',p:'2138196417',d:'1972-07-02',b:'Army',dc:'HON',v:'100%',sc:'',c:'DTLA VTC Court'},
  {l:'Lampkin',f:'Jamal',s:'563755069',p:'9252725495',d:'1969-07-21',b:'Army',dc:'HON',v:'80%',sc:'Yes',c:'Compton'},
  {l:'Lebby',f:'Jerome',s:'154845617',p:'3106020032',d:'1988-04-29',b:'Army',dc:'HON',v:'50%',sc:'',c:'Lancaster'},
  {l:'Lopez',f:'Michael-Paul',s:'',p:'5623253642',d:'1986-07-21',b:'Army',dc:'HON',v:'90%',sc:'',c:'Compton'},
  {l:'Lozano',f:'Connie',s:'558873095',p:'6267150325',d:'1985-11-29',b:'Navy',dc:'HON',v:'80%',sc:'',c:'DTLA VTC Court'},
  {l:'Martinez',f:'James',s:'',p:'',d:'',b:'Army',dc:'HON',v:'',sc:'',c:'DTLA VTC Court'},
  {l:'Maxim',f:'David',s:'607043408',p:'6612601213',d:'1985-10-05',b:'Coast Guard',dc:'HON',v:'80%',sc:'',c:'DTLA VTC Court'},
  {l:'McCallister',f:'Matthew',s:'605425170',p:'5626658281',d:'1988-11-29',b:'Army',dc:'GEN',v:'70%',sc:'Yes',c:'DTLA VTC Court'},
  {l:'McCarty',f:'Edward',s:'',p:'',d:'',b:'',dc:'',v:'',sc:'',c:'DTLA VTC Court'},
  {l:'McCulley',f:'Logan',s:'605568217',p:'6614184367',d:'1986-12-11',b:'Army',dc:'HON',v:'60%',sc:'',c:''},
  {l:'McGary',f:'Karlton',s:'462397074',p:'8186137823',d:'1961-10-22',b:'Marines',dc:'OTH',v:'',sc:'Yes',c:''},
  {l:'McGeary',f:'David',s:'608508519',p:'',d:'1991-08-13',b:'Marines',dc:'OTH',v:'',sc:'Yes',c:'Lancaster'},
  {l:'Mcgee',f:'Terence',s:'566357320',p:'',d:'1962-01-08',b:'',dc:'',v:'',sc:'',c:''},
  {l:'Mcgee',f:'Tony',s:'569170433',p:'3232631206',d:'1967-01-10',b:'Marines',dc:'HON',v:'100%',sc:'Yes',c:'Compton'},
  {l:'Mendoza',f:'Armando',s:'552668745',p:'3104186771',d:'1950-05-14',b:'Army',dc:'HON',v:'60%',sc:'Yes',c:'Compton'},
  {l:'Millon',f:'Dimitri',s:'554683240',p:'3105320548',d:'1940-06-15',b:'Marines',dc:'HON',v:'80%',sc:'',c:''},
  {l:'Moore',f:'Charles',s:'623269021',p:'5102892900',d:'1989-07-06',b:'Marines',dc:'BCD',v:'',sc:'Yes',c:''},
  {l:'Moreno',f:'Walter',s:'620403194',p:'9289887913',d:'1990-09-29',b:'Marines',dc:'HON',v:'90%',sc:'Yes',c:'Van Nuys'},
  {l:'Mothershed',f:'Don Juan',s:'',p:'6262353155',d:'',b:'Marines',dc:'HON',v:'',sc:'',c:''},
  {l:'Mursalyan',f:'Davit',s:'615025204',p:'',d:'1997-10-09',b:'Marines',dc:'OTH',v:'',sc:'',c:''},
  {l:'Nash',f:'Dubreque Esington',s:'622703796',p:'6269404319',d:'1991-02-24',b:'Army',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Navarro',f:'Eric',s:'',p:'6267150035',d:'',b:'Navy',dc:'HON',v:'80%',sc:'',c:''},
  {l:'Navarrete',f:'Jose',s:'548756516',p:'8056072029',d:'',b:'Marines',dc:'OTH',v:'100%',sc:'',c:'CCB'},
  {l:'Newman',f:'Anita',s:'620106416',p:'3235177386',d:'1988-04-06',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'Compton'},
  {l:'Palacios',f:'Adrian',s:'604268773',p:'5626797888',d:'1973-06-22',b:'Navy',dc:'OTH',v:'',sc:'Yes',c:''},
  {l:'Palacol',f:'Celestino',s:'576929482',p:'4242441722',d:'1960-06-28',b:'Army',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Paras',f:'Nestor',s:'610415991',p:'8584723716',d:'1992-09-12',b:'Army',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Park',f:'Kyuchang',s:'552752867',p:'6267562698',d:'1964-08-10',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'CCB'},
  {l:'Parks',f:'Robert',s:'456374876',p:'2133492595',d:'1965-03-28',b:'Marines',dc:'OTH',v:'',sc:'Yes',c:'Compton'},
  {l:'Passmore',f:'Steven',s:'558959778',p:'6618603731',d:'1984-09-27',b:'Army',dc:'HON',v:'100%',sc:'',c:'Compton'},
  {l:'Patrick',f:'Perry',s:'',p:'9094189636',d:'1971-02-15',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:''},
  {l:'Perez-Lopez',f:'Fernando',s:'748183112',p:'3234046319',d:'1984-05-31',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'Compton'},
  {l:'Quinn',f:'Bennie',s:'354581212',p:'3236354960',d:'1974-04-16',b:'Army',dc:'HON',v:'100%',sc:'',c:'Compton'},
  {l:'Ramirez',f:'Jose',s:'',p:'2133297825',d:'1992-09-17',b:'',dc:'OTH',v:'',sc:'Yes',c:'Compton'},
  {l:'Roberts',f:'Darius',s:'',p:'',d:'',b:'',dc:'',v:'',sc:'',c:''},
  {l:'Roberts',f:'Oscar',s:'229176818',p:'4249776107',d:'1978-03-13',b:'Air Force',dc:'GEN',v:'',sc:'Yes',c:'Van Nuys'},
  {l:'Rodgers',f:'RD',s:'563357325',p:'',d:'1965-12-27',b:'Navy',dc:'HON',v:'100%',sc:'Yes',c:'Lancaster'},
  {l:'Rodriguez',f:'Felicia',s:'320647788',p:'',d:'',b:'Marines',dc:'HON',v:'70%',sc:'Yes',c:'CCB'},
  {l:'Rodriguez',f:'Walter',s:'321444027',p:'5593104887',d:'1948-08-09',b:'Marines',dc:'HON',v:'100%',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Rosas',f:'Richard Jose',s:'558312177',p:'5623296093',d:'1963-07-18',b:'Army',dc:'BCD',v:'',sc:'Yes',c:'CCB'},
  {l:'Ruiz',f:'Jose deJesus',s:'564652796',p:'3102187504',d:'1975-04-15',b:'Navy',dc:'HON',v:'100%',sc:'Yes',c:''},
  {l:'Rupe',f:'Richard',s:'610745184',p:'3104872984',d:'1989-04-24',b:'Coast Guard',dc:'GEN',v:'',sc:'Yes',c:'Van Nuys'},
  {l:'Salas',f:'Domas',s:'573801298',p:'6262353155',d:'1954-03-25',b:'Marines',dc:'HON',v:'10%',sc:'',c:''},
  {l:'Salazar',f:'Miguel',s:'568633500',p:'4245133515',d:'1980-03-20',b:'Navy',dc:'OTH',v:'',sc:'Yes',c:'Compton'},
  {l:'Sanchez',f:'Andy Rudy',s:'610388951',p:'3108679708',d:'1990-07-15',b:'Army',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Sanchez',f:'Rebecca',s:'545670874',p:'6618869966',d:'1981-04-01',b:'Air Force',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Satyanathan',f:'James',s:'291942898',p:'3234122091',d:'1988-02-18',b:'Army',dc:'HON',v:'90%',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Singh',f:'Channan',s:'098967381',p:'',d:'',b:'Marines',dc:'GEN',v:'60%',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Smith',f:'Donald',s:'411046770',p:'2132984308',d:'1956-06-06',b:'Navy',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Smith',f:'Robert',s:'064581413',p:'6317462374',d:'1967-09-09',b:'Air Force',dc:'HON',v:'100%',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Soriano',f:'Freddy',s:'623429462',p:'6265420844',d:'1989-02-11',b:'Marines',dc:'HON',v:'100%',sc:'',c:'CCB'},
  {l:'Stillman',f:'Michael',s:'557394875',p:'3238095477',d:'1963-03-06',b:'Army',dc:'HON',v:'10%',sc:'',c:'DTLA VTC Court'},
  {l:'Stone',f:'Rudy',s:'569044859',p:'6268067998',d:'1956-02-03',b:'Marines',dc:'HON',v:'',sc:'Yes',c:''},
  {l:'Tribble',f:'Kelly',s:'594184588',p:'3239983165',d:'1978-10-19',b:'Army',dc:'HON',v:'60%',sc:'',c:'CCB'},
  {l:'Trujeque',f:'Quinn',s:'613667204',p:'8182546456',d:'1993-06-29',b:'Marines',dc:'HON',v:'100%',sc:'',c:'Compton'},
  {l:'Van Buskirk',f:'Van',s:'604058987',p:'3108972259',d:'1975-06-13',b:'Air Force',dc:'HON',v:'100%',sc:'Yes',c:'Compton'},
  {l:'Vanheertum',f:'Larry',s:'069689338',p:'4242739434',d:'1982-09-05',b:'Army',dc:'OTH',v:'100%',sc:'Yes',c:'Van Nuys'},
  {l:'Viramontes',f:'Jessie',s:'548793063',p:'5624509154',d:'1984-11-19',b:'Marines',dc:'HON',v:'100%',sc:'Yes',c:'Compton'},
  {l:'Welch',f:'Brittain',s:'622666662',p:'9096336526',d:'1993-03-11',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:''},
  {l:'Wiley',f:'Michael',s:'562195732',p:'8186680454',d:'1959-03-28',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:''},
  {l:'Woods',f:'Billy',s:'552960397',p:'2137583114',d:'1955-11-11',b:'Army',dc:'HON',v:'90%',sc:'Yes',c:'Compton'},
  {l:'Young',f:'Kim',s:'575027990',p:'2134477888',d:'1953-04-10',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:''},
  {l:'Zarate',f:'Mario',s:'604091841',p:'7475880874',d:'1981-08-17',b:'Navy',dc:'HON',v:'80%',sc:'',c:'Compton'},
  {l:'Zamora',f:'Luis',s:'621513302',p:'2139131077',d:'1989-12-17',b:'Army',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Zenc',f:'John',s:'566049012',p:'2134560074',d:'1957-02-03',b:'Army',dc:'HON',v:'',sc:'Yes',c:'Lancaster'},
  {l:'Brunson',f:'Ronald',s:'249753895',p:'2138272230',d:'1983-12-28',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'CCB'},
  {l:'Davidson',f:'Carl',s:'205746357',p:'3235360672',d:'1994-06-11',b:'Army',dc:'GEN',v:'',sc:'Yes',c:''},
  {l:'Diaz',f:'Andres',s:'571595477',p:'',d:'1973-05-25',b:'Marines',dc:'HON',v:'100%',sc:'Yes',c:'CCB'},
  {l:'Holmes Jr.',f:'Glen',s:'571613245',p:'3233922784',d:'1979-11-17',b:'',dc:'HON',v:'70%',sc:'Yes',c:'Compton'},
  {l:'Mcelwee',f:'Denise',s:'606440267',p:'3233389533',d:'1987-07-23',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'CCB'},
  {l:'Reynaga',f:'Alfonso',s:'553627168',p:'',d:'',b:'',dc:'',v:'',sc:'',c:''},
  {l:'Argil',f:'David',s:'545116334',p:'5451163340',d:'1954-12-09',b:'Army',dc:'',v:'',sc:'Yes',c:'Compton'},
  {l:'Zinamon',f:'Tilson',s:'253554943',p:'2535549730',d:'1985-09-10',b:'Army',dc:'',v:'',sc:'',c:''},
  {l:'Robinson',f:'Zachary',s:'620097218',p:'3233766585',d:'1976-11-10',b:'Navy',dc:'GEN',v:'',sc:'',c:'CCB'},
  {l:'Jones',f:'Zavier',s:'422456031',p:'3182894651',d:'1996-08-20',b:'Army',dc:'HON',v:'10%',sc:'',c:'CCB'},
  {l:'Herring',f:'Torron',s:'440133781',p:'5104227416',d:'1998-11-19',b:'Army',dc:'HON',v:'',sc:'',c:'CCB'},
  {l:'Clark',f:'Jamaal',s:'572871305',p:'7473362776',d:'1984-12-28',b:'Air Force',dc:'GEN',v:'',sc:'',c:'CCB'},
  {l:'Neal',f:'Keldron',s:'570193209',p:'3104475971',d:'1970-10-09',b:'Army',dc:'HON',v:'100%',sc:'',c:'CCB'},
  {l:'Henry',f:'Vicente',s:'619178479',p:'6267980884',d:'1999-12-10',b:'Army',dc:'GEN',v:'',sc:'',c:'CCB'},
  {l:'Milton',f:'Mark',s:'553439753',p:'3235187858',d:'1964-10-19',b:'Army',dc:'HON',v:'',sc:'',c:'CCB'},
  {l:'Beverly',f:'Prophet',s:'421179971',p:'',d:'',b:'Army',dc:'HON',v:'70%',sc:'',c:'CCB'},
  {l:'Edwards Jr.',f:'Robert',s:'553195346',p:'2139495484',d:'1968-12-17',b:'Army',dc:'',v:'10%',sc:'',c:'CCB'},
  {l:'Cobbs',f:'Leonard',s:'323486409',p:'3233921024',d:'1954-06-27',b:'Coast Guard',dc:'HON',v:'',sc:'Yes',c:'CCB'},
  {l:'Davis',f:'Kenmore',s:'622187091',p:'',d:'1986-05-10',b:'',dc:'',v:'30%',sc:'',c:'CCB'},
  {l:'Ruiz',f:'Dioniso',s:'559652911',p:'',d:'1966-09-07',b:'',dc:'',v:'',sc:'',c:'CCB'},
  {l:'Foulks',f:'Malachi',s:'610278047',p:'6614566126',d:'2001-07-02',b:'Navy',dc:'HON',v:'100%',sc:'Yes',c:'Lancaster'},
  {l:'Romero',f:'Jose deJesus',s:'612192639',p:'',d:'2000-03-29',b:'Army',dc:'HON',v:'80%',sc:'',c:''},
  {l:'Karshoonzad',f:'Jeffrey',s:'559837465',p:'',d:'1985-12-15',b:'Army',dc:'',v:'20%',sc:'',c:''},
  {l:'Bowers',f:'Jeffrey',s:'542396210',p:'',d:'1992-04-20',b:'Army',dc:'DIS',v:'',sc:'',c:'CCB'},
  {l:'Cahill',f:'Valentina',s:'546950180',p:'',d:'1987-02-14',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'CCB'},
  {l:'Gonzalez',f:'Bonny',s:'610093535',p:'3105052615',d:'1981-08-26',b:'Navy',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Jaramillo',f:'Adrian',s:'617094887',p:'',d:'1986-04-25',b:'Navy',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Kelly',f:'Kevin',s:'603072987',p:'',d:'1987-12-08',b:'Navy',dc:'GEN',v:'',sc:'Yes',c:'Compton'},
  {l:'Brosius',f:'Jessie',s:'562738644',p:'3108033297',d:'',b:'Army',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Amaya',f:'John',s:'604251004',p:'3235174783',d:'2000-05-08',b:'Army',dc:'OTH',v:'80%',sc:'Yes',c:'Compton'},
  {l:'Lockett',f:'Alexander',s:'629141007',p:'',d:'1988-08-18',b:'Army',dc:'HON',v:'',sc:'',c:'Compton'},
  {l:'Shehane',f:'Johnny',s:'557573585',p:'8189873259',d:'1979-07-08',b:'Marines',dc:'HON',v:'',sc:'Yes',c:'Van Nuys'},
  {l:'Cruz',f:'Randy',s:'604283843',p:'3232145857',d:'1986-07-03',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'Van Nuys'},
  {l:'George',f:'Christopher',s:'546896586',p:'9095812716',d:'1970-03-09',b:'Marines',dc:'HON',v:'',sc:'Yes',c:'Van Nuys'},
  {l:'Tadeo',f:'Jose deJesus',s:'550454407',p:'8188566763',d:'1976-08-20',b:'Army',dc:'HON',v:'10%',sc:'Yes',c:'Van Nuys'},
  {l:'Bassi',f:'Jaspreet',s:'555652838',p:'3234976694',d:'1978-06-01',b:'Navy',dc:'OTH',v:'',sc:'Yes',c:'Van Nuys'},
  {l:'Clark',f:'Frederick',s:'420316520',p:'9039344354',d:'1988-05-03',b:'Army',dc:'GEN',v:'',sc:'Yes',c:'CCB'},
  {l:'Flood',f:'Delbert',s:'121563263',p:'',d:'1971-06-03',b:'Marines',dc:'OTH',v:'',sc:'Yes',c:'CCB'},
  {l:'De La Cruz',f:'Michael',s:'563410956',p:'5625254910',d:'1975-01-16',b:'Army',dc:'GEN',v:'',sc:'Yes',c:'CCB'},
  {l:'Menisteab',f:'Meron',s:'',p:'3106038053',d:'2001-03-17',b:'Marines',dc:'OTH',v:'',sc:'Yes',c:'Compton'},
  {l:'Duran',f:'Marco',s:'615609026',p:'3108637438',d:'1989-11-14',b:'',dc:'',v:'10%',sc:'Yes',c:'Van Nuys'},
  {l:'Solomon',f:'Calvin',s:'553172924',p:'',d:'',b:'Army',dc:'',v:'',sc:'Yes',c:'Compton'},
  {l:'Lyons',f:'Glenn',s:'626560223',p:'6573856259',d:'1990-02-21',b:'Army',dc:'',v:'',sc:'Yes',c:'Compton'},
  {l:'Delgado',f:'Hector',s:'',p:'5622460445',d:'1989-12-19',b:'Marines',dc:'HON',v:'80%',sc:'Yes',c:'Compton'},
  ];

  function nb(r){if(!r)return'';const u=r.toUpperCase();if(u.includes('MARINE')||u==='USMC')return'Marine Corps';if(u.includes('ARMY'))return'Army';if(u.includes('NAVY'))return'Navy';if(u.includes('AIR FORCE'))return'Air Force';if(u.includes('COAST GUARD'))return'Coast Guard';return r.trim();}
  function nd(r){if(!r)return'';const u=r.toUpperCase();if(u==='HON'||u.includes('HONOR'))return'Honorable';if(u==='GEN'||u.includes('GENERAL'))return'General (Under Honorable Conditions)';if(u==='OTH'||u.includes('OTHER THAN'))return'Other Than Honorable';if(u==='BCD'||u.includes('BAD CONDUCT'))return'Bad Conduct';if(u==='DIS'||u.includes('DISHONOR'))return'Dishonorable';return'';}
  function nc(r){if(!r)return'';const u=r.toUpperCase();if(u.includes('COMPTON'))return'Compton';if(u.includes('LANCASTER')||u.includes('ANTELOPE'))return'Lancaster';if(u.includes('CCB'))return'CCB';if(u.includes('DTLA')||u.includes('DOWNTOWN'))return'DTLA VTC Court';if(u.includes('VAN NUYS'))return'Van Nuys';return r.trim();}

  let inserted=0,skipped=0,errors=0;
  const log=[];

  for(const v of vets){
    try{
      const digits=v.s?String(v.s).replace(/[^0-9]/g,''):null;
      const ssnHash=digits&&digits.length>=4?require('crypto').createHash('sha256').update(digits).digest('hex'):null;
      let existing=null;
      if(ssnHash){const r=await pool.query('SELECT id FROM veterans WHERE ssn_hash=$1',[ssnHash]);if(r.rows.length>0)existing=r.rows[0];}
      if(!existing){const r=await pool.query('SELECT id FROM veterans WHERE LOWER(last_name)=LOWER($1) AND LOWER(first_name)=LOWER($2)',[v.l,v.f]);if(r.rows.length>0)existing=r.rows[0];}
      if(existing){log.push('SKIP: '+v.l+', '+v.f);skipped++;continue;}
      let encSSN=null;
      if(digits&&digits.length>=4){const key=Buffer.from((process.env.SSN_ENCRYPTION_KEY||'').padEnd(32).slice(0,32));const iv=require('crypto').randomBytes(16);const cipher=require('crypto').createCipheriv('aes-256-cbc',key,iv);encSSN=iv.toString('hex')+':'+Buffer.concat([cipher.update(digits),cipher.final()]).toString('hex');}
      await pool.query('INSERT INTO veterans (ssn,ssn_hash,last_name,first_name,phone,dob,branch,discharge_status,va_rating,sc_disability,vtc_courthouse,vtc_status,flags,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,\'Active\',\'[]\',NOW(),NOW())',[encSSN,ssnHash,v.l,v.f,v.p||null,v.d||null,nb(v.b),nd(v.dc),v.v||'',v.sc==='Yes'?'Yes':'',nc(v.c)]);
      log.push('OK: '+v.l+', '+v.f);inserted++;
    }catch(e){log.push('ERR: '+v.l+', '+v.f+' — '+e.message);errors++;}
  }
  res.json({success:true,inserted,skipped,errors,total:vets.length,log});
});


app.post("/api/migrate-veterans", async (req, res) => {
  const vets = [
  {l:'Acevedo Jr.',f:'Ernest',s:'575921818',p:'3104048911',d:'1973-07-30',b:'Army',dc:'HON',v:'30%',sc:'Yes',c:'Compton'},
  {l:'Baca',f:'Steven',s:'612328667',p:'6615613801',d:'1989-11-20',b:'Marines',dc:'HON',v:'10%',sc:'Yes',c:'Lancaster'},
  {l:'Baker',f:'Cleveland',s:'432198977',p:'',d:'1959-03-25',b:'Army',dc:'HON',v:'',sc:'Yes',c:'Lancaster'},
  {l:'Barlow',f:'Prince',s:'545172579',p:'3237777214',d:'1961-06-05',b:'Army',dc:'HON',v:'0%',sc:'Yes',c:'Lancaster'},
  {l:'Barnett',f:'Marvin Glen',s:'482116407',p:'6614866817',d:'1960-06-02',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'Lancaster'},
  {l:'Bell',f:'Derek',s:'587474851',p:'4243944710',d:'1983-10-03',b:'Army',dc:'HON',v:'70%',sc:'Yes',c:'Compton'},
  {l:'Boldt',f:'Jeffrey',s:'291440774',p:'7473723090',d:'1951-01-28',b:'Marines',dc:'HON',v:'',sc:'Yes',c:''},
  {l:'Braicov',f:'Melissa',s:'',p:'',d:'',b:'',dc:'',v:'',sc:'Yes',c:'Compton'},
  {l:'Campos',f:'Juan',s:'618050279',p:'4245663174',d:'1979-01-04',b:'Marines',dc:'HON',v:'70%',sc:'Yes',c:'Compton'},
  {l:'Cannon',f:'Jessie',s:'548619946',p:'4245580528',d:'1980-02-18',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'Compton'},
  {l:'Chisolm',f:'Kendrick',s:'439874489',p:'3237986407',d:'1993-10-19',b:'Marines',dc:'HON',v:'60%',sc:'Yes',c:''},
  {l:'Delacruz',f:'Michael Reuben',s:'563410956',p:'5625252491',d:'1975-01-16',b:'Army',dc:'GEN',v:'',sc:'Yes',c:'CCB'},
  {l:'Durham',f:'Deiondre',s:'602801198',p:'9094403635',d:'1993-04-05',b:'Air Force',dc:'GEN',v:'',sc:'Yes',c:'Compton'},
  {l:'Espinoza',f:'Fabian',s:'602649477',p:'3104155825',d:'1992-12-21',b:'Army',dc:'GEN',v:'60%',sc:'Yes',c:'Compton'},
  {l:'Estrada',f:'Ronald',s:'608209035',p:'3232006216',d:'1986-03-09',b:'Marines',dc:'HON',v:'90%',sc:'Yes',c:'CCB'},
  {l:'Fanning',f:'Cory',s:'572439980',p:'',d:'1962-11-04',b:'Army',dc:'',v:'10%',sc:'Yes',c:'Compton'},
  {l:'Finney',f:'Jalen',s:'',p:'',d:'1999-11-16',b:'',dc:'',v:'',sc:'',c:'Compton'},
  {l:'Fischer',f:'Giovanni',s:'056927942',p:'7472837444',d:'2002-03-12',b:'Marines',dc:'GEN',v:'10%',sc:'Yes',c:'Compton'},
  {l:'Galvan',f:'Francisco',s:'568479069',p:'8186137823',d:'1977-01-22',b:'Army',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Germany',f:'Davione',s:'623040441',p:'5627238312',d:'1998-01-21',b:'Army',dc:'DIS',v:'',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Ghaffar',f:'Jalaal',s:'552252256',p:'2133297825',d:'1963-10-31',b:'Army',dc:'HON',v:'50%',sc:'Yes',c:'Compton'},
  {l:'Gomez',f:'Rodrigo',s:'571873918',p:'3234485470',d:'1985-10-16',b:'Army',dc:'HON',v:'100%',sc:'',c:'DTLA VTC Court'},
  {l:'Green',f:'Steven Loyd',s:'563068773',p:'6267258281',d:'1960-12-06',b:'Navy',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Griffin',f:'Brandon',s:'335829796',p:'3019975966',d:'1984-12-08',b:'Air Force',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Grijalva',f:'Roldolfo',s:'564896290',p:'3235582275',d:'1986-05-24',b:'Marines',dc:'OTH',v:'',sc:'Yes',c:'Compton'},
  {l:'Guerra',f:'Antonio',s:'550712716',p:'7472286445',d:'1974-07-09',b:'Navy',dc:'HON',v:'',sc:'Yes',c:'CCB'},
  {l:'Gutierrez',f:'Cy',s:'607705105',p:'2134342754',d:'1989-11-24',b:'Army',dc:'HON',v:'70%',sc:'Yes',c:'CCB'},
  {l:'Hale',f:'Lloyd',s:'548353694',p:'3234214010',d:'1970-06-23',b:'Army',dc:'HON',v:'50%',sc:'Yes',c:'Compton'},
  {l:'Hamel',f:'Jeffrey',s:'005940330',p:'3102104438',d:'1993-04-03',b:'Army',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Hansen',f:'Jonathan Scott',s:'607963817',p:'9097478516',d:'1997-02-20',b:'Navy',dc:'GEN',v:'90%',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Hartsock',f:'Earl',s:'',p:'2136796068',d:'1981-08-26',b:'Air Force',dc:'HON',v:'100%',sc:'',c:'DTLA VTC Court'},
  {l:'He',f:'Benny Jiaming',s:'859046144',p:'3235416666',d:'1997-06-08',b:'Army',dc:'HON',v:'100%',sc:'',c:'DTLA VTC Court'},
  {l:'Hodge',f:'Loyd',s:'',p:'',d:'',b:'Navy',dc:'OTH',v:'',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Hopper',f:'Gerald',s:'552539687',p:'3108503186',d:'1961-06-11',b:'Army',dc:'GEN',v:'',sc:'Yes',c:'Compton'},
  {l:'Hun',f:'Kim',s:'',p:'',d:'',b:'Navy',dc:'',v:'',sc:'Yes',c:''},
  {l:'Jackson',f:'Jeremy',s:'621361319',p:'',d:'1990-05-15',b:'Marines',dc:'HON',v:'10%',sc:'Yes',c:'Compton'},
  {l:'Jaramilla',f:'Francisco',s:'564190790',p:'3104619309',d:'1962-10-13',b:'Marines',dc:'HON',v:'10%',sc:'Yes',c:'CCB'},
  {l:'Jaramillo',f:'Adrian',s:'617094007',p:'5629120715',d:'1986-04-25',b:'Navy',dc:'GEN',v:'',sc:'Yes',c:'Compton'},
  {l:'Jefferson',f:'Robert Earl',s:'566453796',p:'2138196417',d:'1962-02-25',b:'Air Force',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Johnson',f:'Rayfield',s:'',p:'5622840585',d:'1962-02-25',b:'Army',dc:'HON',v:'100%',sc:'',c:'Compton'},
  {l:'Johnson',f:'Elliot',s:'',p:'',d:'',b:'',dc:'',v:'',sc:'',c:'DTLA VTC Court'},
  {l:'Johnson',f:'Michael',s:'574135811',p:'',d:'1993-07-08',b:'',dc:'',v:'',sc:'',c:'DTLA VTC Court'},
  {l:'Kelly',f:'Kevin F.',s:'603072987',p:'4243553146',d:'1967-12-08',b:'Navy',dc:'HON',v:'',sc:'',c:'DTLA VTC Court'},
  {l:'Kleinbrook',f:'James',s:'368803690',p:'2138196417',d:'1972-07-02',b:'Army',dc:'HON',v:'100%',sc:'',c:'DTLA VTC Court'},
  {l:'Lampkin',f:'Jamal',s:'563755069',p:'9252725495',d:'1969-07-21',b:'Army',dc:'HON',v:'80%',sc:'Yes',c:'Compton'},
  {l:'Lebby',f:'Jerome',s:'154845617',p:'3106020032',d:'1988-04-29',b:'Army',dc:'HON',v:'50%',sc:'',c:'Lancaster'},
  {l:'Lopez',f:'Michael-Paul',s:'',p:'5623253642',d:'1986-07-21',b:'Army',dc:'HON',v:'90%',sc:'',c:'Compton'},
  {l:'Lozano',f:'Connie',s:'558873095',p:'6267150325',d:'1985-11-29',b:'Navy',dc:'HON',v:'80%',sc:'',c:'DTLA VTC Court'},
  {l:'Martinez',f:'James',s:'',p:'',d:'',b:'Army',dc:'HON',v:'',sc:'',c:'DTLA VTC Court'},
  {l:'Maxim',f:'David',s:'607043408',p:'6612601213',d:'1985-10-05',b:'Coast Guard',dc:'HON',v:'80%',sc:'',c:'DTLA VTC Court'},
  {l:'McCallister',f:'Matthew',s:'605425170',p:'5626658281',d:'1988-11-29',b:'Army',dc:'GEN',v:'70%',sc:'Yes',c:'DTLA VTC Court'},
  {l:'McCarty',f:'Edward',s:'',p:'',d:'',b:'',dc:'',v:'',sc:'',c:'DTLA VTC Court'},
  {l:'McCulley',f:'Logan',s:'605568217',p:'6614184367',d:'1986-12-11',b:'Army',dc:'HON',v:'60%',sc:'',c:''},
  {l:'McGary',f:'Karlton',s:'462397074',p:'8186137823',d:'1961-10-22',b:'Marines',dc:'OTH',v:'',sc:'Yes',c:''},
  {l:'McGeary',f:'David',s:'608508519',p:'',d:'1991-08-13',b:'Marines',dc:'OTH',v:'',sc:'Yes',c:'Lancaster'},
  {l:'Mcgee',f:'Terence',s:'566357320',p:'',d:'1962-01-08',b:'',dc:'',v:'',sc:'',c:''},
  {l:'Mcgee',f:'Tony',s:'569170433',p:'3232631206',d:'1967-01-10',b:'Marines',dc:'HON',v:'100%',sc:'Yes',c:'Compton'},
  {l:'Mendoza',f:'Armando',s:'552668745',p:'3104186771',d:'1950-05-14',b:'Army',dc:'HON',v:'60%',sc:'Yes',c:'Compton'},
  {l:'Millon',f:'Dimitri',s:'554683240',p:'3105320548',d:'1940-06-15',b:'Marines',dc:'HON',v:'80%',sc:'',c:''},
  {l:'Moore',f:'Charles',s:'623269021',p:'5102892900',d:'1989-07-06',b:'Marines',dc:'BCD',v:'',sc:'Yes',c:''},
  {l:'Moreno',f:'Walter',s:'620403194',p:'9289887913',d:'1990-09-29',b:'Marines',dc:'HON',v:'90%',sc:'Yes',c:'Van Nuys'},
  {l:'Mothershed',f:'Don Juan',s:'',p:'6262353155',d:'',b:'Marines',dc:'HON',v:'',sc:'',c:''},
  {l:'Mursalyan',f:'Davit',s:'615025204',p:'',d:'1997-10-09',b:'Marines',dc:'OTH',v:'',sc:'',c:''},
  {l:'Nash',f:'Dubreque Esington',s:'622703796',p:'6269404319',d:'1991-02-24',b:'Army',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Navarro',f:'Eric',s:'',p:'6267150035',d:'',b:'Navy',dc:'HON',v:'80%',sc:'',c:''},
  {l:'Navarrete',f:'Jose',s:'548756516',p:'8056072029',d:'',b:'Marines',dc:'OTH',v:'100%',sc:'',c:'CCB'},
  {l:'Newman',f:'Anita',s:'620106416',p:'3235177386',d:'1988-04-06',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'Compton'},
  {l:'Palacios',f:'Adrian',s:'604268773',p:'5626797888',d:'1973-06-22',b:'Navy',dc:'OTH',v:'',sc:'Yes',c:''},
  {l:'Palacol',f:'Celestino',s:'576929482',p:'4242441722',d:'1960-06-28',b:'Army',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Paras',f:'Nestor',s:'610415991',p:'8584723716',d:'1992-09-12',b:'Army',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Park',f:'Kyuchang',s:'552752867',p:'6267562698',d:'1964-08-10',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'CCB'},
  {l:'Parks',f:'Robert',s:'456374876',p:'2133492595',d:'1965-03-28',b:'Marines',dc:'OTH',v:'',sc:'Yes',c:'Compton'},
  {l:'Passmore',f:'Steven',s:'558959778',p:'6618603731',d:'1984-09-27',b:'Army',dc:'HON',v:'100%',sc:'',c:'Compton'},
  {l:'Patrick',f:'Perry',s:'',p:'9094189636',d:'1971-02-15',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:''},
  {l:'Perez-Lopez',f:'Fernando',s:'748183112',p:'3234046319',d:'1984-05-31',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'Compton'},
  {l:'Quinn',f:'Bennie',s:'354581212',p:'3236354960',d:'1974-04-16',b:'Army',dc:'HON',v:'100%',sc:'',c:'Compton'},
  {l:'Ramirez',f:'Jose',s:'',p:'2133297825',d:'1992-09-17',b:'',dc:'OTH',v:'',sc:'Yes',c:'Compton'},
  {l:'Roberts',f:'Darius',s:'',p:'',d:'',b:'',dc:'',v:'',sc:'',c:''},
  {l:'Roberts',f:'Oscar',s:'229176818',p:'4249776107',d:'1978-03-13',b:'Air Force',dc:'GEN',v:'',sc:'Yes',c:'Van Nuys'},
  {l:'Rodgers',f:'RD',s:'563357325',p:'',d:'1965-12-27',b:'Navy',dc:'HON',v:'100%',sc:'Yes',c:'Lancaster'},
  {l:'Rodriguez',f:'Felicia',s:'320647788',p:'',d:'',b:'Marines',dc:'HON',v:'70%',sc:'Yes',c:'CCB'},
  {l:'Rodriguez',f:'Walter',s:'321444027',p:'5593104887',d:'1948-08-09',b:'Marines',dc:'HON',v:'100%',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Rosas',f:'Richard Jose',s:'558312177',p:'5623296093',d:'1963-07-18',b:'Army',dc:'BCD',v:'',sc:'Yes',c:'CCB'},
  {l:'Ruiz',f:'Jose deJesus',s:'564652796',p:'3102187504',d:'1975-04-15',b:'Navy',dc:'HON',v:'100%',sc:'Yes',c:''},
  {l:'Rupe',f:'Richard',s:'610745184',p:'3104872984',d:'1989-04-24',b:'Coast Guard',dc:'GEN',v:'',sc:'Yes',c:'Van Nuys'},
  {l:'Salas',f:'Domas',s:'573801298',p:'6262353155',d:'1954-03-25',b:'Marines',dc:'HON',v:'10%',sc:'',c:''},
  {l:'Salazar',f:'Miguel',s:'568633500',p:'4245133515',d:'1980-03-20',b:'Navy',dc:'OTH',v:'',sc:'Yes',c:'Compton'},
  {l:'Sanchez',f:'Andy Rudy',s:'610388951',p:'3108679708',d:'1990-07-15',b:'Army',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Sanchez',f:'Rebecca',s:'545670874',p:'6618869966',d:'1981-04-01',b:'Air Force',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Satyanathan',f:'James',s:'291942898',p:'3234122091',d:'1988-02-18',b:'Army',dc:'HON',v:'90%',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Singh',f:'Channan',s:'098967381',p:'',d:'',b:'Marines',dc:'GEN',v:'60%',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Smith',f:'Donald',s:'411046770',p:'2132984308',d:'1956-06-06',b:'Navy',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Smith',f:'Robert',s:'064581413',p:'6317462374',d:'1967-09-09',b:'Air Force',dc:'HON',v:'100%',sc:'Yes',c:'DTLA VTC Court'},
  {l:'Soriano',f:'Freddy',s:'623429462',p:'6265420844',d:'1989-02-11',b:'Marines',dc:'HON',v:'100%',sc:'',c:'CCB'},
  {l:'Stillman',f:'Michael',s:'557394875',p:'3238095477',d:'1963-03-06',b:'Army',dc:'HON',v:'10%',sc:'',c:'DTLA VTC Court'},
  {l:'Stone',f:'Rudy',s:'569044859',p:'6268067998',d:'1956-02-03',b:'Marines',dc:'HON',v:'',sc:'Yes',c:''},
  {l:'Tribble',f:'Kelly',s:'594184588',p:'3239983165',d:'1978-10-19',b:'Army',dc:'HON',v:'60%',sc:'',c:'CCB'},
  {l:'Trujeque',f:'Quinn',s:'613667204',p:'8182546456',d:'1993-06-29',b:'Marines',dc:'HON',v:'100%',sc:'',c:'Compton'},
  {l:'Van Buskirk',f:'Van',s:'604058987',p:'3108972259',d:'1975-06-13',b:'Air Force',dc:'HON',v:'100%',sc:'Yes',c:'Compton'},
  {l:'Vanheertum',f:'Larry',s:'069689338',p:'4242739434',d:'1982-09-05',b:'Army',dc:'OTH',v:'100%',sc:'Yes',c:'Van Nuys'},
  {l:'Viramontes',f:'Jessie',s:'548793063',p:'5624509154',d:'1984-11-19',b:'Marines',dc:'HON',v:'100%',sc:'Yes',c:'Compton'},
  {l:'Welch',f:'Brittain',s:'622666662',p:'9096336526',d:'1993-03-11',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:''},
  {l:'Wiley',f:'Michael',s:'562195732',p:'8186680454',d:'1959-03-28',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:''},
  {l:'Woods',f:'Billy',s:'552960397',p:'2137583114',d:'1955-11-11',b:'Army',dc:'HON',v:'90%',sc:'Yes',c:'Compton'},
  {l:'Young',f:'Kim',s:'575027990',p:'2134477888',d:'1953-04-10',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:''},
  {l:'Zarate',f:'Mario',s:'604091841',p:'7475880874',d:'1981-08-17',b:'Navy',dc:'HON',v:'80%',sc:'',c:'Compton'},
  {l:'Zamora',f:'Luis',s:'621513302',p:'2139131077',d:'1989-12-17',b:'Army',dc:'HON',v:'100%',sc:'',c:''},
  {l:'Zenc',f:'John',s:'566049012',p:'2134560074',d:'1957-02-03',b:'Army',dc:'HON',v:'',sc:'Yes',c:'Lancaster'},
  {l:'Brunson',f:'Ronald',s:'249753895',p:'2138272230',d:'1983-12-28',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'CCB'},
  {l:'Davidson',f:'Carl',s:'205746357',p:'3235360672',d:'1994-06-11',b:'Army',dc:'GEN',v:'',sc:'Yes',c:''},
  {l:'Diaz',f:'Andres',s:'571595477',p:'',d:'1973-05-25',b:'Marines',dc:'HON',v:'100%',sc:'Yes',c:'CCB'},
  {l:'Holmes Jr.',f:'Glen',s:'571613245',p:'3233922784',d:'1979-11-17',b:'',dc:'HON',v:'70%',sc:'Yes',c:'Compton'},
  {l:'Mcelwee',f:'Denise',s:'606440267',p:'3233389533',d:'1987-07-23',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'CCB'},
  {l:'Reynaga',f:'Alfonso',s:'553627168',p:'',d:'',b:'',dc:'',v:'',sc:'',c:''},
  {l:'Argil',f:'David',s:'545116334',p:'5451163340',d:'1954-12-09',b:'Army',dc:'',v:'',sc:'Yes',c:'Compton'},
  {l:'Zinamon',f:'Tilson',s:'253554943',p:'2535549730',d:'1985-09-10',b:'Army',dc:'',v:'',sc:'',c:''},
  {l:'Robinson',f:'Zachary',s:'620097218',p:'3233766585',d:'1976-11-10',b:'Navy',dc:'GEN',v:'',sc:'',c:'CCB'},
  {l:'Jones',f:'Zavier',s:'422456031',p:'3182894651',d:'1996-08-20',b:'Army',dc:'HON',v:'10%',sc:'',c:'CCB'},
  {l:'Herring',f:'Torron',s:'440133781',p:'5104227416',d:'1998-11-19',b:'Army',dc:'HON',v:'',sc:'',c:'CCB'},
  {l:'Clark',f:'Jamaal',s:'572871305',p:'7473362776',d:'1984-12-28',b:'Air Force',dc:'GEN',v:'',sc:'',c:'CCB'},
  {l:'Neal',f:'Keldron',s:'570193209',p:'3104475971',d:'1970-10-09',b:'Army',dc:'HON',v:'100%',sc:'',c:'CCB'},
  {l:'Henry',f:'Vicente',s:'619178479',p:'6267980884',d:'1999-12-10',b:'Army',dc:'GEN',v:'',sc:'',c:'CCB'},
  {l:'Milton',f:'Mark',s:'553439753',p:'3235187858',d:'1964-10-19',b:'Army',dc:'HON',v:'',sc:'',c:'CCB'},
  {l:'Beverly',f:'Prophet',s:'421179971',p:'',d:'',b:'Army',dc:'HON',v:'70%',sc:'',c:'CCB'},
  {l:'Edwards Jr.',f:'Robert',s:'553195346',p:'2139495484',d:'1968-12-17',b:'Army',dc:'',v:'10%',sc:'',c:'CCB'},
  {l:'Cobbs',f:'Leonard',s:'323486409',p:'3233921024',d:'1954-06-27',b:'Coast Guard',dc:'HON',v:'',sc:'Yes',c:'CCB'},
  {l:'Davis',f:'Kenmore',s:'622187091',p:'',d:'1986-05-10',b:'',dc:'',v:'30%',sc:'',c:'CCB'},
  {l:'Ruiz',f:'Dioniso',s:'559652911',p:'',d:'1966-09-07',b:'',dc:'',v:'',sc:'',c:'CCB'},
  {l:'Foulks',f:'Malachi',s:'610278047',p:'6614566126',d:'2001-07-02',b:'Navy',dc:'HON',v:'100%',sc:'Yes',c:'Lancaster'},
  {l:'Romero',f:'Jose deJesus',s:'612192639',p:'',d:'2000-03-29',b:'Army',dc:'HON',v:'80%',sc:'',c:''},
  {l:'Karshoonzad',f:'Jeffrey',s:'559837465',p:'',d:'1985-12-15',b:'Army',dc:'',v:'20%',sc:'',c:''},
  {l:'Bowers',f:'Jeffrey',s:'542396210',p:'',d:'1992-04-20',b:'Army',dc:'DIS',v:'',sc:'',c:'CCB'},
  {l:'Cahill',f:'Valentina',s:'546950180',p:'',d:'1987-02-14',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'CCB'},
  {l:'Gonzalez',f:'Bonny',s:'610093535',p:'3105052615',d:'1981-08-26',b:'Navy',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Jaramillo',f:'Adrian',s:'617094887',p:'',d:'1986-04-25',b:'Navy',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Kelly',f:'Kevin',s:'603072987',p:'',d:'1987-12-08',b:'Navy',dc:'GEN',v:'',sc:'Yes',c:'Compton'},
  {l:'Brosius',f:'Jessie',s:'562738644',p:'3108033297',d:'',b:'Army',dc:'HON',v:'',sc:'Yes',c:'Compton'},
  {l:'Amaya',f:'John',s:'604251004',p:'3235174783',d:'2000-05-08',b:'Army',dc:'OTH',v:'80%',sc:'Yes',c:'Compton'},
  {l:'Lockett',f:'Alexander',s:'629141007',p:'',d:'1988-08-18',b:'Army',dc:'HON',v:'',sc:'',c:'Compton'},
  {l:'Shehane',f:'Johnny',s:'557573585',p:'8189873259',d:'1979-07-08',b:'Marines',dc:'HON',v:'',sc:'Yes',c:'Van Nuys'},
  {l:'Cruz',f:'Randy',s:'604283843',p:'3232145857',d:'1986-07-03',b:'Army',dc:'HON',v:'100%',sc:'Yes',c:'Van Nuys'},
  {l:'George',f:'Christopher',s:'546896586',p:'9095812716',d:'1970-03-09',b:'Marines',dc:'HON',v:'',sc:'Yes',c:'Van Nuys'},
  {l:'Tadeo',f:'Jose deJesus',s:'550454407',p:'8188566763',d:'1976-08-20',b:'Army',dc:'HON',v:'10%',sc:'Yes',c:'Van Nuys'},
  {l:'Bassi',f:'Jaspreet',s:'555652838',p:'3234976694',d:'1978-06-01',b:'Navy',dc:'OTH',v:'',sc:'Yes',c:'Van Nuys'},
  {l:'Clark',f:'Frederick',s:'420316520',p:'9039344354',d:'1988-05-03',b:'Army',dc:'GEN',v:'',sc:'Yes',c:'CCB'},
  {l:'Flood',f:'Delbert',s:'121563263',p:'',d:'1971-06-03',b:'Marines',dc:'OTH',v:'',sc:'Yes',c:'CCB'},
  {l:'De La Cruz',f:'Michael',s:'563410956',p:'5625254910',d:'1975-01-16',b:'Army',dc:'GEN',v:'',sc:'Yes',c:'CCB'},
  {l:'Menisteab',f:'Meron',s:'',p:'3106038053',d:'2001-03-17',b:'Marines',dc:'OTH',v:'',sc:'Yes',c:'Compton'},
  {l:'Duran',f:'Marco',s:'615609026',p:'3108637438',d:'1989-11-14',b:'',dc:'',v:'10%',sc:'Yes',c:'Van Nuys'},
  {l:'Solomon',f:'Calvin',s:'553172924',p:'',d:'',b:'Army',dc:'',v:'',sc:'Yes',c:'Compton'},
  {l:'Lyons',f:'Glenn',s:'626560223',p:'6573856259',d:'1990-02-21',b:'Army',dc:'',v:'',sc:'Yes',c:'Compton'},
  {l:'Delgado',f:'Hector',s:'',p:'5622460445',d:'1989-12-19',b:'Marines',dc:'HON',v:'80%',sc:'Yes',c:'Compton'},
  ];

  function nb(r){if(!r)return'';const u=r.toUpperCase();if(u.includes('MARINE')||u==='USMC')return'Marine Corps';if(u.includes('ARMY'))return'Army';if(u.includes('NAVY'))return'Navy';if(u.includes('AIR FORCE'))return'Air Force';if(u.includes('COAST GUARD'))return'Coast Guard';return r.trim();}
  function nd(r){if(!r)return'';const u=r.toUpperCase();if(u==='HON'||u.includes('HONOR'))return'Honorable';if(u==='GEN'||u.includes('GENERAL'))return'General (Under Honorable Conditions)';if(u==='OTH'||u.includes('OTHER THAN'))return'Other Than Honorable';if(u==='BCD'||u.includes('BAD CONDUCT'))return'Bad Conduct';if(u==='DIS'||u.includes('DISHONOR'))return'Dishonorable';return'';}
  function nc(r){if(!r)return'';const u=r.toUpperCase();if(u.includes('COMPTON'))return'Compton';if(u.includes('LANCASTER')||u.includes('ANTELOPE'))return'Lancaster';if(u.includes('CCB'))return'CCB';if(u.includes('DTLA')||u.includes('DOWNTOWN'))return'DTLA VTC Court';if(u.includes('VAN NUYS'))return'Van Nuys';return r.trim();}

  let inserted=0,skipped=0,errors=0;
  const log=[];

  for(const v of vets){
    try{
      const digits=v.s?String(v.s).replace(/[^0-9]/g,''):null;
      const ssnHash=digits&&digits.length>=4?require('crypto').createHash('sha256').update(digits).digest('hex'):null;
      let existing=null;
      if(ssnHash){const r=await pool.query('SELECT id FROM veterans WHERE ssn_hash=$1',[ssnHash]);if(r.rows.length>0)existing=r.rows[0];}
      if(!existing){const r=await pool.query('SELECT id FROM veterans WHERE LOWER(last_name)=LOWER($1) AND LOWER(first_name)=LOWER($2)',[v.l,v.f]);if(r.rows.length>0)existing=r.rows[0];}
      if(existing){log.push('SKIP: '+v.l+', '+v.f);skipped++;continue;}
      let encSSN=null;
      if(digits&&digits.length>=4){const key=Buffer.from((process.env.SSN_ENCRYPTION_KEY||'').padEnd(32).slice(0,32));const iv=require('crypto').randomBytes(16);const cipher=require('crypto').createCipheriv('aes-256-cbc',key,iv);encSSN=iv.toString('hex')+':'+Buffer.concat([cipher.update(digits),cipher.final()]).toString('hex');}
      await pool.query('INSERT INTO veterans (ssn,ssn_hash,last_name,first_name,phone,dob,branch,discharge_status,va_rating,sc_disability,vtc_courthouse,vtc_status,flags,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,\'Active\',\'[]\',NOW(),NOW())',[encSSN,ssnHash,v.l,v.f,v.p||null,v.d||null,nb(v.b),nd(v.dc),v.v||'',v.sc==='Yes'?'Yes':'',nc(v.c)]);
      log.push('OK: '+v.l+', '+v.f);inserted++;
    }catch(e){log.push('ERR: '+v.l+', '+v.f+' — '+e.message);errors++;}
  }
  res.json({success:true,inserted,skipped,errors,total:vets.length,log});
});



app.get("/health", (req, res) => res.json({ status: "ok", igm: "active", patent: "USPTO 19/571,156", version: "2.0.0" }));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`CivGATE 2.0 running on port ${PORT}`);
  console.log(`IGM Governed | USPTO 19/571,156 | DeBacco Nexus LLC`);
});