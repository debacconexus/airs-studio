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
app.use(express.static(path.join(__dirname, 'public')));

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const RAILWAY_TOKEN = process.env.RAILWAY_API_TOKEN;
const RAILWAY_TEAM_ID = process.env.RAILWAY_TEAM_ID || null; // null for personal workspace
const PORT = process.env.PORT || 8080;

// In-memory Nexus registry (replace with PostgreSQL in production)
const nexusRegistry = new Map();

// ─── RAILWAY GRAPHQL CLIENT ───────────────────────────────────────────────────
async function railwayQuery(query, variables = {}) {
  const res = await axios.post(
    'https://backboard.railway.app/graphql/v2',
    { query, variables },
    {
      headers: {
        'Authorization': `Bearer ${RAILWAY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  if (res.data.errors) throw new Error(res.data.errors[0].message);
  return res.data.data;
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

  // Call B: server code
  console.log('[AIRS Studio] Step B: server...');
  const serverRes = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 5000,
    system: 'Generate complete Node.js/Express server.cjs for a "' + meta.nexus_name + '" system. Output ONLY raw JavaScript, no markdown. CommonJS, pg with DATABASE_URL, PORT env, serve static from public/, CRUD API, POST /api/contacts, GET /api/stats, [IGM-GOVERNED] tags on notes. Comments in ' + langHint + '.',
    messages: [{ role: 'user', content: 'Build server.cjs for: ' + prompt }]
  }, { headers: apiHeaders });
  const serverCode = serverRes.data.content.map(function(c){ return c.text||''; }).join('').replace(/```[a-z]*/g, '').replace(/```/g, '').trim();
  console.log('[AIRS Studio] Server length:', serverCode.length);

  // Call C: frontend
  console.log('[AIRS Studio] Step C: frontend...');
  const frontendRes = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 5000,
    system: 'Generate complete single-page HTML app for "' + meta.nexus_name + '". Output ONLY raw HTML, no markdown. Navy #07192f, teal #33e0c4, gold #ffca58, Inter font, IGM status bar in header, dashboard, intake form, contact log, search. Footer: AIRS Studio · DeBacco Nexus LLC · USPTO 19/571,156. ALL UI text, labels, buttons, placeholders, and headings must be in ' + langHint + '.',
    messages: [{ role: 'user', content: 'Build index.html for: ' + prompt + '. Fields: ' + meta.fields.join(', ') }]
  }, { headers: apiHeaders });
  const frontendCode = frontendRes.data.content.map(function(c){ return c.text||''; }).join('').replace(/```[a-z]*/g, '').replace(/```/g, '').trim();
  console.log('[AIRS Studio] Frontend length:', frontendCode.length);

  return Object.assign({}, meta, { server_code: serverCode, frontend_code: frontendCode });
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
app.get('/', (req, res) => {
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
    nexusRegistry.set(nexusId, {
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
    
    nexusRegistry.set(nexusId, {
      ...nexusRegistry.get(nexusId),
      status: 'generated',
      nexus_name: nexusData.nexus_name,
      nexus_description: nexusData.nexus_description,
      primary_entity: nexusData.primary_entity,
      fields: nexusData.fields,
      pods_suggested: nexusData.pods_suggested,
      schema_description: nexusData.schema_description
    });

    // Write files locally
    const nexusDir = await writeNexusFiles(
      nexusId,
      nexusData.server_code,
      nexusData.frontend_code
    );

    nexusRegistry.set(nexusId, {
      ...nexusRegistry.get(nexusId),
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

    const filesToPush = [
      { path: 'server.cjs', content: nexusData.server_code },
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

    // Create Railway project
    const projectData = await railwayQuery(
      'mutation ProjectCreate($input: ProjectCreateInput!) { projectCreate(input: $input) { id name } }',
      { input: { name: repoName, description: 'AIRS Nexus: ' + nexusData.nexus_name } }
    );
    const projectId = projectData.projectCreate.id;

    // Get existing production environment (Railway auto-creates one on project creation)
    const envData = await railwayQuery(
      'query GetEnvironments($projectId: String!) { environments(projectId: $projectId) { edges { node { id name } } } }',
      { projectId }
    );
    const environmentId = envData.environments.edges[0].node.id;

    // Create service connected to GitHub repo
    const serviceData = await railwayQuery(
      'mutation ServiceCreate($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }',
      { input: { name: 'app', projectId, source: { repo: repoFullName } } }
    );
    const serviceId = serviceData.serviceCreate.id;

    // Add PostgreSQL
    await railwayQuery(
      'mutation ServiceCreate($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }',
      { input: { name: 'postgres', projectId, source: { image: 'ghcr.io/railwayapp-templates/postgres-ssl:16' } } }
    );

    const liveUrl = 'https://' + repoName + '-production-' + projectId.slice(0,8) + '.up.railway.app';

    nexusRegistry.set(nexusId, {
      ...nexusRegistry.get(nexusId),
      status: 'deployed',
      railway: { projectId, environmentId, serviceId },
      github: repoFullName,
      url: liveUrl
    });

    console.log('[AIRS Studio] Nexus ' + nexusId + ' deployed successfully:', liveUrl);

  } catch (err) {
    const errDetail = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error("[AIRS Studio] Error generating Nexus", nexusId, errDetail);
    nexusRegistry.set(nexusId, {
      ...nexusRegistry.get(nexusId),
      status: 'error',
      error: err.message
    });
  }
});

// GET /api/status/:id — Check Nexus generation + deployment status
app.get('/api/status/:id', (req, res) => {
  const nexus = nexusRegistry.get(req.params.id);
  if (!nexus) return res.json({ success: false, error: 'Nexus not found' });
  res.json({ success: true, nexus });
});

// GET /api/nexus — List all Nexus deployments
app.get('/api/nexus', (req, res) => {
  const list = Array.from(nexusRegistry.values()).map(n => ({
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
  
  const nexus = nexusRegistry.get(nexus_id);
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
        max_tokens: 4000,
        system: `You are the AIRS Node — the Pod builder engine for AIRS Studio.
You generate custom attachments (Pods) that extend a live Nexus deployment.
A Pod is a self-contained module that attaches to the Nexus: a dashboard window, 
a reporting room, an alert doorway, a custom infographic, a data entry form, etc.

Generate a Pod as a JSON object with:
{
  "pod_name": "Short name",
  "pod_type": "window|room|doorway|infographic|form",
  "html_component": "Complete HTML/CSS/JS component that can be injected into the Nexus",
  "api_endpoint": "Express route code to add to the Nexus server",
  "description": "What this Pod does"
}

The Pod must match the AIRS brand: navy background, teal #33e0c4, gold #ffca58.
Every Pod must be governed by the IGM — any AI interactions tagged [IGM-GOVERNED].`,
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
    nexusRegistry.set(nexus_id, {
      ...nexus,
      pods: [...existingPods, { id: podId, ...pod, created_at: new Date().toISOString() }]
    });

    res.json({ success: true, pod_id: podId, pod });

  } catch (err) {
    console.error('[AIRS Studio] Pod build error:', err.message);
    res.json({ success: false, error: err.message });
  }
});

// GET /api/nexus/:id/download — Download Nexus as deployable zip
app.get('/api/nexus/:id/download', (req, res) => {
  const nexus = nexusRegistry.get(req.params.id);
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
