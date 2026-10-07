import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {eaRatio,selectedValue,planningSignals} from '../public/analytics.js';
const read=async name=>JSON.parse(await readFile(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'));
const [counties,census,state,models]=await Promise.all(['counties','census','census-state','county-models'].map(read));
test('state household denominator is the official total and matches all county households',()=>{
 assert.equal(state.households,3507701);assert.equal(state.households,census.counties.reduce((s,c)=>s+c.households,0));
 assert.equal(state.medianIncome,103556);assert.ok(state.householdsMoe>0);
 for(const p of counties.programs){const s=p.snapshots.at(-1);assert.equal(selectedValue(s,'Total'),s.values.reduce((sum,c)=>sum+c.value,0));}
});
test('EA ratios use matching administrative counts and preserve undefined zero denominators',()=>{
 const r=eaRatio(8662,1759,17655,3256);assert.equal(r.tanf,100*1759/8662);assert.equal(r.ga,100*3256/17655);assert.equal(r.combined,100*5015/26317);
 assert.equal(eaRatio(0,0,0,0).combined,null);assert.equal(eaRatio(0,1,10,2).tanf,null);
 const ids=['tanf','tanfEA','ga','gaEA'],ss=ids.map(id=>counties.programs.find(p=>p.id===id).snapshots.at(-1));
 const a=eaRatio(...ss.map(s=>s.total));assert.equal(a.combined,r.combined);
});
test('county forecasts use only as-of vintages and validation targets beyond each fit',()=>{
 for(const [id,m] of Object.entries(models.models)){
  assert.equal(m.counties.length,21);assert.equal(m.features.length,9);assert.ok(!m.features.some(f=>/poverty/i.test(f)));assert.equal(m.validation.predictions.length,336);assert.equal(m.censusYear,2024);
  for(const t of m.validation.predictions){assert.ok(t.trainingLastTarget<=t.origin);assert.ok(t.target>t.origin);assert.equal(t.censusYear,t.origin<'2026-03'?2019:2024);const actual=counties.programs.find(p=>p.id===id).snapshots.find(s=>s.date===t.target).values.find(c=>c.county===t.county).value;assert.equal(actual,t.actual);}
  const mae=m.validation.predictions.reduce((s,t)=>s+Math.abs(t.actual-t.predicted),0)/336;assert.ok(Math.abs(mae-m.validation.mae)<1e-8);
  for(const c of m.counties){assert.deepEqual(c.forecast.map(f=>f.date),['2026-09','2026-12']);for(const f of c.forecast){assert.equal(f.scenarios.length,8);assert.ok(f.lower>=0&&f.lower<=f.value&&f.upper>=f.value);assert.equal(f.per100Households,100*f.value/c.households);assert.ok(f.scenarios.every(v=>Number.isInteger(v)&&v>=0));}}
 }
});
test('planning signals remain explicit counts, respond to threshold and handle a zero reference',()=>{
 const make=(observed,values)=>({counties:[{county:'Example',observed,forecast:[{date:'2026-12',value:110,lower:80,upper:120,scenarios:values,per100Households:2}]}]});
 assert.equal(planningSignals(make(100,[110,111,112,113,114,115,100,100]),5)[0].choice,'review_increase');
 assert.equal(planningSignals(make(100,[110,111,112,113,114,115,100,100]),15)[0].choice,'mixed_scenarios');
 assert.equal(planningSignals(make(100,[90,89,88,87,86,85,100,100]),5)[0].choice,'review_decrease');
 assert.equal(planningSignals(make(0,[1,2,3,4,5,6,7,8]),5)[0].choice,'insufficient_reference');
 for(const m of Object.values(models.models))for(const s of planningSignals(m)){assert.equal(s.scenarioCount,8);assert.ok(s.increaseScenarios>=0&&s.increaseScenarios<=8);}
});
