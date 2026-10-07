// Shared calculations used by the charts and by independent arithmetic tests.
export function referenceObservation(observations,selected){
 const latest=observations.at(-1).date;
 const target=selected||`${Number(latest.slice(0,4))-2}${latest.slice(4)}`;
 return observations.find(o=>o.date===target)||observations.filter(o=>o.date<=target).at(-1)||observations[0];
}
export function percentageChange(current,previous){return previous>0?100*(current/previous-1):null;}
export function householdContext(value,census){
 return {rate:100*value/census.households,
  lower:100*value/(census.households+census.householdsMoe),
  upper:100*value/(census.households-census.householdsMoe)};
}
export function groupParticipation(snapshot,census){
 return census.grouping.groups.map(g=>{
  const value=snapshot.values.filter(v=>g.counties.includes(v.county)).reduce((sum,v)=>sum+v.value,0);
  return {...g,value,rate:100*value/g.households};
 });
}
export function selectedValue(snapshot,name){return name==='Total'?snapshot.total:snapshot.values.find(v=>v.county===name).value;}
export function eaRatio(tanf,tanfEA,ga,gaEA){
 const ratio=(a,b)=>b>0?100*a/b:null;
 return {tanf:ratio(tanfEA,tanf),ga:ratio(gaEA,ga),combined:ratio(tanfEA+gaEA,tanf+ga),tanfEA,gaEA,tanfCount:tanf,gaCount:ga};
}
export function planningSignals(model,threshold=5){
 return model.counties.map(c=>{
  const f=c.forecast.at(-1),samples=f.scenarios;
  const increase=c.observed>0?samples.filter(v=>v>=c.observed*(1+threshold/100)).length:null;
  const decrease=c.observed>0?samples.filter(v=>v<=c.observed*(1-threshold/100)).length:null;
  const choice=increase===null?'insufficient_reference':increase>=6?'review_increase':decrease>=6?'review_decrease':'mixed_scenarios';
  return {county:c.county,observed:c.observed,projected:f.value,change:f.value-c.observed,date:f.date,lower:f.lower,upper:f.upper,
   thresholdPct:threshold,scenarioCount:samples.length,increaseScenarios:increase,decreaseScenarios:decrease,choice,rate:f.per100Households};
 });
}
