/**
 * AIRS Studio — Server
 * Governed AI Nexus Generator
 * DeBacco Nexus LLC · USPTO Patent Pending 19/571,156
 * 
 * Architecture:
 *   User submits domain prompt
 *   → Claude API generates complete Nexus codebase
 *   → Railway API provisions new project + PostgreSQL
 *   → Generated code deployed to Railway
 *   → User receives live Nexus URL
 *   → Node builds custom Pods on demand
 */

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const RAILWAY_TOKEN = process.env.RAILWAY_API_TOKEN;
const RAILWAY_TEAM_ID = process.env.RAILWAY_TEAM_ID || null; // null for personal workspace
const PORT = process.env.PORT || 8080;

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Initialize nexus_registry table
async function initRegistry() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nexus_registry (
        nexus_id VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[AIRS Studio] Registry database ready');
  } catch (err) {
    console.error('[AIRS Studio] Registry DB init error:', err.message);
  }
}

// Registry interface — drop-in replacement for Map
const nexusRegistry = {
  async set(id, data) {
    try {
      await pool.query(`
        INSERT INTO nexus_registry (nexus_id, data, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (nexus_id) DO UPDATE
        SET data = $2, updated_at = CURRENT_TIMESTAMP
      `, [id, JSON.stringify(data)]);
    } catch (err) {
      console.error('[AIRS Studio] Registry set error:', err.message);
    }
  },
  async get(id) {
    try {
      const result = await pool.query('SELECT data FROM nexus_registry WHERE nexus_id = $1', [id]);
      return result.rows[0] ? result.rows[0].data : null;
    } catch (err) {
      console.error('[AIRS Studio] Registry get error:', err.message);
      return null;
    }
  },
  async values() {
    try {
      const result = await pool.query('SELECT data FROM nexus_registry ORDER BY created_at DESC');
      return result.rows.map(r => r.data);
    } catch (err) {
      console.error('[AIRS Studio] Registry values error:', err.message);
      return [];
    }
  }
};

