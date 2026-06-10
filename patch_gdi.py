#!/usr/bin/env python3
# AIRS - GDI (Governed Data Intelligence) Tier 2: Call E
import sys

P1 = "nexus-template.cjs"
s = open(P1, encoding="utf-8").read()
if "/api/gdi/analyze" in s:
    print("[SKIP] GDI endpoint already present.")
else:
    A = "app.get('*', (req, res) => {"
    if s.count(A) != 1: print("[FAIL] catch-all anchor"); sys.exit(1)
    GDI = """// --- GDI: Governed Data Intelligence (Tier 2) - deterministic cross-record inference, zero tokens ---
app.post('/api/gdi/analyze', async (req, res) => {
  const t0 = Date.now();
  try {
    const findings = [];
    const recs = (await pool.query(`SELECT id, field_1, field_2, field_3, field_4, field_5, field_6, status, created_at, is_demo FROM ${TABLE_NAME}`)).rows;
    const contacts = (await pool.query('SELECT record_id, MAX(created_at) AS last_contact FROM contact_log GROUP BY record_id')).rows;
    const events = (await pool.query(`SELECT record_id, event_date, event_type FROM calendar_events WHERE event_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`)).rows;
    const lastContact = {}; contacts.forEach(c => lastContact[c.record_id] = new Date(c.last_contact));
    const now = new Date(); const DAY = 86400000;

    const active = recs.filter(r => r.status === 'active');
    const stale = active.filter(r => !lastContact[r.id] || (now - lastContact[r.id]) > 30 * DAY);
    if (stale.length) findings.push({ rule: 'GDI-R1', severity: 'HIGH', title: 'Active records without recent contact', description: stale.length + ' of ' + active.length + ' active records have no logged contact in the last 30 days.', evidence: stale.map(r => r.id) });
    else if (active.length) findings.push({ rule: 'GDI-R1', severity: 'PASS', title: 'Contact recency verified', description: 'All ' + active.length + ' active records have a logged contact within 30 days.', evidence: active.map(r => r.id) });

    const pending = recs.filter(r => r.status === 'pending');
    const agedPending = pending.filter(r => (now - new Date(r.created_at)) > 14 * DAY);
    if (agedPending.length) findings.push({ rule: 'GDI-R2', severity: 'HIGH', title: 'Pending records aging past 14 days', description: agedPending.length + ' pending record(s) have waited more than 14 days for review.', evidence: agedPending.map(r => r.id) });
    else if (pending.length) findings.push({ rule: 'GDI-R2', severity: 'INFO', title: 'Pending records in queue', description: pending.length + ' record(s) currently pending review, all within the 14-day window.', evidence: pending.map(r => r.id) });

    if (events.length) {
      const unprepared = events.filter(e => !lastContact[e.record_id]);
      if (unprepared.length) findings.push({ rule: 'GDI-R3', severity: 'HIGH', title: 'Upcoming events without contact', description: unprepared.length + ' event(s) in the next 7 days belong to records with no contact logged.', evidence: unprepared.map(e => e.record_id) });
      else findings.push({ rule: 'GDI-R3', severity: 'INFO', title: 'Events in the next 7 days', description: events.length + ' upcoming event(s); every linked record has contact history.', evidence: [...new Set(events.map(e => e.record_id))] });
    }

    if (recs.length) {
      let filled = 0; const weak = [];
      for (let f = 1; f <= 6; f++) {
        const have = recs.filter(r => r['field_' + f] && String(r['field_' + f]).trim()).length;
        const pct = Math.round(100 * have / recs.length);
        filled += pct;
        if (pct < 60) weak.push('field_' + f + ' (' + pct + '%)');
      }
      const overall = Math.round(filled / 6);
      if (weak.length) findings.push({ rule: 'GDI-R4', severity: 'MODERATE', title: 'Governed fields under-populated', description: 'Fields below 60% completeness: ' + weak.join(', ') + '. Overall completeness ' + overall + '%.', evidence: [] });
      else findings.push({ rule: 'GDI-R4', severity: 'PASS', title: 'Field completeness ' + overall + '%', description: 'All six governed fields exceed the 60% completeness floor across ' + recs.length + ' records.', evidence: [] });
    }

    const dist = {}; recs.forEach(r => dist[r.status] = (dist[r.status] || 0) + 1);
    findings.push({ rule: 'GDI-R5', severity: 'INFO', title: 'Status distribution', description: Object.entries(dist).map(([k, v]) => v + ' ' + k).join(' / ') + ' across ' + recs.length + ' total records.', evidence: [] });

    const receipts = { records_scanned: recs.length, rules_executed: 5, tokens_in: 0, tokens_out: 0, duration_ms: Date.now() - t0, ran_at: new Date().toISOString() };
    try { await pool.query('INSERT INTO audit_log (table_name, action_type, changed_by, new_value) VALUES ($1,$2,$3,$4)', ['gdi_runs', 'GDI_RUN', req.body && req.body.run_by || 'operator', JSON.stringify({ findings: findings.length, ...receipts })]); } catch (e) {}
    console.log('[IGM] GDI run: ' + findings.length + ' findings, ' + recs.length + ' records, 0 tokens, ' + receipts.duration_ms + 'ms');
    res.json({ success: true, tier: 'GDI - Governed Data Intelligence', findings, receipts });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

""" + A
    s = s.replace(A, GDI)
    open(P1, "w", encoding="utf-8").write(s)
    print("[OK] GDI endpoint added - 5 rules, zero tokens, audit-logged")

