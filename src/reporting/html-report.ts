import fs from 'node:fs';
import path from 'node:path';
import type { CheckPhase, FieldCheck } from '../agent/checks';
import type { RunResult, ScenarioResult } from './types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const STATUS_LABEL: Record<string, string> = {
  passed: 'Passou',
  failed: 'Falhou',
  timedOut: 'Timeout',
  skipped: 'Pulado',
  interrupted: 'Interrompido',
};

const PHASES: { phase: CheckPhase; title: string }[] = [
  { phase: 'preenchimento', title: 'Conferência após preencher cada campo' },
  { phase: 'resumo', title: 'Tela de confirmação (esperado × exibido)' },
  { phase: 'validação', title: 'Validação dos campos' },
];

function checksTable(checks: FieldCheck[]): string {
  return `<table class="checks"><thead><tr><th>Campo</th><th>Esperado</th><th>Obtido</th><th></th></tr></thead><tbody>${checks
    .map(
      (c) =>
        `<tr class="${c.passed ? 'ok' : 'bad'}"><td>${esc(c.field)}</td><td><code>${esc(c.expected) || '<span class="muted">(vazio)</span>'}</code></td><td><code>${
          esc(c.actual) || '<span class="muted">(vazio)</span>'
        }</code></td><td class="mark">${c.passed ? '✓' : '✗'}</td></tr>`,
    )
    .join('')}</tbody></table>`;
}

function scenarioCard(s: ScenarioResult, reportsDir: string): string {
  const ok = s.status === 'passed';
  const checks = s.log?.checks ?? [];
  const passedChecks = checks.filter((c) => c.passed).length;

  let image = '';
  if (s.screenshot) {
    const file = path.join(reportsDir, s.screenshot);
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file).toString('base64');
      image = `<figure><a href="${esc(s.screenshot)}" target="_blank"><img loading="lazy" alt="Tela final do cenário" src="data:image/png;base64,${data}"></a><figcaption>Tela ao fim do cenário</figcaption></figure>`;
    }
  }

  const steps = s.steps
    .map(
      (st) =>
        `<li class="${st.status}"><span class="dot"></span><span>${esc(st.title)}</span><span class="muted">${seconds(st.durationMs)}</span></li>`,
    )
    .join('');

  const phases = PHASES.map(({ phase, title }) => {
    const list = checks.filter((c) => c.phase === phase);
    return list.length ? `<h4>${title}</h4>${checksTable(list)}` : '';
  }).join('');

  const tags = s.tags
    .filter((t) => t !== `@${s.storyId}`)
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join('');

  return `<details class="scenario ${ok ? 'pass' : 'fail'}"${ok ? '' : ' open'}>
  <summary>
    <span class="pill ${ok ? 'pass' : 'fail'}">${STATUS_LABEL[s.status] ?? s.status}${s.flaky ? ' (instável)' : ''}</span>
    <span class="name">${esc(s.scenario)}</span>
    <span class="tags">${tags}</span>
    <span class="meta">${checks.length ? `${passedChecks}/${checks.length} verificações · ` : ''}${seconds(s.durationMs)}</span>
  </summary>
  <div class="body">
    <div class="cols">
      <div>
        <h4>Passos</h4><ol class="steps">${steps}</ol>
        ${s.error ? `<h4>Erro</h4><pre class="error">${esc(s.error)}</pre>` : ''}
        ${phases}
      </div>
      ${image}
    </div>
  </div>
</details>`;
}

