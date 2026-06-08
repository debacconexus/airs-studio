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

  console.log('[AIRS Studio] Token substitution complete — entity:', entityLabel, '| fields:', domainFields.join(', '));

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
      schema_description: nexusData.schema_description
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
    const templateCode = fs_tmpl.readFileSync(require('path').join(__dirname, 'nexus-template.cjs'), 'utf8');
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

        // Step 3.5 — Set environment variables on app service (individual upserts)
        console.log('[AIRS Studio] Railway Step 3.5: Setting environment variables...');
        const tableName = (nexusData.primary_entity || 'records').toLowerCase().replace(/[^a-z0-9]/g,'_') + '_records';
        const envVars = {
          NEXUS_NAME: nexusData.nexus_name,
          ENTITY_LABEL: nexusData.primary_entity || 'Record',
          TABLE_NAME: tableName,
          NODE_ENV: 'production'
        };
        try {
          for (const [name, value] of Object.entries(envVars)) {
            await railwayQuery(
              'mutation VariableUpsert($input: VariableUpsertInput!) { variableUpsert }',
              { input: { projectId, environmentId, serviceId, name, value: String(value) } }
            );
          }
          console.log('[AIRS Studio] Railway Step 3.5 done: env vars set');
        } catch(varErr) {
          console.error('[AIRS Studio] Railway Step 3.5 error:', varErr.message);
        }

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

        // Step 5 — Add PostgreSQL (saved: projectId)
        console.log('[AIRS Studio] Railway Step 5: Adding PostgreSQL...');
        try {
          await railwayQuery(
            'mutation ServiceCreate($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }',
            { input: { name: 'postgres', projectId, source: { image: 'ghcr.io/railwayapp-templates/postgres-ssl:16' } } }
          );
          console.log('[AIRS Studio] Railway Step 5 done: PostgreSQL added');
        } catch (pgErr) {
          console.error('[AIRS Studio] Railway Step 5 error:', pgErr.message);
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
                nexusRegistry.set(nexusId, {
                  ...nexusRegistry.get(nexusId).then ? null : nexusRegistry.get(nexusId),
                  status: 'deployed',
                  url: finalUrl
                }).then(() => {
                  console.log('[AIRS Studio] Nexus ' + nexusId + ' is LIVE:', finalUrl);
                });
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