P2 = "nexus-base-frontend.html"
f = open(P2, encoding="utf-8").read()
if "runGDI" in f:
    print("[SKIP] GDI panel already present.")
else:
    NAV = """<button class="nav-btn" data-mode="datalog" onclick="showMode('datalog')"><span class="nav-icon">&#9632;</span> Governed Data Log</button>"""
    if f.count(NAV) != 1: print("[FAIL] nav anchor"); sys.exit(1)
    GDI_BTN = """<button class="nav-btn" data-mode="gdi" onclick="showMode('gdi')"><span class="nav-icon">&#9670;</span> GDI Analysis</button>"""
    f = f.replace(NAV, NAV + "\\n  " + GDI_BTN)

    MODE = '<div id="mode-datalog" style="display:none">'
    if f.count(MODE) != 1: print("[FAIL] mode anchor"); sys.exit(1)
    PANEL = '''<div id="mode-gdi" style="display:none">
  <div class="card">
    <div class="card-header"><div class="card-title">GDI &#8212; Governed Data Intelligence <span class="igm-badge">TIER 2 &middot; IGM-GOVERNED</span></div></div>
    <div style="padding:16px">
      <div style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:14px">Cross-record inference with receipts. Deterministic rules, zero tokens, every run audit-logged. GDI reads what the data says &#8212; within the blind spots NSI has declared.</div>
      <button class="btn btn-primary" onclick="runGDI()" id="gdi-run-btn">&#9670; Run GDI Analysis</button>
      <span id="gdi-receipts" style="margin-left:14px;font-size:12px;color:var(--teal);font-family:'IBM Plex Mono',monospace"></span>
    </div>
    <div id="gdi-findings" style="padding:0 16px 16px"></div>
  </div>
</div>
''' + MODE
    f = f.replace(MODE, PANEL)

    J = 'document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDemo();});'
    if f.count(J) != 1: print("[FAIL] JS anchor"); sys.exit(1)
    GJS = J + '''
async function runGDI(){
  const btn=document.getElementById("gdi-run-btn");btn.disabled=true;btn.textContent="Running...";
  try{
    const r=await fetch("/api/gdi/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({run_by:"operator"})});
    const d=await r.json();
    if(!d.success){toast("GDI error: "+d.error,true);return;}
    const sev={CRITICAL:"var(--coral)",HIGH:"var(--gold)",MODERATE:"var(--violet)",INFO:"var(--cyan)",PASS:"var(--green)"};
    document.getElementById("gdi-receipts").textContent=d.receipts.records_scanned+" records / "+d.receipts.rules_executed+" rules / "+d.receipts.tokens_in+" tokens / "+d.receipts.duration_ms+"ms";
    document.getElementById("gdi-findings").innerHTML=d.findings.map(x=>`<div style="border:1px solid var(--border);border-left:3px solid ${sev[x.severity]||"var(--border2)"};border-radius:10px;padding:14px 16px;margin-bottom:10px;background:var(--bg3)"><div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><span style="font-size:11px;font-weight:800;letter-spacing:.08em;color:${sev[x.severity]};border:1px solid ${sev[x.severity]};padding:2px 8px;border-radius:6px">${x.severity}</span><span style="font-size:14px;font-weight:700;color:var(--text)">${x.title}</span><span style="margin-left:auto;font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace">${x.rule}</span></div><div style="font-size:13px;color:var(--text2);line-height:1.6">${x.description}</div>${x.evidence&&x.evidence.length?`<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">${x.evidence.map(id=>`<button onclick="openRecord(${id})" style="font-size:11px;font-family:'IBM Plex Mono',monospace;color:var(--cyan);background:transparent;border:1px solid var(--border2);border-radius:6px;padding:3px 9px;cursor:pointer">#${id}</button>`).join("")}</div>`:""}</div>`).join("");
    toast("GDI: "+d.findings.length+" findings, "+d.receipts.tokens_in+" tokens");
  }catch(e){toast("GDI error: "+e.message,true);}
  finally{btn.disabled=false;btn.innerHTML="&#9670; Run GDI Analysis";}
}'''
    f = f.replace(J, GJS)
    open(P2, "w", encoding="utf-8").write(f)
    print("[OK] GDI panel added - nav, mode, findings renderer with evidence chips")