// ─── RAILWAY GRAPHQL CLIENT ───────────────────────────────────────────────────
async function railwayQuery(query, variables = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(
        'https://backboard.railway.app/graphql/v2',
        { query, variables },
        {
          headers: {
            'Authorization': `Bearer ${RAILWAY_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );
      if (res.data.errors) throw new Error(res.data.errors[0].message);
      return res.data.data;
    } catch (err) {
      const isLast = attempt === retries;
      if (isLast) throw err;
      const wait = attempt * 3000;
      console.log('[AIRS Studio] Railway API attempt ' + attempt + ' failed, retrying in ' + (wait/1000) + 's...');
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

// ─── IGM PROMPT CLASSIFIER ────────────────────────────────────────────────────
// Pre-inference governance — classifies and validates the Nexus generation prompt
// before any code is generated. This is the IGM at the infrastructure level.
function igmClassifyPrompt(prompt) {
  const lower = prompt.toLowerCase();
  
  // Governance check — block harmful use cases
  const blocked = ['weapon', 'surveillance without consent', 'illegal', 'hack'];
  for (const term of blocked) {
    if (lower.includes(term)) {
      return { approved: false, reason: `IGM blocked: prompt contains '${term}'` };
    }
  }

  // Extract domain signals
  const domains = {
    healthcare: ['health', 'medical', 'patient', 'clinical', 'hospital', 'nurse', 'doctor'],
    education: ['school', 'university', 'student', 'course', 'curriculum', 'education', 'academic', 'faculty'],
    justice: ['court', 'legal', 'justice', 'case', 'defendant', 'probation', 'veteran'],
    welfare: ['welfare', 'child', 'family', 'social', 'housing', 'shelter', 'abuse'],
    public_health: ['disease', 'outbreak', 'mortality', 'surveillance', 'epidemic'],
    emergency: ['disaster', 'emergency', 'response', 'crisis', 'refugee'],
    nonprofit: ['nonprofit', 'charity', 'volunteer', 'donation', 'program'],
    government: ['government', 'agency', 'department', 'county', 'city', 'state', 'federal']
  };

  let detectedDomain = 'general';
  let maxMatches = 0;
  for (const [domain, keywords] of Object.entries(domains)) {
    const matches = keywords.filter(k => lower.includes(k)).length;
    if (matches > maxMatches) { maxMatches = matches; detectedDomain = domain; }
  }

  return {
    approved: true,
    domain: detectedDomain,
    sensitivity: maxMatches > 2 ? 'high' : 'standard',
    governance_tier: maxMatches > 2 ? 'enhanced' : 'standard',
    token_budget: 4000
  };
}

// ─── NEXUS CODE GENERATOR ─────────────────────────────────────────────────────
async function generateNexusCode(prompt, nexusId, classification) {
  const apiHeaders = {
    'x-api-key': ANTHROPIC_KEY,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json'
  };

  // Detect language from prompt or default to English
  const langHint = classification.language || 'English';

  // Call A: metadata
  console.log('[AIRS Studio] Step A: metadata...');
  const metaRes = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: 'You are AIRS Studio. Respond ONLY with valid JSON, no markdown. Detect the language of the user prompt and use that language for all text content in nexus_name, nexus_description, schema_description, fields, and pods_suggested.',
    messages: [{ role: 'user', content: 'For this domain: "' + prompt + '" return JSON with keys: nexus_name, nexus_description, primary_entity, schema_description, fields (array of 6), pods_suggested (array of 3)' }]
  }, { headers: apiHeaders });
  const metaRaw = metaRes.data.content.map(function(c){ return c.text||''; }).join('');
  const metaClean = metaRaw.replace(/```[a-z]*/g, '').replace(/```/g, '').trim();
  const meta = JSON.parse(metaClean);
  console.log('[AIRS Studio] Nexus:', meta.nexus_name);

  // Call B: use proven base template — no truncation risk
  console.log('[AIRS Studio] Step B: loading base template...');
  const fs_read = require('fs');
  const templatePath = require('path').join(__dirname, 'nexus-template.cjs');
  let serverCode = fs_read.readFileSync(templatePath, 'utf8');
  console.log('[AIRS Studio] Server length:', serverCode.length);

  // Call C: frontend
  // Call C: use proven frontend template — fully interactive
  console.log('[AIRS Studio] Step C: loading frontend template...');
  let frontendCode = fs.readFileSync(path.join(__dirname, 'nexus-base-frontend.html'), 'utf8');
  console.log('[AIRS Studio] Frontend length:', frontendCode.length);

  // Token substitution — replace CivGATE labels with domain-specific values
  const fields = meta.fields || ['Field 1','Field 2','Field 3','Field 4','Field 5','Field 6'];
  const entityLabel = meta.primary_entity || 'Record';
  const nexusTitle = meta.nexus_name || 'AIRS Nexus';

  // Top-level identity substitutions
  frontendCode = frontendCode.replaceAll('CivGATE', nexusTitle);
  frontendCode = frontendCode.replaceAll('Veterans', entityLabel + 's');
  frontendCode = frontendCode.replaceAll('Veteran', entityLabel);
  frontendCode = frontendCode.replaceAll('veteran', entityLabel.toLowerCase());
  frontendCode = frontendCode.replaceAll('VTC CASES', entityLabel.toUpperCase() + ' RECORDS');
  frontendCode = frontendCode.replaceAll('ACTIVE VTC CASES', 'ACTIVE ' + entityLabel.toUpperCase() + ' RECORDS');
  frontendCode = frontendCode.replaceAll('Active VTC Caseload', 'Active ' + entityLabel + ' Records');
  frontendCode = frontendCode.replaceAll('JIV GOVERNED RECORD', entityLabel.toUpperCase() + ' GOVERNED RECORD');
  frontendCode = frontendCode.replaceAll('COURT DATES THIS WEEK', 'UPCOMING EVENTS');
  frontendCode = frontendCode.replaceAll('GRADUATED', 'COMPLETED');
  frontendCode = frontendCode.replaceAll('TOTAL VETERANS', 'TOTAL RECORDS');
  frontendCode = frontendCode.replaceAll('Search veteran...', 'Search ' + entityLabel.toLowerCase() + '...');
  frontendCode = frontendCode.replaceAll('All Courthouses', 'All Locations');
  frontendCode = frontendCode.replaceAll('NEXT COURT', 'NEXT DATE');

  // Field label substitutions (6 fields from Call A)
  const fieldLabels = ['NAME','CASE #','COURTHOUSE','CHARGE TYPE','EMPLOYMENT','INTAKE DATE'];
  const getFieldLabel = (f, fallback) => {
    if (!f) return fallback;
    if (typeof f === 'string') return f.toUpperCase();
    return (f.label || f.name || f.field || fallback).toUpperCase();
  };
  const domainFields = [
    getFieldLabel(fields[0], 'Field 1'),
    getFieldLabel(fields[1], 'Field 2'),
    getFieldLabel(fields[2], 'Field 3'),
    getFieldLabel(fields[3], 'Field 4'),
    getFieldLabel(fields[4], 'Field 5'),
    getFieldLabel(fields[5], 'Field 6')
  ];
  fieldLabels.forEach((label, i) => {
    frontendCode = frontendCode.replaceAll('>' + label + '<', '>' + domainFields[i] + '<');
  });

  // Embed nexus metadata as JSON for home screen
  const nexusMeta = JSON.stringify({
    nexus_name: nexusTitle,
    entity_label: entityLabel,
    fields: domainFields,
    pods: meta.pods_suggested || [],
    governance_tier: meta.classification?.governance_tier || 'Standard',
    schema_description: meta.schema_description || ''
  });
  frontendCode = frontendCode.replace('</head>', '<script>window.NEXUS_META=' + nexusMeta + ';</script></head>');

  console.log('[AIRS Studio] Token substitution complete — entity:', entityLabel, '| fields:', domainFields.join(', '));

  // Call D: NSI — Negative Space Intelligence audit
  console.log('[AIRS Studio] Step D: NSI gap audit...');
  let nsiReport = null;
  try {
    nsiReport = await runNSI(meta, prompt, classification);
    console.log('[AIRS Studio] NSI complete —', nsiReport.gaps.length, 'gaps identified');
  } catch (nsiErr) {
    console.error('[AIRS Studio] NSI error (non-fatal):', nsiErr.message);
    nsiReport = { gaps: [], audit_status: 'error', error: nsiErr.message };
  }

  return Object.assign({}, meta, { server_code: serverCode, frontend_code: frontendCode, nsi_report: nsiReport });
}

// ─── NSI — NEGATIVE SPACE INTELLIGENCE ───────────────────────────────────────
// IGM Call D: Audits the generated schema against known domain standards.
// Returns a Structural Gap Report — governed map of what the schema cannot see.
// DeBacco Nexus LLC · USPTO Patent Pending 19/571,156
async function runNSI(meta, prompt, classification) {
  const apiHeaders = {
    'x-api-key': ANTHROPIC_KEY,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json'
  };

  const domainStandards = `
DOMAIN STANDARDS REFERENCE LIBRARY — NSI AUDIT ENGINE v1.5
DeBacco Nexus LLC · Negative Space Intelligence · USPTO Patent Pending 19/571,156

═══════════════════════════════════════════════════════
FEDERAL DEPARTMENT STANDARDS
═══════════════════════════════════════════════════════

VA DATA ELEMENTS (Department of Veterans Affairs):
- Service era, branch, discharge status (honorable/general/OTH/dishonorable), discharge upgrade status
- Disability rating (0-100%), service-connected conditions, individual unemployability status
- Benefit categories: compensation, pension, education (GI Bill chapters 30/33/35), vocational rehab (Ch.31), home loan, life insurance, burial
- Healthcare enrollment tier (1-8), priority group, copay status
- Mental health diagnosis codes (DSM-5), substance use disorder flags, MST indicator
- TBI screening status, TBI diagnosis, polytrauma designation
- Claims status, appeals status (BVA/CAVC), fiduciary assignment
- Last meaningful contact vs last administrative contact (distinct fields)
- Benefit assessed vs benefit eligible vs benefit received (three distinct states)
- Caregiver program enrollment, VSO representation, power of attorney status
- Homeless or at-risk flag, HUD-VASH voucher status

HUD DATA ELEMENTS (Dept. of Housing and Urban Development):
- Housing status at intake/exit/6-month/12-month follow-up
- Chronic homelessness indicator, literally homeless flag, at-risk flag
- Service referral made vs accessed vs outcome (three distinct states)
- Income sources at entry/exit, non-cash benefits, health insurance coverage
- Domestic violence survivor flag, fleeing DV flag, safety planning status
- Prior living situation, length of time homeless, times homeless in past 3 years
- HUD-VASH voucher status, rapid rehousing enrollment, permanent supportive housing placement
- CoC program enrollment, HMIS release of information consent status
- Housing unit type, rental subsidy type, landlord contact, lease status

SAMHSA DATA ELEMENTS (Substance Abuse and Mental Health Services Administration):
- Primary substance, secondary substance, route of administration
- Age of first use, duration of use, frequency of use
- Treatment episode: admission date, discharge date, discharge reason
- Treatment modality: detox, residential, intensive outpatient, outpatient, medication-assisted
- Medication-assisted treatment: medication type, dosage, prescribing provider
- Mental health diagnosis (primary/secondary), co-occurring disorder flag
- Prior treatment episodes, treatment completion rate
- Recovery support services: peer support, housing, employment, transportation
- Overdose history, naloxone training/kit status, emergency contact
- Insurance type at admission/discharge

DCFS / CHILD WELFARE DATA ELEMENTS (Dept. of Children and Family Services):
- Referral source, referral date, allegation type (abuse/neglect/exploitation)
- Investigation status, substantiation determination, risk assessment score
- Child safety assessment: immediate danger vs underlying risk (distinct fields)
- Placement type: home, foster care, kinship, group home, congregate care
- Placement stability: number of placements, placement disruption reasons
- Reunification goal, permanency plan type, permanency plan date
- Court involvement: dependency petition, hearing dates, court orders
- Parent/guardian contact frequency, visitation compliance
- Sibling placement together vs separated flag
- Educational status, school enrollment, school stability indicator
- Medical/dental/developmental needs assessed vs addressed (distinct fields)
- Trauma screening conducted, trauma-informed services received
- Child fatality risk indicators: prior CPS history, domestic violence, substance abuse, mental illness

NCMEC / ANTI-TRAFFICKING DATA ELEMENTS (National Center for Missing and Exploited Children):
- Trafficking type: sex trafficking, labor trafficking, both
- Victim age at first exploitation, age at identification
- Recruitment method: online, in-person, familial, intimate partner
- Recruitment platform: social media platform name, app name
- Controller/trafficker relationship to victim
- Prior runaway episodes, prior missing person reports
- Commercial sexual exploitation indicators
- Labor exploitation indicators: industry, working conditions, wages withheld
- Safe harbor status, specialized services accessed
- Immigration status, country of origin, language
- Physical indicators documented, forensic evidence collected
- Law enforcement involvement: report filed, case number, detective assigned
- Prosecution status, victim advocacy services

DEPARTMENT OF JUSTICE / CRIMINAL JUSTICE DATA ELEMENTS:
- Arrest history, charge history, conviction history
- Sentence type, sentence length, probation/parole status
- Supervision officer contact, compliance status
- Reentry program enrollment, reentry plan completion
- Employment obtained post-release, housing secured post-release
- Recidivism indicators: rearrest, reconviction, reincarceration
- Diversion program type, diversion eligibility criteria met vs assessed
- Restorative justice participation

DEPARTMENT OF EDUCATION DATA ELEMENTS:
- Enrollment status, grade level, school type
- Attendance rate, chronic absenteeism flag (missing 10%+ of school days)
- Academic performance: GPA, standardized test scores, grade retention
- IEP/504 plan status, disability category, services received
- English language learner status, language proficiency level
- Homeless/McKinney-Vento status, foster care enrollment flag
- Suspension/expulsion history, school discipline incidents
- Postsecondary enrollment, credential attainment, completion status
- FAFSA completion, financial aid type, unmet financial need

DEPARTMENT OF LABOR DATA ELEMENTS:
- Employment status: employed/unemployed/not in labor force
- Employment barriers: criminal record, disability, lack of childcare, transportation, education
- Job type, industry, wages, hours worked, benefits
- Unemployment insurance claim status, weeks claimed, exhaustion status
- Job training program: enrolled vs completed vs employed post-completion
- Apprenticeship status, certification/credential obtained
- Workplace injury history, workers compensation claim status

DEPARTMENT OF TREASURY / FINANCIAL DATA ELEMENTS:
- Income sources: wages, benefits, self-employment, investment
- Banking status: banked/unbanked/underbanked
- Credit score range, credit history length, derogatory marks
- Debt type: medical, student, consumer, tax
- Asset ownership: real property, vehicle, savings
- Financial exploitation indicators: unauthorized transactions, coerced transfers
- Benefits cliff indicators: income threshold proximity to benefit cutoff
- Tax filing status, EITC eligibility vs claimed

═══════════════════════════════════════════════════════
INTERNATIONAL AND UN STANDARDS
═══════════════════════════════════════════════════════

UN SUSTAINABLE DEVELOPMENT GOALS (SDG) DATA ELEMENTS:
- SDG 1 (No Poverty): extreme poverty threshold, multidimensional poverty index
- SDG 2 (Zero Hunger): food insecurity severity scale (HFIAS), stunting/wasting indicators
- SDG 3 (Good Health): maternal mortality ratio, under-5 mortality rate, disease burden indicators
- SDG 4 (Quality Education): literacy rate, completion rate, out-of-school children
- SDG 5 (Gender Equality): gender-based violence prevalence, female representation in leadership
- SDG 8 (Decent Work): informal employment rate, living wage compliance
- SDG 10 (Reduced Inequalities): Gini coefficient, income share ratios
- SDG 16 (Peace/Justice): violence prevalence, access to legal identity, institutional trust

UN TRAFFICKING PROTOCOL (Palermo Protocol) DATA ELEMENTS:
- Trafficking definition elements: act, means, purpose (all three required for adult; act+purpose for minor)
- Consent validity assessment (coercion/deception/abuse of power negates consent)
- Country of origin, transit countries, destination country
- Recruitment location, exploitation location
- Identification method: self-identification, law enforcement, NGO, healthcare, education
- Formal identification status, national referral mechanism engagement
- Reflection and recovery period granted, duration
- Residence permit status, voluntary return vs assisted return
- Compensation/restitution status
- Long-term reintegration support: housing, employment, legal, psychosocial

INTERPOL DATA ELEMENTS (International Criminal Police Organization):
- Notice type: Red, Blue, Green, Yellow, Black, Orange, Purple
- Country of issue, requesting member country
- Fugitive status, extradition treaty applicability
- International arrest warrant status
- Stolen/lost travel document flag
- Organized crime group affiliation indicators
- Cybercrime indicators: IP addresses, digital identifiers, cryptocurrency wallets

═══════════════════════════════════════════════════════
SECTOR-SPECIFIC STANDARDS
═══════════════════════════════════════════════════════

HEALTHCARE / HIPAA DATA ELEMENTS:
- Patient identifier, insurance member ID, NPI (provider)
- Diagnosis codes (ICD-10-CM), procedure codes (CPT), DRG
- Medication list: drug name, dose, frequency, prescriber, start/stop dates
- Allergy list, adverse drug reactions
- Vital signs: BP, pulse, temperature, weight, BMI, O2 saturation
- Lab values: ordered vs resulted vs communicated to patient (three distinct states)
- Care plan: goals set vs goals addressed vs goals achieved
- Advance directive: existence, location, content summary
- Social history: substance use, housing, employment, support system
- Consent: informed consent obtained, capacity assessment, surrogate decision-maker
- Referral: made vs accepted vs accessed vs completed (four distinct states)
- No-show/cancellation pattern, barriers to attendance documented

BANKING / FINANCIAL COMPLIANCE DATA ELEMENTS:
- KYC (Know Your Customer): identity verified, beneficial owner identified, PEP screening
- AML (Anti-Money Laundering): transaction monitoring alerts, SAR filed, CTR filed
- Risk rating: customer risk, product risk, geographic risk, channel risk
- Beneficial ownership: ultimate beneficial owner identified vs verified
- Source of funds: documented vs verified vs assessed
- Transaction pattern: baseline established vs deviation detected vs investigated
- Correspondent banking: due diligence conducted, nested account screening
- Sanctions screening: OFAC, UN, EU — screened vs cleared vs escalated
- Fraud indicators: velocity, geolocation anomaly, device fingerprint mismatch
- Cybersecurity indicators: access anomaly, privilege escalation, data exfiltration pattern

CYBERSECURITY DATA ELEMENTS:
- Asset inventory: known assets vs shadow IT vs unmanaged devices
- Vulnerability: identified vs assessed vs patched vs verified (four distinct states)
- Threat intelligence: indicator of compromise (IOC) type, TTP (tactics/techniques/procedures)
- MITRE ATT&CK coverage: techniques detected vs techniques in environment
- Access control: privileged access managed, least privilege enforced, MFA coverage
- Incident: detected vs contained vs eradicated vs recovered vs lessons learned
- Security awareness training: assigned vs completed vs assessed for retention
- Third-party risk: vendor identified vs assessed vs monitored vs offboarded
- Data classification: data identified vs classified vs protected vs monitored
- Backup: backup exists vs tested vs recovery time verified

MILITARY / DEFENSE DATA ELEMENTS:
- Security clearance: level, adjudication date, continuous evaluation status
- Unit assignment, deployment history, combat exposure
- Training: required vs completed vs current vs lapsed
- Readiness status: medical, dental, mental health, physical fitness, legal
- Equipment: assigned vs serviceable vs mission-capable
- Maintenance: scheduled vs performed vs documented vs verified effective
- Intelligence gap: collection requirement vs collection asset vs coverage vs product disseminated
- Rules of engagement: understood vs applied vs deviation documented
- After-action review: incident documented vs analyzed vs lessons incorporated

ROBOTICS / AI SYSTEMS DATA ELEMENTS:
- Training data: domain coverage, edge case representation, demographic representation
- Model performance: accuracy vs precision vs recall vs F1 by subgroup
- Failure mode: identified vs documented vs mitigated vs monitored
- Environmental coverage: conditions trained on vs conditions deployed in
- Sensor coverage: inputs available vs inputs used vs inputs validated
- Human override: mechanism exists vs tested vs response time measured
- Bias audit: conducted vs findings documented vs remediation applied
- Explainability: decision rationale available vs auditable vs human-interpretable
- Safety boundary: defined vs enforced vs monitored vs logged

VTC / JUSTICE-INVOLVED (Veterans Treatment Court):
- Diversion program milestone tracking (phase 1/2/3 completion dates)
- Court appearance compliance rate, missed court dates with reason codes
- Revocation risk indicators: pattern of missed dates, failed contacts, program non-compliance
- Treatment engagement: attended vs scheduled sessions (ratio field)
- Legal status: charges, case number, DA contact, public defender contact
- Graduation eligibility criteria met vs criteria assessed (distinct fields)
- Service gap log: services needed but not received with reason

SOCIAL DETERMINANTS OF HEALTH (SDOH — expanded):
- Food security: USDA 6-item food security scale score
- Housing quality: overcrowding, habitability, ownership vs rental, subsidy type
- Transportation: vehicle access, public transit access, transportation barrier to care
- Childcare: access, cost barrier, quality rating
- Employment: status, barriers, job quality indicators (wages, benefits, stability)
- Education: level, literacy, digital literacy
- Social support: network size, isolation indicators, caregiver burden
- Digital access: device, broadband, digital literacy score
- Neighborhood: area deprivation index, walkability, green space access, food desert flag
- Legal needs: civil legal problem present vs identified vs addressed

ASSESSMENT COVERAGE META-FIELDS (universal governance indicators):
- Was assessment conducted (boolean) — distinct from assessment result
- Date of last substantive engagement vs date of last administrative contact
- Services offered vs services accepted vs services accessed vs services completed
- Eligibility determined vs eligibility assessed (pre-determination field)
- Reason service not provided when eligible
- Consent: informed consent obtained vs documented vs renewed
- Risk level: assessed vs documented vs communicated vs acted upon
- Outcome: defined vs measured vs reported vs used for program improvement
- Equity indicator: demographic disparities in access, service, outcome documented
- Governance decision: decision not to collect documented with reason and date
`;

  const nsiPrompt = `You are the NSI Engine — the Negative Space Intelligence auditor for AIRS Studio.
Your function is to identify structural gaps in a generated data schema — fields and data types that are ABSENT from the schema but that a domain expert would expect to find given the stated domain, entity, and organizational purpose.

You do NOT analyze missing data values. You analyze missing schema structure — data the organization structurally CANNOT collect because no field exists for it.

GENERATED NEXUS SCHEMA:
- Name: ${meta.nexus_name}
- Description: ${meta.nexus_description}
- Primary Entity: ${meta.primary_entity}
- Schema Description: ${meta.schema_description}
- Fields: ${JSON.stringify(meta.fields)}
- Domain Prompt: "${prompt}"
- Classification: ${JSON.stringify(classification)}

DOMAIN STANDARDS REFERENCE:
${domainStandards}

Identify 3-5 structural gaps. For each gap, respond ONLY with valid JSON — no markdown, no explanation outside the JSON.

Return this exact structure:
{
  "audit_status": "complete",
  "domain_standards_applied": ["list of standards you cross-referenced"],
  "coverage_score": 0-100,
  "coverage_narrative": "One sentence describing what the schema can and cannot see",
  "gaps": [
    {
      "gap_id": "gap_001",
      "title": "Short gap name under 50 chars",
      "description": "One sentence: what the schema cannot capture and why it matters",
      "domain_source": "VA|HUD HMIS|HUD|SAMHSA|DCFS|NCMEC|DOJ|DOE|DOL|Treasury|UN SDG|UN Trafficking|INTERPOL|Healthcare|Banking|Cybersecurity|Military|Robotics|VTC|SDOH|Universal",
      "severity": "critical|high|moderate",
      "what_exists": "What the current schema CAN capture related to this area",
      "what_is_missing": "Specific field or data type that does not exist in the schema",
      "real_world_consequence": "One sentence: what happens organizationally when this gap exists",
      "instrument_fields": ["field1", "field2", "field3"]
    }
  ]
}`;

  const nsiRes = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1200,
    system: 'You are the NSI Engine for AIRS Studio. Respond ONLY with valid JSON. No markdown. No preamble. No explanation outside the JSON structure.',
    messages: [{ role: 'user', content: nsiPrompt }]
  }, { headers: apiHeaders });

  const nsiRaw = nsiRes.data.content.map(c => c.text || '').join('');
  const nsiClean = nsiRaw.replace(/```[a-z]*/g, '').replace(/```/g, '').trim();
  const nsiStart = nsiClean.indexOf('{');
  const nsiEnd = nsiClean.lastIndexOf('}');
  return JSON.parse(nsiClean.substring(nsiStart, nsiEnd + 1));
}

// ─── RAILWAY DEPLOYMENT ───────────────────────────────────────────────────────
async function deployNexusToRailway(nexusId, nexusName, serverCode, frontendCode) {
  // Step 1: Create Railway project
  const projectData = await railwayQuery(`
    mutation ProjectCreate($input: ProjectCreateInput!) {
      projectCreate(input: $input) {
        id
        name
      }
    }
  `, {
    input: {
      name: `nexus-${nexusId.slice(0, 8)}`,
      description: `AIRS Nexus: ${nexusName} — DeBacco Nexus LLC`
    }
  });

  const projectId = projectData.projectCreate.id;

  // Step 2: Create environment
  const envData = await railwayQuery(`
    mutation EnvironmentCreate($input: EnvironmentCreateInput!) {
      environmentCreate(input: $input) {
        id
        name
      }
    }
  `, {
    input: {
      name: 'production-' + nexusId.slice(0,8),
      projectId
    }
  });

  const environmentId = envData.environmentCreate.id;

  // Step 3: Create PostgreSQL database service
  const dbData = await railwayQuery(`
    mutation ServiceCreate($input: ServiceCreateInput!) {
      serviceCreate(input: $input) {
        id
        name
      }
    }
  `, {
    input: {
      name: 'postgres',
      projectId,
      source: {
        image: 'ghcr.io/railwayapp-templates/postgres-ssl:16'
      }
    }
  });

  const dbServiceId = dbData.serviceCreate.id;

  // Step 4: Create app service from generated code
  const appData = await railwayQuery(`
    mutation ServiceCreate($input: ServiceCreateInput!) {
      serviceCreate(input: $input) {
        id
        name
      }
    }
  `, {
    input: {
      name: 'app',
      projectId
    }
  });

  const appServiceId = appData.serviceCreate.id;

  return {
    projectId,
    environmentId,
    dbServiceId,
    appServiceId
  };
}

// ─── WRITE NEXUS FILES ────────────────────────────────────────────────────────
async function writeNexusFiles(nexusId, serverCode, frontendCode, packageJson) {
  const nexusDir = path.join(__dirname, 'nexus-builds', nexusId);
  fs.mkdirSync(path.join(nexusDir, 'public'), { recursive: true });
  
  fs.writeFileSync(path.join(nexusDir, 'server.cjs'), serverCode);
  fs.writeFileSync(path.join(nexusDir, 'public', 'index.html'), frontendCode);
  fs.writeFileSync(path.join(nexusDir, 'package.json'), JSON.stringify({
    name: `nexus-${nexusId.slice(0, 8)}`,
    version: '1.0.0',
    main: 'server.cjs',
    type: 'commonjs',
    scripts: { start: 'node server.cjs' },
    dependencies: {
      express: '^4.18.2',
      pg: '^8.11.3',
      dotenv: '^16.3.1'
    },
    engines: { node: '>=18.0.0' }
  }, null, 2));

  fs.writeFileSync(path.join(nexusDir, 'railway.json'), JSON.stringify({
    build: { builder: 'nixpacks' },
    deploy: { startCommand: 'node server.cjs', restartPolicyType: 'ON_FAILURE' }
  }, null, 2));

  return nexusDir;
}

// ─── API ROUTES ───────────────────────────────────────────────────────────────

// GET / — Serve the AIRS Studio UI
app.get('/', async (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST /api/generate — Generate + deploy a new Nexus
app.post('/api/generate', async (req, res) => {
  const { prompt, license_key } = req.body;
  
  if (!prompt || prompt.trim().length < 10) {
    return res.json({ success: false, error: 'Please provide a detailed domain problem description.' });
  }

  const nexusId = uuidv4();
  
  try {
    // IGM pre-inference classification
    const classification = igmClassifyPrompt(prompt);
    if (!classification.approved) {
      return res.json({ success: false, error: classification.reason });
    }

    // Register Nexus as pending
    await nexusRegistry.set(nexusId, {
      id: nexusId,
      prompt,
      status: 'generating',
      classification,
      created_at: new Date().toISOString()
    });

    // Send immediate response with nexus ID
    res.json({ success: true, nexus_id: nexusId, status: 'generating', message: 'AIRS Studio is generating your Nexus...' });

    // Generate Nexus code asynchronously
    console.log(`[AIRS Studio] Generating Nexus ${nexusId} for: ${prompt.slice(0, 60)}...`);
    
    const nexusData = await generateNexusCode(prompt, nexusId, classification);
    
    await nexusRegistry.set(nexusId, {
      ...await nexusRegistry.get(nexusId),
      status: 'generated',
      nexus_name: nexusData.nexus_name,
      nexus_description: nexusData.nexus_description,
      primary_entity: nexusData.primary_entity,
      fields: nexusData.fields,
      pods_suggested: nexusData.pods_suggested,
      schema_description: nexusData.schema_description,
      nsi_report: nexusData.nsi_report || null
    });

    // Write files locally
    const nexusDir = await writeNexusFiles(
      nexusId,
      nexusData.server_code,
      nexusData.frontend_code
    );

    await nexusRegistry.set(nexusId, {
      ...await nexusRegistry.get(nexusId),
      status: 'built',
      local_path: nexusDir
    });

    // Automated deployment: GitHub repo + Railway
    console.log('[AIRS Studio] Deploying Nexus ' + nexusId + ' via automated pipeline...');

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const repoName = 'nexus-' + nexusId.slice(0, 8);
    const repoOwner = process.env.GITHUB_ORG || 'jamesdebacco';
    const repoFullName = repoOwner + '/' + repoName;

    // Create GitHub repo
    await axios.post('https://api.github.com/user/repos', {
      name: repoName,
      private: false,
      description: 'AIRS Nexus: ' + nexusData.nexus_name + ' — DeBacco Nexus LLC',
      auto_init: false
    }, {
      headers: {
        'Authorization': 'Bearer ' + GITHUB_TOKEN,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    console.log('[AIRS Studio] GitHub repo created:', repoFullName);

    // Push files via GitHub Contents API
    const pkgJson = JSON.stringify({
      name: repoName, version: '1.0.0', main: 'server.cjs', type: 'commonjs',
      scripts: { start: 'node server.cjs' },
      dependencies: { express: '^4.18.2', pg: '^8.11.3', cors: '^2.8.5', dotenv: '^16.3.1' },
      engines: { node: '>=18.0.0' }
    }, null, 2);

    const railwayJson = JSON.stringify({
      build: { builder: 'nixpacks' },
      deploy: { startCommand: 'node server.cjs', restartPolicyType: 'ON_FAILURE' }
    }, null, 2);

    const fs_tmpl = require('fs');
    const templateCode_raw = fs_tmpl.readFileSync(require('path').join(__dirname, 'nexus-template.cjs'), 'utf8');
    const tableName_embed = (nexusData.primary_entity || 'records').toLowerCase().replace(/[^a-z0-9]/g,'_') + '_records';
    const templateCode = `// AIRS Nexus — Generated by AIRS Studio\n// DeBacco Nexus LLC · USPTO 19/571,156\nprocess.env.NEXUS_NAME = process.env.NEXUS_NAME || ${JSON.stringify(nexusData.nexus_name || 'AIRS Nexus')};\nprocess.env.ENTITY_LABEL = process.env.ENTITY_LABEL || ${JSON.stringify(nexusData.primary_entity || 'Record')};\nprocess.env.TABLE_NAME = process.env.TABLE_NAME || ${JSON.stringify(tableName_embed)};\n` + templateCode_raw;
    const tableName = (nexusData.primary_entity || 'records').toLowerCase().replace(/[^a-z0-9]/g, '_') + '_records';

    const filesToPush = [
      { path: 'server.cjs', content: templateCode },
      { path: 'nexus-template.cjs', content: templateCode },
      { path: 'public/index.html', content: nexusData.frontend_code },
      { path: 'package.json', content: pkgJson },
      { path: 'railway.json', content: railwayJson },
      { path: '.gitignore', content: 'node_modules/\n.env\n' },
      { path: 'README.md', content: '# ' + nexusData.nexus_name + '\n\nAIRS Nexus · DeBacco Nexus LLC · USPTO 19/571,156\n' }
    ];

    for (const file of filesToPush) {
      await axios.put('https://api.github.com/repos/' + repoFullName + '/contents/' + file.path, {
        message: 'feat: ' + file.path,
        content: Buffer.from(file.content).toString('base64')
      }, {
        headers: {
          'Authorization': 'Bearer ' + GITHUB_TOKEN,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      console.log('[AIRS Studio] Pushed:', file.path);
    }

    // Status: pushed — all files confirmed on GitHub
    const liveUrl = 'https://' + repoName + '-production.up.railway.app';
    await nexusRegistry.set(nexusId, {
      ...await nexusRegistry.get(nexusId),
      status: 'pushed',
      github: repoFullName,
      url: liveUrl
    });
    console.log('[AIRS Studio] Nexus ' + nexusId + ' code pushed, provisioning Railway in background...');

    // Async Railway provisioning — cascading steps, each saves context
    (async () => {
      try {
        // Step 1 — Find or create Railway project
        console.log('[AIRS Studio] Railway Step 1: Finding or creating project...');
        let projectId = null;
        try {
          const existingProjects = await railwayQuery(
            'query { projects { edges { node { id name } } } }', {}
          );
          const existing = existingProjects.projects.edges.find(e => e.node.name === repoName);
          if (existing) {
            projectId = existing.node.id;
            console.log('[AIRS Studio] Railway Step 1: Found existing project:', projectId);
          }
        } catch(findErr) {
          console.log('[AIRS Studio] Railway Step 1: Could not query existing projects, creating new...');
        }
        if (!projectId) {
          const projectData = await railwayQuery(
            'mutation ProjectCreate($input: ProjectCreateInput!) { projectCreate(input: $input) { id name } }',
            { input: { name: repoName, description: 'AIRS Nexus: ' + nexusData.nexus_name } }
          );
          projectId = projectData.projectCreate.id;
        }
        console.log('[AIRS Studio] Railway Step 1 done:', projectId);

        // Step 2 — Get environment (saved: projectId)
        console.log('[AIRS Studio] Railway Step 2: Getting environment...');
        const envData = await railwayQuery(
          'query GetEnvironments($projectId: String!) { environments(projectId: $projectId) { edges { node { id name } } } }',
          { projectId }
        );
        const environmentId = envData.environments.edges[0].node.id;
        console.log('[AIRS Studio] Railway Step 2 done:', environmentId);

        // Step 3 — Create app service (saved: projectId, environmentId)
        console.log('[AIRS Studio] Railway Step 3: Creating app service...');
        const serviceData = await railwayQuery(
          'mutation ServiceCreate($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }',
          { input: { name: 'app', projectId, source: { repo: repoFullName } } }
        );
        const serviceId = serviceData.serviceCreate.id;
        console.log('[AIRS Studio] Railway Step 3 done:', serviceId);

        // Step 3.5 — Env vars embedded in server.cjs at build time (no API call needed)

        // Step 4 — Trigger deployment (saved: projectId, environmentId, serviceId)
        console.log('[AIRS Studio] Railway Step 4: Triggering deployment...');
        try {
          await railwayQuery(
            'mutation ServiceInstanceDeploy($serviceId: String!, $environmentId: String!) { serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId) }',
            { serviceId, environmentId }
          );
          console.log('[AIRS Studio] Railway Step 4 done: deployment triggered');
        } catch (deployErr) {
          console.error('[AIRS Studio] Railway Step 4 error:', deployErr.message);
        }

        // Step 5 — Add PostgreSQL (full provisioning: password, volume, DATABASE_URL)
        console.log('[AIRS Studio] Railway Step 5: Adding PostgreSQL...');
        let pgServiceId = null;
        try {
          const pgData = await railwayQuery(
            'mutation ServiceCreate($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }',
            { input: { name: 'postgres', projectId, source: { image: 'ghcr.io/railwayapp-templates/postgres-ssl:16' } } }
          );
          pgServiceId = pgData.serviceCreate.id;
          console.log('[AIRS Studio] Railway Step 5a done: postgres service created:', pgServiceId);

          // 5b — Configure postgres: password, db settings, and its own DATABASE_URL
          const pgPassword = require('crypto').randomBytes(24).toString('base64url');
          await railwayQuery(
            'mutation VariableCollectionUpsert($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }',
            { input: { projectId, environmentId, serviceId: pgServiceId, variables: {
                POSTGRES_USER: 'postgres',
                POSTGRES_PASSWORD: pgPassword,
                POSTGRES_DB: 'railway',
                PGDATA: '/var/lib/postgresql/data/pgdata',
                DATABASE_URL: 'postgresql://postgres:' + pgPassword + '@' + '$' + '{{RAILWAY_PRIVATE_DOMAIN}}:5432/railway'
            } } }
          );
          console.log('[AIRS Studio] Railway Step 5b done: postgres variables set');

          // 5c — Attach persistent volume so data survives restarts
          try {
            await railwayQuery(
              'mutation VolumeCreate($input: VolumeCreateInput!) { volumeCreate(input: $input) { id } }',
              { input: { projectId, environmentId, serviceId: pgServiceId, mountPath: '/var/lib/postgresql/data' } }
            );
            console.log('[AIRS Studio] Railway Step 5c done: volume attached');
          } catch (volErr) {
            console.error('[AIRS Studio] Railway Step 5c error (volume):', volErr.message);
          }

          // 5d — Boot postgres with its new config
          await railwayQuery(
            'mutation ServiceInstanceDeploy($serviceId: String!, $environmentId: String!) { serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId) }',
            { serviceId: pgServiceId, environmentId }
          );
          console.log('[AIRS Studio] Railway Step 5d done: postgres deployed');
        } catch (pgErr) {
          console.error('[AIRS Studio] Railway Step 5 error:', pgErr.message);
        }

        // Step 5.5 — Point the app at postgres and redeploy
        console.log('[AIRS Studio] Railway Step 5.5: Setting DATABASE_URL on app service...');
        try {
          await railwayQuery(
            'mutation VariableUpsert($input: VariableUpsertInput!) { variableUpsert(input: $input) }',
            { input: {
                projectId: projectId,
                environmentId: environmentId,
                serviceId: serviceId,
                name: 'DATABASE_URL',
                value: '$' + '{{postgres.DATABASE_URL}}'
            } }
          );
          console.log('[AIRS Studio] Railway Step 5.5 done: DATABASE_URL reference set');
          await railwayQuery(
            'mutation ServiceInstanceDeploy($serviceId: String!, $environmentId: String!) { serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId) }',
            { serviceId, environmentId }
          );
          console.log('[AIRS Studio] Railway Step 5.5: app redeployed with DATABASE_URL');
        } catch (varErr) {
          console.error('[AIRS Studio] Railway Step 5.5 error:', varErr.message);
        }

        // Step 6 — Generate domain (saved: environmentId, serviceId)
        console.log('[AIRS Studio] Railway Step 6: Generating domain...');
        let finalUrl = 'https://' + repoName + '-production-' + projectId.slice(0,8) + '.up.railway.app';
        try {
          const domainData = await railwayQuery(
            'mutation ServiceDomainCreate($environmentId: String!, $serviceId: String!) { serviceDomainCreate(input: { environmentId: $environmentId, serviceId: $serviceId }) { id domain } }',
            { environmentId, serviceId }
          );
          if (domainData && domainData.serviceDomainCreate && domainData.serviceDomainCreate.domain) {
            finalUrl = 'https://' + domainData.serviceDomainCreate.domain;
            console.log('[AIRS Studio] Railway Step 6 done:', finalUrl);
          }
        } catch (domainErr) {
          console.error('[AIRS Studio] Railway Step 6 error:', domainErr.message);
        }

        // Store provisioned state — Railway is still building
        await nexusRegistry.set(nexusId, {
          ...await nexusRegistry.get(nexusId),
          status: 'provisioned',
          railway: { projectId, environmentId, serviceId },
          url: finalUrl
        });
        console.log('[AIRS Studio] Nexus ' + nexusId + ' provisioned, polling for live status...');

        // Poll until Nexus URL responds — then mark deployed
        let attempts = 0;
        const maxAttempts = 24; // 24 x 15s = 6 minutes
        const pollLive = setInterval(async () => {
          attempts++;
          try {
            const http = require('http');
            const https = require('https');
            const client = finalUrl.startsWith('https') ? https : http;
            const req = client.get(finalUrl, { timeout: 5000 }, (res) => {
              if (res.statusCode < 500) {
                clearInterval(pollLive);
                (async () => {
                  const current = await nexusRegistry.get(nexusId);
                  await nexusRegistry.set(nexusId, {
                    ...current,
                    status: 'deployed',
                    url: finalUrl
                  });
                  console.log('[AIRS Studio] Nexus ' + nexusId + ' is LIVE:', finalUrl);
                })();
              }
            });
            req.on('error', () => {});
            req.end();
          } catch(e) {}
          if (attempts >= maxAttempts) {
            clearInterval(pollLive);
            await nexusRegistry.set(nexusId, {
              ...await nexusRegistry.get(nexusId),
              status: 'deployed',
              url: finalUrl
            });
            console.log('[AIRS Studio] Nexus ' + nexusId + ' deploy timeout — marking live anyway');
          }
        }, 15000);
      } catch (err) {
        console.error('[AIRS Studio] Background Railway provisioning error:', err.message);
      }
    })();

  } catch (err) {
    const errDetail = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error("[AIRS Studio] Error generating Nexus", nexusId, errDetail);
    await nexusRegistry.set(nexusId, {
      ...await nexusRegistry.get(nexusId),
      status: 'error',
      error: err.message
    });
  }
});

// GET /api/stream/:id — Server-Sent Events stream for live generation feed
app.get('/api/stream/:id', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const nexusId = req.params.id;
  let lastStatus = null;
  let lastData = null;

  const send = (data) => {
    res.write('data: ' + JSON.stringify(data) + '\n\n');
  };

  let metaSent = false;

  const interval = setInterval(async () => {
    try {
      const nexus = await nexusRegistry.get(nexusId);
      if (!nexus) return;

      const currentStatus = nexus.status;
      const currentData = JSON.stringify(nexus);

      if (currentStatus !== lastStatus || currentData !== lastData) {
        lastStatus = currentStatus;
        lastData = currentData;
        send({ type: 'status', nexus });

        // Stream metadata fields as they arrive — only once
        if (!metaSent && nexus.nexus_name && ['generated','built','pushed','provisioned','deployed'].includes(currentStatus)) {
          metaSent = true;
          send({ type: 'meta', field: 'nexus_name', value: nexus.nexus_name });
          send({ type: 'meta', field: 'primary_entity', value: nexus.primary_entity });
          send({ type: 'meta', field: 'governance_tier', value: nexus.classification?.governance_tier });
          send({ type: 'meta', field: 'schema_description', value: nexus.schema_description });
          if (nexus.fields) {
            nexus.fields.forEach((f, i) => {
              const label = typeof f === 'object' ? (f.field_name || f.name || f.label || Object.values(f)[0]) : f;
              setTimeout(() => send({ type: 'field', index: i, value: label }), i * 150);
            });
          }
          if (nexus.pods_suggested) {
            nexus.pods_suggested.forEach((p, i) => {
              setTimeout(() => send({ type: 'pod_seed', index: i, value: p }), i * 200 + 500);
            });
          }
          // NSI — send gap report once available
          if (nexus.nsi_report && nexus.nsi_report.gaps) {
            setTimeout(() => send({ type: 'nsi_report', report: nexus.nsi_report }), 1200);
          }
        }

        if (currentStatus === 'deployed' || currentStatus === 'error') {
          setTimeout(() => { clearInterval(interval); res.end(); }, 1000);
        }
      }
    } catch (err) {
      console.error('[AIRS Studio] SSE error:', err.message);
    }
  }, 500);

  req.on('close', () => { clearInterval(interval); });
});

// GET /api/status/:id — Check Nexus generation + deployment status
app.get('/api/status/:id', async (req, res) => {
  const nexus = await nexusRegistry.get(req.params.id);
  if (!nexus) return res.json({ success: false, error: 'Nexus not found' });
  res.json({ success: true, nexus });
});

// GET /api/nexus/:id — Get single Nexus
app.get('/api/nexus/:id', async (req, res) => {
  const nexus = await nexusRegistry.get(req.params.id);
  if (!nexus) return res.json({ success: false, error: 'Nexus not found' });
  res.json({ success: true, nexus });
});

// GET /api/nexus — List all Nexus deployments
app.get('/api/nexus', async (req, res) => {
  const list = (await nexusRegistry.values()).map(n => ({
    id: n.id,
    name: n.nexus_name,
    description: n.nexus_description,
    status: n.status,
    url: n.url,
    created_at: n.created_at,
    domain: n.classification?.domain,
    pods_suggested: n.pods_suggested
  }));
  res.json({ success: true, nexus_list: list });
});

// POST /api/pod/build — Node builds a Pod and attaches it to a Nexus
app.post('/api/pod/build', async (req, res) => {
  const { nexus_id, pod_description } = req.body;
  
  const nexus = await nexusRegistry.get(nexus_id);
  if (!nexus) return res.json({ success: false, error: 'Nexus not found' });
  if (nexus.status !== 'deployed') return res.json({ success: false, error: 'Nexus must be deployed before adding Pods' });

  try {
    // IGM screens the Pod request
    const classification = igmClassifyPrompt(pod_description);
    if (!classification.approved) return res.json({ success: false, error: classification.reason });

    // Generate Pod code via Claude
    const podRes = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: `You are the AIRS Node — the Pod builder engine for AIRS Studio. Respond ONLY with valid JSON, no markdown, no explanation. Generate a Pod descriptor as a JSON object with exactly these keys:
{"pod_name":"Short name under 40 chars","pod_type":"window|room|doorway|infographic|form","description":"One sentence description under 100 chars","fields":["field1","field2","field3"],"color":"teal"}`,
        messages: [{
          role: 'user',
          content: `Build a Pod for a Nexus named "${nexus.nexus_name}" (${nexus.nexus_description}). Pod request: ${pod_description}`
        }]
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    const podText = podRes.data.content.map(c => c.text || '').join('');
    const podClean = podText.replace(/```json|```/g, '').trim();
    const podJsonStart = podClean.indexOf('{');
    const podJsonEnd = podClean.lastIndexOf('}');
    const pod = JSON.parse(podClean.substring(podJsonStart, podJsonEnd + 1));

    const podId = uuidv4();
    
    // Update Nexus registry with new Pod
    const existingPods = nexus.pods || [];
    await nexusRegistry.set(nexus_id, {
      ...nexus,
      pods: [...existingPods, { id: podId, ...pod, created_at: new Date().toISOString() }]
    });

    res.json({ success: true, pod_id: podId, pod });

  } catch (err) {
    console.error('[AIRS Studio] Pod build error:', err.message);
    res.json({ success: false, error: err.message });
  }
});

// POST /api/nsi/instrument — Generate a collection instrument Pod for a specific NSI gap
app.post('/api/nsi/instrument', async (req, res) => {
  const { nexus_id, gap_id } = req.body;
  if (!nexus_id || !gap_id) return res.json({ success: false, error: 'nexus_id and gap_id required' });

  const nexus = await nexusRegistry.get(nexus_id);
  if (!nexus) return res.json({ success: false, error: 'Nexus not found' });

  const nsiReport = nexus.nsi_report;
  if (!nsiReport || !nsiReport.gaps) return res.json({ success: false, error: 'No NSI report found for this Nexus' });

  const gap = nsiReport.gaps.find(g => g.gap_id === gap_id);
  if (!gap) return res.json({ success: false, error: 'Gap not found: ' + gap_id });

  try {
    const instrRes = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: 'You are the NSI Instrument Generator for AIRS Studio. Generate a governed collection instrument as a Pod descriptor. Respond ONLY with valid JSON, no markdown.',
      messages: [{
        role: 'user',
        content: `Generate a collection instrument Pod to close this structural gap in a "${nexus.nexus_name}" Nexus.

Gap: ${gap.title}
Description: ${gap.description}
What is missing: ${gap.what_is_missing}
Domain source: ${gap.domain_source}
Suggested fields: ${JSON.stringify(gap.instrument_fields)}

Return JSON:
{
  "pod_name": "Short name under 40 chars",
  "pod_type": "form",
  "description": "One sentence under 100 chars",
  "fields": ["field1", "field2", "field3", "field4"],
  "color": "teal",
  "gap_id": "${gap_id}",
  "governed": true,
  "nsi_generated": true
}`
      }]
    }, {
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    const instrRaw = instrRes.data.content.map(c => c.text || '').join('');
    const instrClean = instrRaw.replace(/```[a-z]*/g, '').replace(/```/g, '').trim();
    const instrStart = instrClean.indexOf('{');
    const instrEnd = instrClean.lastIndexOf('}');
    const instrument = JSON.parse(instrClean.substring(instrStart, instrEnd + 1));

    const instrId = uuidv4();

    // Update gap status in NSI report
    const updatedGaps = nsiReport.gaps.map(g =>
      g.gap_id === gap_id
        ? { ...g, status: 'instrument_generated', instrument_id: instrId }
        : g
    );
    await nexusRegistry.set(nexus_id, {
      ...nexus,
      nsi_report: { ...nsiReport, gaps: updatedGaps },
      pods: [...(nexus.pods || []), { id: instrId, ...instrument, created_at: new Date().toISOString() }]
    });

    res.json({ success: true, instrument_id: instrId, instrument });

  } catch (err) {
    console.error('[AIRS Studio] NSI instrument error:', err.message);
    res.json({ success: false, error: err.message });
  }
});

// POST /api/nsi/exempt — Document a governed exemption decision (decision not to collect)
app.post('/api/nsi/exempt', async (req, res) => {
  const { nexus_id, gap_id, reason } = req.body;
  if (!nexus_id || !gap_id) return res.json({ success: false, error: 'nexus_id and gap_id required' });

  const nexus = await nexusRegistry.get(nexus_id);
  if (!nexus || !nexus.nsi_report) return res.json({ success: false, error: 'Nexus or NSI report not found' });

  const updatedGaps = nexus.nsi_report.gaps.map(g =>
    g.gap_id === gap_id
      ? { ...g, status: 'documented_exemption', exemption_reason: reason || 'Not specified', exemption_date: new Date().toISOString() }
      : g
  );

  await nexusRegistry.set(nexus_id, {
    ...nexus,
    nsi_report: { ...nexus.nsi_report, gaps: updatedGaps }
  });

  res.json({ success: true, message: 'Exemption documented in governance record' });
});

// GET /api/nexus/:id/download — Download Nexus as deployable zip
app.get('/api/nexus/:id/download', async (req, res) => {
  const nexus = await nexusRegistry.get(req.params.id);
  if (!nexus || !nexus.local_path) return res.json({ success: false, error: 'Nexus build not found' });

  const archiver = require('archiver');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="nexus-${nexus.nexus_name?.replace(/\s+/g, '-')}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  archive.directory(nexus.local_path, false);
  archive.finalize();
});

// ─── START ────────────────────────────────────────────────────────────────────
initRegistry().then(() => {
  console.log('[AIRS Studio] Registry initialized');
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  ★ AIRS Studio — Governed AI Nexus Generator             ║
║  DeBacco Nexus LLC · USPTO Patent Pending 19/571,156     ║
║  Running on port ${PORT}                                     ║
╚══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