export function renderHtmlReport(run: RunResult, reportsDir: string): string {
  const total = run.scenarios.length;
  const passed = run.scenarios.filter((s) => s.status === 'passed').length;
  const failed = run.scenarios.filter((s) => s.status === 'failed' || s.status === 'timedOut').length;
  const allChecks = run.scenarios.flatMap((s) => s.log?.checks ?? []);
  const checksOk = allChecks.filter((c) => c.passed).length;

  const byStory = new Map<string, ScenarioResult[]>();
  for (const s of run.scenarios) byStory.set(s.feature, [...(byStory.get(s.feature) ?? []), s]);

  const stories = [...byStory.entries()]
    .map(([feature, list]) => {
      const req = list.find((s) => s.requirementKey)?.requirementKey;
      return `<section class="story"><h2>${esc(feature)}${req ? ` <span class="req">requisito ${esc(req)}</span>` : ''}</h2>${list
        .map((s) => scenarioCard(s, reportsDir))
        .join('')}</section>`;
    })
    .join('');

  const when = new Date(run.startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relatório QA Story Agent</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--text:#1d2330;--muted:#6b7280;--line:#e3e6eb;--ok:#15803d;--ok-bg:#e8f6ee;--bad:#b91c1c;--bad-bg:#fdecec;--accent:#4f46e5;--code:#f1f3f6}
@media (prefers-color-scheme:dark){:root{--bg:#0f1218;--card:#171b23;--text:#e6e8ec;--muted:#9aa3b2;--line:#2a303b;--ok:#4ade80;--ok-bg:#12291c;--bad:#f87171;--bad-bg:#2d1517;--accent:#818cf8;--code:#202632}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:32px 16px 64px}
header h1{margin:0;font-size:24px}
header p{margin:4px 0 0;color:var(--muted)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:24px 0 32px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.stat b{display:block;font-size:26px;font-variant-numeric:tabular-nums}
.stat span{color:var(--muted);font-size:13px}
.stat.ok b{color:var(--ok)}.stat.bad b{color:var(--bad)}
.story h2{font-size:17px;margin:28px 0 10px}
.req{font-size:12px;font-weight:500;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:1px 8px;margin-left:6px;vertical-align:middle}
.scenario{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--ok);border-radius:10px;margin-bottom:10px;overflow:hidden}
.scenario.fail{border-left-color:var(--bad)}
summary{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:12px 16px;cursor:pointer;list-style:none}
summary::-webkit-details-marker{display:none}
.name{font-weight:600;flex:1 1 240px}
.meta{color:var(--muted);font-size:13px;font-variant-numeric:tabular-nums}
.pill{font-size:12px;font-weight:600;border-radius:999px;padding:2px 10px}
.pill.pass{background:var(--ok-bg);color:var(--ok)}.pill.fail{background:var(--bad-bg);color:var(--bad)}
.tag{font-size:12px;color:var(--accent);margin-right:6px}
.body{border-top:1px solid var(--line);padding:4px 16px 16px}
.cols{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:24px}
@media (max-width:760px){.cols{grid-template-columns:1fr}}
h4{margin:16px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.steps{margin:0;padding:0;list-style:none}
.steps li{display:flex;gap:10px;align-items:baseline;padding:3px 0}
.steps li span:nth-child(2){flex:1}
.dot{width:8px;height:8px;border-radius:50%;background:var(--ok);flex:none;transform:translateY(-1px)}
.steps li.failed .dot{background:var(--bad)}.steps li.skipped .dot{background:var(--line)}
.checks{width:100%;border-collapse:collapse;font-size:14px}
.checks th{text-align:left;font-weight:600;color:var(--muted);font-size:12px;border-bottom:1px solid var(--line);padding:6px 8px}
.checks td{border-bottom:1px solid var(--line);padding:6px 8px;vertical-align:top;overflow-wrap:anywhere}
.checks tr.bad td{background:var(--bad-bg)}
.mark{width:24px;text-align:center;font-weight:700}
tr.ok .mark{color:var(--ok)}tr.bad .mark{color:var(--bad)}
code{background:var(--code);border-radius:4px;padding:1px 5px;font-size:13px}
.muted{color:var(--muted)}
pre.error{background:var(--bad-bg);color:var(--bad);padding:12px;border-radius:8px;white-space:pre-wrap;font-size:13px;margin:0}
figure{margin:16px 0 0}
figure img{width:100%;border:1px solid var(--line);border-radius:8px;display:block}
figcaption{color:var(--muted);font-size:12px;margin-top:6px}
footer{margin-top:40px;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<main>
<header>
  <h1>Relatório do QA Story Agent</h1>
  <p>Execução de ${esc(when)} · duração ${seconds(run.durationMs)}</p>
</header>
<div class="stats">
  <div class="stat"><b>${total}</b><span>cenários executados</span></div>
  <div class="stat ok"><b>${passed}</b><span>passaram</span></div>
  <div class="stat ${failed ? 'bad' : ''}"><b>${failed}</b><span>falharam</span></div>
  <div class="stat"><b>${checksOk}/${allChecks.length}</b><span>verificações de campo</span></div>
</div>
${stories || '<p class="muted">Nenhum cenário executado.</p>'}
<footer>Gerado a partir das histórias em <code>stories/</code>. Dados 100% fictícios, executados no site público de prática DemoQA.</footer>
</main>
</body>
</html>`;
}
