#!/usr/bin/env python3
# AIRS Studio - Step 5 overhaul: fully provision PostgreSQL
import sys
src = open('server.cjs', encoding='utf-8').read()
if 'Step 5b' in src:
    print('[SKIP] postgres provisioning fix already applied.'); sys.exit(0)
try:
    start = src.index('        // Step 5 — Add PostgreSQL')
    end = src.index('        // Step 6 — Generate domain')
except ValueError:
    print('[FAIL] Step 5 / Step 6 markers not found - aborting, nothing changed.'); sys.exit(1)
NEW = '''        // Step 5 — Add PostgreSQL (full provisioning: password, volume, DATABASE_URL)
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

'''
src = src[:start] + NEW + src[end:]
open('server.cjs', 'w', encoding='utf-8').write(src)
print('[OK] Step 5 rebuilt with full postgres provisioning')
