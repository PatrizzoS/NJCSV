import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {referenceObservation,percentageChange,householdContext,groupParticipation} from '../public/analytics.js';
const read=name=>readFile(new URL(`../public/data/${name}.json`,import.meta.url)).then(JSON.parse);
const [census,counties,models,data]=await Promise.all(['census','counties','models','programs'].map(read));

test('default reference is two years before the latest observation, with valid quarter selection',()=>{
 for(const p of data.programs)assert.equal(referenceObservation(p.observations).date,'2024-06');
 const quarters=[{date:'2024-03',value:10},{date:'2024-06',value:20},{date:'2026-06',value:30}];
 assert.equal(referenceObservation(quarters,'2024-05').date,'2024-03');
 assert.equal(referenceObservation(quarters,'2024-06').value,20);
 assert.equal(percentageChange(30,20),50);
 assert.equal(percentageChange(30,0),null);
});

test('Census context covers every NJ county and preserves period, household estimates and uncertainty',()=>{
 assert.equal(census.period,'2020–2024');
 assert.deepEqual(census.counties.map(c=>c.county),counties.counties);
 assert.equal(new Set(census.counties.map(c=>c.fips)).size,21);
 assert.equal(census.sources.length,4);
 for(const s of census.sources){assert.match(s.url,/^https:\/\/www2.census.gov\/programs-surveys\/acs\/summary_file\/2024\//);assert.match(s.extractSha256,/^[0-9a-f]{64}$/);}
 const essex=census.counties.find(c=>c.county==='Essex');
 assert.equal(essex.households,319788);assert.equal(essex.householdsMoe,1015);assert.equal(essex.medianIncome,80789);
 const context=householdContext(57971,essex);
 assert.ok(Math.abs(context.rate-18.127947265063106)<1e-9);
 assert.ok(context.lower<context.rate&&context.upper>context.rate);
 for(const c of census.counties){assert.ok(c.households>c.householdsMoe);assert.ok(c.povertyHouseholds<=c.povertyUniverse);assert.ok(Math.abs(c.povertyPct-100*c.povertyHouseholds/c.povertyUniverse)<1e-9);}
});

test('Census groups match nearest learned centers, and aggregate program rates use summed households',()=>{
 const method=census.grouping;assert.equal(method.k,3);
 let inertia=0;
 for(const c of census.counties){
  const x=[c.povertyPct,Math.log(c.medianIncome),c.averageHouseholdSize].map((v,i)=>(v-method.featureMeans[i])/method.featureScales[i]);
  const distances=method.standardizedCenters.map(center=>center.reduce((sum,v,i)=>sum+(v-x[i])**2,0));
  const selected=c.group.charCodeAt(0)-65;
  assert.equal(distances.indexOf(Math.min(...distances)),selected);inertia+=distances[selected];
 }
 assert.ok(Math.abs(inertia-method.inertia)<1e-9);
 for(const p of counties.programs){
  const snapshot=p.snapshots.at(-1),groups=groupParticipation(snapshot,census);
  assert.equal(groups.reduce((sum,g)=>sum+g.value,0),snapshot.total);
  assert.equal(groups.reduce((sum,g)=>sum+g.households,0),census.counties.reduce((sum,c)=>sum+c.households,0));
  for(const g of groups)assert.equal(g.rate,100*g.value/g.households);
 }
});

test('forecast explanations expose learned weights and arithmetic from actual validation predictions',()=>{
 for(const m of Object.values(models.models)){
  assert.equal(m.learnedWeights.length,9);assert.equal(m.trainingTargets,84);
  assert.ok(m.learnedWeights.every(w=>Number.isFinite(w.coefficient)));
  const errors=m.backtest.predictions.filter(p=>p.actual>0).map(p=>100*Math.abs(p.actual-p.predicted)/p.actual);
  assert.ok(Math.abs(m.meanAbsolutePercentError-errors.reduce((a,b)=>a+b,0)/errors.length)<1e-9);
 }
});
