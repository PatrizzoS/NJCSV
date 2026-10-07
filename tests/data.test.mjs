import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../public/data/programs.json',import.meta.url)));
const models=JSON.parse(await readFile(new URL('../public/data/models.json',import.meta.url)));
const monthIndex=d=>Number(d.slice(0,4))*12+Number(d.slice(5))-1;
test('all six official program series have ordered, continuous and traceable data',()=>{
 assert.equal(data.programs.length,6);const sources=new Map(data.sources.map(s=>[s.id,s]));
 for(const p of data.programs){assert.ok(p.observations.length>50);const step=p.frequency==='monthly'?1:3;
  for(let i=0;i<p.observations.length;i++){const o=p.observations[i];assert.ok(Number.isInteger(o.value)&&o.value>=0);assert.match(o.date,/^\d{4}-\d{2}$/);assert.ok(sources.has(o.source));assert.ok(o.page>0&&o.table>0);assert.match(sources.get(o.source).url,/^https:\/\/www.nj.gov\/humanservices\/dfd\/news\/reports\/pdf\/cps\//);if(i)assert.equal(monthIndex(o.date)-monthIndex(p.observations[i-1].date),step);}
  assert.equal(p.observations.at(-1).date,data.asOf);
 }
});
test('June 2026 source totals match the official report',()=>{
 const expected={snap:402893,tanf:8662,ga:17655,tanfEA:1759,gaEA:3256,childSupport:266291043};
 for(const p of data.programs)assert.equal(p.observations.find(o=>o.date==='2026-06').value,expected[p.id]);
});
test('SNAP and TANF adult/child composition agrees with published person totals',()=>{
 for(const id of ['snap','tanf']){const p=data.programs.find(p=>p.id===id);for(let i=0;i<p.people.length;i++)assert.equal(p.composition.Adults[i].value+p.composition.Children[i].value,p.people[i].value);}
});
test('forecasts and backtests respect temporal separation and finite intervals',()=>{
 assert.equal(models.asOf,data.asOf);assert.equal(Object.keys(models.models).length,5);
 for(const [id,m] of Object.entries(models.models)){assert.equal(m.trainingEnd,data.asOf);assert.equal(m.forecast.length,6);assert.equal(m.backtest.originCount,18);assert.equal(m.backtest.predictions.length,108);
  m.forecast.forEach((f,i)=>{assert.equal(monthIndex(f.date),monthIndex(data.asOf)+i+1);assert.ok(Number.isFinite(f.value)&&f.lower>=0&&f.lower<=f.value&&f.upper>=f.value);});
  const p=data.programs.find(p=>p.id===id);for(const t of m.backtest.predictions){assert.equal(monthIndex(t.target)-monthIndex(t.origin),t.horizon);assert.ok(t.origin<t.target);assert.equal(t.actual,p.observations.find(o=>o.date===t.target).value);assert.equal(t.baseline,p.observations.find(o=>monthIndex(o.date)===monthIndex(t.target)-12).value);}
  const mae=m.backtest.predictions.reduce((s,t)=>s+Math.abs(t.actual-t.predicted),0)/108;assert.ok(Math.abs(mae-m.backtest.mae)<1);
 }
});
test('published GA discrepancies are retained rather than recomputed',()=>{
 const p=data.programs.find(p=>p.id==='ga');const q=data.qualityNotes.find(q=>q[2]==='2026-06');assert.ok(q);assert.equal(q[4][4],p.observations.at(-1).value);assert.notEqual(q[4][0]+q[4][2],p.observations.at(-1).value);
});
