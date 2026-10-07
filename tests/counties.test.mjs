import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const counties=JSON.parse(await readFile(new URL('../public/data/counties.json',import.meta.url)));
const statewide=JSON.parse(await readFile(new URL('../public/data/programs.json',import.meta.url)));
const monthIndex=d=>Number(d.slice(0,4))*12+Number(d.slice(5))-1;

test('county snapshots contain every county and retain their source provenance',()=>{
 assert.equal(counties.asOf,statewide.asOf);
 assert.equal(counties.counties.length,21);
 assert.equal(new Set(counties.counties).size,21);
 assert.equal(counties.programs.length,6);
 const sources=new Map(statewide.sources.map(s=>[s.id,s]));
 for(const p of counties.programs){
  assert.equal(p.snapshots.length,66);
  assert.equal(p.snapshots[0].date,'2010-03');
  assert.equal(p.snapshots.at(-1).date,counties.asOf);
  for(const [i,s] of p.snapshots.entries()){
   assert.deepEqual(s.values.map(v=>v.county).sort(),[...counties.counties].sort());
   assert.ok(s.values.every(v=>Number.isInteger(v.value)&&v.value>=0));
   assert.equal(s.values.reduce((sum,v)=>sum+v.value,0),s.total);
   assert.equal(sources.get(s.source).reportDate,s.date);
   assert.ok(s.page>0&&s.table>0);
   assert.ok(['03','06','09','12'].includes(s.date.slice(5)));
   if(i)assert.equal(monthIndex(s.date)-monthIndex(p.snapshots[i-1].date),3);
  }
 }
});

test('latest county rows match June 2026 published values and totals',()=>{
 const totals={snap:402893,tanf:8662,ga:17655,tanfEA:1759,gaEA:3256,childSupport:178432};
 for(const p of counties.programs)assert.equal(p.snapshots.at(-1).total,totals[p.id]);
 const value=(id,county)=>counties.programs.find(p=>p.id===id).snapshots.at(-1).values.find(v=>v.county===county).value;
 assert.equal(value('snap','Essex'),57971);
 assert.equal(value('snap','Hudson'),50301);
 assert.equal(value('tanf','Hudson'),1538);
 assert.equal(value('gaEA','Hudson'),658);
 assert.equal(value('childSupport','Hudson'),13302);
 assert.equal(counties.programs.find(p=>p.id==='childSupport').unit,'Cases with orders');
});

test('every county sum difference from reconciled statewide history is disclosed',()=>{
 const differences=[];
 for(const p of counties.programs){
  if(p.id==='childSupport')continue;
  const series=statewide.programs.find(v=>v.id===p.id).observations;
  for(const s of p.snapshots){
   const actual=series.find(v=>v.date===s.date).value;
   if(s.total!==actual)differences.push({program:p.id,date:s.date,countySum:s.total,statewide:actual,source:s.source});
  }
 }
 assert.deepEqual(counties.qualityNotes,differences);
 assert.equal(differences.length,3);
});
