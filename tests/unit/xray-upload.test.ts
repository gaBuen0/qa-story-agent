/**
 * Envio ao Xray Cloud contra um servidor local que imita a API real
 * (POST /api/v2/authenticate e POST /api/v2/import/execution).
 * Assim o fluxo de autenticação, token e importação é testado sem uma instância do Jira.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { promisify } from 'node:util';
import type { RunResult } from '../../src/reporting/types';
import { toXrayExecution, uploadToXray, type XrayExecution } from '../../src/reporting/xray';

const CLIENT_ID = 'id-de-teste';
const CLIENT_SECRET = 'segredo-de-teste';
const TOKEN = 'token-de-teste';

interface FakeXray {
  baseUrl: string;
  imports: { authorization?: string; body: XrayExecution }[];
  close: () => Promise<void>;
}

/** Servidor que responde como o Xray Cloud, inclusive nos erros. */
async function startFakeXray(): Promise<FakeXray> {
  const imports: FakeXray['imports'] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      const body = raw ? JSON.parse(raw) : {};

      if (req.method === 'POST' && req.url === '/api/v2/authenticate') {
        if (body.client_id !== CLIENT_ID || body.client_secret !== CLIENT_SECRET) {
          return send(401, { error: 'Authentication failed. Invalid client credentials!' });
        }
        // O Xray devolve o token como uma string JSON (entre aspas).
        return send(200, TOKEN);
      }

      if (req.method === 'POST' && req.url === '/api/v2/import/execution') {
        if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'Invalid token' });
        const invalid = (body.tests ?? []).find(
          (t: { testKey?: string; testInfo?: unknown }) => !t.testKey && !t.testInfo,
        );
        if (!Array.isArray(body.tests) || invalid) {
          return send(400, { error: 'Error importing execution: test without testKey or testInfo' });
        }
        imports.push({ authorization: req.headers.authorization, body });
        return send(200, { id: '10500', key: 'QA-500', self: 'https://jira.example.com/rest/api/2/issue/10500' });
      }

      send(404, { error: 'not found' });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    imports,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

const run: RunResult = {
  startedAt: '2026-10-30T10:00:00.000Z',
  finishedAt: '2026-10-30T10:01:00.000Z',
  durationMs: 60_000,
  status: 'passed',
  scenarios: [
    {
      id: '1',
      storyId: 'US-001',
      feature: 'US-001 · Cadastro',
      scenario: 'Completo',
      tags: ['@US-001', '@TEST_QA-101', '@REQ_QA-10'],
      xrayTestKey: 'QA-101',
      requirementKey: 'QA-10',
      status: 'passed',
      flaky: false,
      retries: 0,
      startTime: '2026-10-30T10:00:00.000Z',
      durationMs: 5000,
      steps: [],
    },
    {
      id: '2',
      storyId: 'US-004',
      feature: 'US-004 · Funcionários',
      scenario: 'Idade com letra',
      tags: ['@US-004', '@negativo', '@REQ_QA-13'],
      requirementKey: 'QA-13',
      status: 'passed',
      flaky: false,
      retries: 0,
      startTime: '2026-10-30T10:00:10.000Z',
      durationMs: 3000,
      steps: [],
    },
  ],
};

describe('envio ao Xray Cloud (API simulada)', () => {
  let xray: FakeXray;
  before(async () => {
    xray = await startFakeXray();
  });
  after(() => xray.close());

  const execution = toXrayExecution(run, { projectKey: 'QA', reportsDir: 'reports' });

  it('autentica, usa o token e importa a execução', async () => {
    const response = await uploadToXray(execution, {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      baseUrl: xray.baseUrl,
    });
    assert.deepEqual(response, {
      id: '10500',
      key: 'QA-500',
      self: 'https://jira.example.com/rest/api/2/issue/10500',
    });

    const received = xray.imports.at(-1);
    assert.equal(received?.authorization, `Bearer ${TOKEN}`);
    assert.deepEqual(received?.body, JSON.parse(JSON.stringify(execution)));
  });

  it('credencial errada vira erro claro, com a resposta do Xray', async () => {
    await assert.rejects(
      uploadToXray(execution, { clientId: CLIENT_ID, clientSecret: 'errado', baseUrl: xray.baseUrl }),
      /Falha ao autenticar no Xray: HTTP 401 .*Invalid client credentials/,
    );
  });

  it('importação recusada vira erro claro, com a resposta do Xray', async () => {
    const broken: XrayExecution = { ...execution, tests: [{ ...execution.tests[0]!, testKey: undefined }] };
    await assert.rejects(
      uploadToXray(broken, { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, baseUrl: xray.baseUrl }),
      /Falha ao importar no Xray: HTTP 400 .*test without testKey or testInfo/,
    );
  });

  it('o comando "xray:export -- --upload" lê as variáveis de ambiente e envia', async () => {
    // Pasta temporária com um reports/results.json, como depois de "npm run test:e2e".
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-xray-'));
    fs.mkdirSync(path.join(workDir, 'reports'));
    fs.writeFileSync(path.join(workDir, 'reports', 'results.json'), JSON.stringify(run));
    const before = xray.imports.length;

    const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
    const cli = path.resolve('src/cli/xray-export.ts');
    const { stdout } = await promisify(execFile)(process.execPath, [tsx, cli, '--upload'], {
      cwd: workDir,
      env: {
        ...process.env,
        XRAY_CLIENT_ID: CLIENT_ID,
        XRAY_CLIENT_SECRET: CLIENT_SECRET,
        XRAY_BASE_URL: xray.baseUrl,
        XRAY_PROJECT_KEY: 'QA',
        XRAY_TEST_PLAN_KEY: 'QA-1',
      },
    });

    assert.match(stdout, /2 resultado\(s\).*1 vinculado\(s\) a testes existentes, 1 a criar/);
    assert.match(stdout, /execução importada.*QA-500/);
    assert.equal(xray.imports.length, before + 1);
    assert.equal(xray.imports.at(-1)?.body.info.testPlanKey, 'QA-1');
    assert.ok(fs.existsSync(path.join(workDir, 'reports', 'xray-execution.json')));
    fs.rmSync(workDir, { recursive: true, force: true });
  });
});
