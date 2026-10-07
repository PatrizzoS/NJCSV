import {defineTerms,setupDefinitions,hideDefinitions,addComponentDefinitions} from './glossary.js';
import {renderEAComparison,renderCaseloadLines,renderCountyExtras,renderCountyOutlook,downloadSignals} from './insights.js';
import {referenceObservation,percentageChange,householdContext,selectedValue} from './analytics.js';
/* NJCSV: all data comes from the shipped, provenance-linked DFD snapshot. */
let colors=[];
function updateTheme(){
 const dark=document.documentElement.dataset.theme==='dark';
 colors=dark?['#7facff','#ffab66','#bf9bff','#56d8c7','#e8edf6','#9aadc6']:['#215ac4','#d55e00','#7b4ea3','#008a80','#263849','#527384'];
 const button=document.getElementById('theme-toggle');button.textContent=dark?'Light mode':'Dark mode';button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');
}
updateTheme();
window.addEventListener('themechange',()=>{updateTheme();if(data)render();});
document.getElementById('theme-toggle').addEventListener('click',()=>window.njcsvTheme.toggle());
const lineStyles={snap:null,tanf:null,ga:'10 3 2 3',tanfEA:'7 4',gaEA:'2 5'};
const $=id=>document.getElementById(id);
const number=new Intl.NumberFormat('en-US');
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
const date=d=>new Date(d+'-01T00:00:00Z');
const month=d=>date(d).toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'});
const pct=v=>(v>=0?'+':'')+v.toFixed(1)+'%';
const pretty=(v,unit)=>unit==='Percent'?v.toFixed(1)+'%':unit==='Nominal USD'?'$'+compact.format(v):number.format(Math.round(v));
let data,models,counties,census,censusState,countyModels,active='snap',view='trends',modelProgram='snap';
let referenceDate=null;
let countyProgram='snap',countyName='Total',countyDate=null,countyNavigationTarget=null;
const countyLabel=name=>name==='Total'?'New Jersey state total':name+' County';
let compareVisible=new Set(['snap','tanf','ga','tanfEA','gaEA']);
let chartObservers=[];
const titles={trends:['THE LONG VIEW','New Jersey, over time.','Follow the reach of New Jersey’s major family assistance programs.'],compare:['A COMMON BASELINE','Different programs. Shared perspective.','Compare rates of change without letting SNAP’s larger scale hide smaller programs.'],models:['PATTERNS & PROJECTIONS','What might come next?','Explore learned patterns, historical forecast errors, and unusual monthly changes.'],sources:['PROVENANCE & METHODS','From reports to readable trends.','Understand the source data, the models, and the limits of this analysis.']};
titles.counties=['COUNTY BY COUNTY','A closer look at New Jersey.','Compare all 21 counties and follow their published program histories.'];
function program(id){return data.programs.find(p=>p.id===id);}
function source(obs){return data.sources.find(s=>s.id===obs.source)?.url+'#page='+obs.page;}
function filtered(obs,range){if(range==='all')return obs;const last=date(obs.at(-1).date);last.setUTCFullYear(last.getUTCFullYear()-Number(range));return obs.filter(o=>date(o.date)>=last);}
function change(obs){const last=obs.at(-1);const prior=obs.find(o=>o.date===`${Number(last.date.slice(0,4))-1}${last.date.slice(4)}`);return prior?100*(last.value/prior.value-1):null;}
function stat(label,value,context,cls=''){return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-context ${cls}">${context}</div></div>`;}
function tip(event,html){const el=$('tooltip');el.innerHTML=html;el.hidden=false;const rect=el.getBoundingClientRect();el.style.left=Math.max(8,Math.min(event.clientX+16,window.innerWidth-rect.width-8))+'px';el.style.top=Math.max(8,Math.min(event.clientY+12,window.innerHeight-rect.height-8))+'px';}
function hideTip(){$('tooltip').hidden=true;}
function destroyObservers(){chartObservers.forEach(o=>o.disconnect());chartObservers=[];}
function lineChart(container,series,{unit='Count',height=330,zero=true,reference=null,band=null,markers=[],annotation=false,mini=false,connectGap=1,title='',endLabel=true}={}){
 const el=typeof container==='string'?$(container):container;
 const draw=()=>{
  const width=el.clientWidth;if(!width)return;el.replaceChildren();
  const margin={top:mini?12:30,right:mini?8:24,bottom:mini?30:48,left:mini?48:68};
  const w=width-margin.left-margin.right,h=height-margin.top-margin.bottom;
  if(w<=0)return;
  const svg=d3.select(el).append('svg').attr('viewBox',`0 0 ${width} ${height}`).attr('role','img').attr('aria-label',title||`${series.map(s=>s.name).join(', ')} over time, ${unit}`);
  svg.append('title').text(title||`${series.map(s=>s.name).join(', ')} over time`);
  const points=series.flatMap(s=>s.values);if(!points.length){el.textContent='Select at least one program.';return;}
  const x=d3.scaleUtc().domain(d3.extent(points,o=>date(o.date))).range([4,w-4]);
  const extrema=points.map(o=>o.value).concat(band?band.flatMap(o=>[o.lower,o.upper]):[]);if(reference!==null)extrema.push(reference);
  const [lo,hi]=d3.extent(extrema);const pad=Math.max((hi-lo)*.15,hi*.02,1);
  const y=d3.scaleLinear().domain([zero?0:Math.max(0,lo-pad),hi+pad]).nice().range([h-4,4]);
  const g=svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`);
  g.append('g').attr('class','grid').call(d3.axisLeft(y).ticks(mini?2:5).tickSize(-w).tickFormat(''));
  g.append('g').attr('class','axis').call(d3.axisLeft(y).ticks(mini?2:5).tickFormat(v=>unit==='Percent'?v+'%':unit==='Nominal USD'?'$'+compact.format(v):compact.format(v)));
  g.append('g').attr('class','axis').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(width<400?3:mini?3:6).tickSizeOuter(0).tickFormat(d3.utcFormat(x.domain()[1]-x.domain()[0]<2*365*86400000?'%b %y':'%Y')));
  if(!mini){svg.append('text').attr('class','axis-title').attr('x',margin.left).attr('y',14).text(unit);svg.append('text').attr('class','axis-title').attr('x',margin.left+w).attr('y',height-5).attr('text-anchor','end').text('Reporting period');}
  if(reference!==null)g.append('line').attr('x1',0).attr('x2',w).attr('y1',y(reference)).attr('y2',y(reference)).attr('stroke','#7b899b').attr('stroke-dasharray','4 4');
  if(band)g.append('path').datum(band).attr('d',d3.area().x(o=>x(date(o.date))).y0(o=>y(o.lower)).y1(o=>y(o.upper))).attr('fill','var(--teal)').attr('opacity',.13);
  if(annotation){const a=date('2013-07');if(a>=x.domain()[0]&&a<=x.domain()[1]){const ax=x(a);g.append('line').attr('x1',ax).attr('x2',ax).attr('y1',0).attr('y2',h).attr('stroke','#93a1b4').attr('stroke-dasharray','3 5');if(width>470)g.append('text').attr('x',ax+7).attr('y',12).attr('fill','var(--muted)').attr('font-size',10).attr('class','glossary-term').attr('data-term','reporting source changed').attr('tabindex',0).attr('aria-describedby','definition-tooltip').text('Jul 2013 · reporting source changed');}}
  for(const s of series){
   let segments=[[]];for(const o of s.values){const previous=segments.at(-1).at(-1);if(previous){const a=date(previous.date),b=date(o.date);const gap=(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth();if(gap>connectGap)segments.push([]);}segments.at(-1).push(o);}
   for(const segment of segments){g.append('path').datum(segment).attr('class','series-line').attr('data-series',s.id||s.name).attr('fill','none').attr('stroke',s.color).attr('stroke-width',mini?1.8:2.8).attr('stroke-linecap','round').attr('stroke-dasharray',s.dash||null).attr('d',d3.line().x(o=>x(date(o.date))).y(o=>y(o.value)));if(segment.length===1)g.append('circle').attr('cx',x(date(segment[0].date))).attr('cy',y(segment[0].value)).attr('r',3).attr('fill',s.color);}
   const last=s.values.at(-1);g.append('circle').attr('cx',x(date(last.date))).attr('cy',y(last.value)).attr('r',mini?2:3.5).attr('fill',s.color);
   if(endLabel&&!mini&&series.length===1)g.append('text').attr('class','end-label').attr('x',x(date(last.date))-8).attr('y',y(last.value)-11).attr('text-anchor','end').text(pretty(last.value,unit));
  }
  for(const o of markers){if(date(o.date)<x.domain()[0]||date(o.date)>x.domain()[1])continue;g.append('circle').attr('cx',x(date(o.date))).attr('cy',y(o.value)).attr('r',5).attr('fill','var(--surface)').attr('stroke','#b53d59').attr('stroke-width',2);}
  const guide=g.append('line').attr('y1',0).attr('y2',h).attr('stroke','#93a1b4').attr('opacity',0);
  const hits=g.append('rect').attr('width',w).attr('height',h).attr('fill','transparent');
  const hover=event=>{const [px]=d3.pointer(event,g.node());const at=x.invert(px);guide.attr('x1',px).attr('x2',px).attr('opacity',1);let rows='',selectedDate=null;for(const s of series){if(at<date(s.values[0].date)||at>date(s.values.at(-1).date))continue;const i=d3.bisector(o=>date(o.date)).center(s.values,at);const o=s.values[i];selectedDate=selectedDate||o.date;rows+=`<div class="tip-row"><span>${s.name}</span><span>${pretty(o.value,unit)}</span></div>`;if(band){const b=band.find(b=>b.date===o.date);if(b)rows+=`<div class="tip-row"><span>Empirical band</span><span>${pretty(b.lower,unit)}–${pretty(b.upper,unit)}</span></div>`;}}
   if(!selectedDate){hideTip();return;}
   tip(event,`<strong>${month(selectedDate)}</strong>${rows}`);};
  hits.on('pointermove',hover).on('pointerleave',()=>{guide.attr('opacity',0);hideTip();}).on('click',hover);g.selectAll('[data-term]').raise();defineTerms(el);
 };
 draw();const observer=new ResizeObserver(draw);observer.observe(el);chartObservers.push(observer);
}
function renderTrends(){
 $('coverage-range').textContent='DEC 2008 — '+month(data.asOf).toUpperCase();
 const p=program(active),obs=p.observations,last=obs.at(-1),yoy=change(obs),reference=referenceObservation(obs,referenceDate),growth=percentageChange(last.value,reference.value);
 referenceDate=reference.date;
 $('program-picker').innerHTML=data.programs.map(p=>`<button type="button" data-program="${p.id}" class="${p.id===active?'selected':''}" aria-pressed="${p.id===active}">${p.name}</button>`).join('');
 $('program-picker').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.program;referenceDate=null;render();}));
 $('stats').innerHTML=stat('LATEST · '+month(last.date).toUpperCase(),pretty(last.value,p.unit),p.unit==='Nominal USD'?'Quarterly collections in nominal dollars':p.unit)+stat('CHANGE FROM A YEAR EARLIER',yoy===null?'—':pct(yoy),'Same reporting month / quarter')+`<div class="stat reference-stat"><label for="reference-date" class="stat-label">CHANGE SINCE</label><select id="reference-date" class="reference-select" aria-label="Change since date">${[...obs].reverse().map(o=>`<option value="${o.date}">${month(o.date)}</option>`).join('')}</select><div class="stat-value">${growth===null?'—':pct(growth)}</div><div class="stat-context">${growth===null?'Reference value is zero':`From ${pretty(reference.value,p.unit)} to ${pretty(last.value,p.unit)}`}</div></div>`;
 $('reference-date').value=referenceDate;$('reference-date').addEventListener('change',e=>{referenceDate=e.target.value;render();$('reference-date').focus();});
 $('trend-title').textContent=p.name;$('trend-unit').textContent=p.frequency==='quarterly'?'Quarterly collections · nominal US dollars':p.description+' · '+p.unit.toLowerCase();
 const shown=filtered(obs,$('range').value);let series=[{name:p.name,values:shown,color:colors[data.programs.indexOf(p)]}];
 if($('average').checked){const window=p.frequency==='quarterly'?4:12;const smooth=obs.flatMap((o,i)=>i>=window-1?[{...o,value:d3.mean(obs.slice(i-window+1,i+1),d=>d.value)}]:[]);series.push({name:'12-month average',values:filtered(smooth,$('range').value),color:'var(--chart-secondary)',dash:'4 3'});}
 lineChart('trend-chart',series,{unit:p.unit,annotation:['snap','tanf','tanfEA'].includes(p.id),connectGap:p.frequency==='quarterly'?3:1,title:`${p.name}, ${month(shown[0].date)} through ${month(last.date)}, ${p.unit}`});
 $('trend-note').textContent=p.frequency==='quarterly'?'Quarter ends from the source tables. Gaps are not interpolated.':p.id==='ga'?'Older reports use “persons”; newer reports use “cases”. Published totals retained.':'Monthly reported participation. Recipients may also receive other programs.';
 $('latest-source').href=source(last);if(['snap','tanf','tanfEA'].includes(p.id))$('trend-note').innerHTML+=' July 2013: <span class="glossary-term" data-term="reporting source changed" tabindex="0" aria-describedby="definition-tooltip">reporting source changed</span>.';
 $('data-table').innerHTML=`<table><caption class="sr-only">Published ${p.name} values for the selected period</caption><thead><tr><th scope="col">Period</th><th scope="col">${p.unit}</th><th scope="col">Source</th></tr></thead><tbody>${[...shown].reverse().map(o=>`<tr><td>${month(o.date)}</td><td>${number.format(o.value)}</td><td><a href="${source(o)}" target="_blank" rel="noopener">Table ${o.table} · PDF p. ${o.page}</a></td></tr>`).join('')}</tbody></table>`;
 $('small-multiples').innerHTML='';data.programs.forEach((p,i)=>{const last=p.observations.at(-1),yoy=change(p.observations);const card=document.createElement('article');card.className='mini';card.innerHTML=`<div class="mini-head"><h3>${p.name}</h3><span style="color:${colors[i]}" aria-hidden="true">●</span></div><div class="mini-value">${pretty(last.value,p.unit)}</div><div class="mini-unit">${p.unit} · ${month(last.date)}</div><div class="chart"></div><div class="mini-change">${yoy===null?'Year-over-year comparison unavailable':pct(yoy)+' from a year earlier'}</div>`;$('small-multiples').append(card);lineChart(card.querySelector('.chart'),[{name:p.name,values:p.observations,color:colors[i]}],{unit:p.unit,height:140,mini:true,connectGap:p.frequency==='quarterly'?3:1});});
}
function renderCompare(){
 $('coverage-range').textContent='DEC 2008 — '+month(data.asOf).toUpperCase();
 const eligible=data.programs.filter(p=>p.frequency==='monthly');
 renderCaseload(eligible);
 $('compare-legend').innerHTML=eligible.map(p=>`<button type="button" aria-pressed="${compareVisible.has(p.id)}" data-series="${p.id}"><svg width="32" height="12" aria-hidden="true"><line x1="2" x2="30" y1="6" y2="6" stroke="${colors[data.programs.indexOf(p)]}" stroke-width="3" stroke-linecap="round" ${lineStyles[p.id]?`stroke-dasharray="${lineStyles[p.id]}"`:''}/></svg>${p.name}</button>`).join('');
 $('compare-legend').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.series;if(compareVisible.has(id))compareVisible.delete(id);else compareVisible.add(id);render();}));
 const series=eligible.filter(p=>compareVisible.has(p.id)).map(p=>{const obs=filtered(p.observations,$('compare-range').value);return {id:p.id,name:p.name,values:obs.map(o=>({...o,value:100*o.value/obs[0].value})),color:colors[data.programs.indexOf(p)],dash:lineStyles[p.id]};});
 lineChart('compare-chart',series,{unit:'Index (first period = 100)',zero:false,reference:100,endLabel:false,height:390});
 const first=filtered(eligible[0].observations,$('compare-range').value)[0];$('compare-caption').textContent=`Starting point: ${month(first.date)} = 100. Child Support dollars are excluded. July 2013 reporting source changed and GA labeling changes limit interpretation across the full history.`;
 renderEAComparison({data,filtered,lineChart,colors,source});
 $('composition-charts').innerHTML='';for(const id of ['snap','tanf']){const p=program(id),el=document.createElement('div');el.innerHTML=`<h3>${p.name} recipients</h3><div class="inline-key"><span>Adults — solid</span><span>Children — dashed</span></div><div class="chart"></div>`;$('composition-charts').append(el);lineChart(el.querySelector('.chart'),[{name:'Adults',values:filtered(p.composition.Adults,$('compare-range').value),color:colors[0]},{name:'Children',values:filtered(p.composition.Children,$('compare-range').value),color:colors[1],dash:'5 3'}],{unit:'People',height:260,endLabel:false});}
}
function countySelection(){
 const p=counties.programs.find(p=>p.id===countyProgram);
 const s=p.snapshots.find(s=>s.date===countyDate)||p.snapshots.at(-1);
 countyDate=s.date;const value=selectedValue(s,countyName);
 const priorDate=`${Number(s.date.slice(0,4))-1}${s.date.slice(4)}`;
 const prior=p.snapshots.find(o=>o.date===priorDate);
 return {p,s,value,prior};
}
function countyChange(prior,name,value){const old=prior?selectedValue(prior,name):null;return old>0?100*(value/old-1):null;}
function renderCounties(){
 $('coverage-range').textContent='MAR 2010 — '+month(counties.asOf).toUpperCase();
 const {p,s,value,prior}=countySelection(),yoy=countyChange(prior,countyName,value);
 $('county-program').innerHTML=counties.programs.map(p=>`<option value="${p.id}">${p.name}${p.id==='childSupport'?' · cases with orders':''}</option>`).join('');$('county-program').value=countyProgram;
 $('county-date').innerHTML=[...p.snapshots].reverse().map(o=>`<option value="${o.date}">${month(o.date)}</option>`).join('');$('county-date').value=countyDate;
 $('county-name').innerHTML=['Total',...counties.counties].map(c=>`<option value="${c}">${c==='Total'?'New Jersey state total':c} · ${number.format(selectedValue(s,c))}</option>`).join('');$('county-name').value=countyName;
 $('county-measure-note').textContent=p.note||(p.id==='ga'?'General Assistance is labeled “persons” in older reports and “cases” in newer reports. Counts are not population-adjusted.':'Published county participation counts. Counts are not population-adjusted and programs can overlap.');
 $('county-stats').innerHTML=stat(countyLabel(countyName).toUpperCase()+' · '+month(s.date).toUpperCase(),number.format(value),p.unit)+(countyName==='Total'?'':stat('SHARE OF NJ COUNTY SUM',(100*value/s.total).toFixed(1)+'%',`County sum: ${number.format(s.total)} ${p.unit.toLowerCase()}`))+stat('CHANGE FROM A YEAR EARLIER',yoy===null?'—':pct(yoy),yoy===null?'No nonzero prior-year snapshot':'Computed from county snapshots');
 $('county-ranking-title').textContent=p.name+' · '+month(s.date);$('county-ranking-unit').textContent=p.unit+' by county';$('county-source').href=source(s);
 countyBars(s,p);
 const history=p.snapshots.map(o=>({date:o.date,value:selectedValue(o,countyName)}));
 $('county-trend-title').textContent=countyLabel(countyName)+' · '+p.name;
 lineChart('county-trend',[{name:countyLabel(countyName),values:history,color:colors[data.programs.findIndex(o=>o.id===p.id)]}],{unit:p.unit,connectGap:3,height:300,markers:[{date:s.date,value}],title:`${countyLabel(countyName)} ${p.name}, published report snapshots`});
 const discrepancy=counties.qualityNotes.find(q=>q.program===p.id&&q.date===s.date);
 $('county-quality').textContent=(discrepancy?`The county sum (${number.format(discrepancy.countySum)}) differs from the reconciled statewide value (${number.format(discrepancy.statewide)}). Published county values are preserved. `:'')+counties.zeroValueNote;
 renderCensusContext(p,s,value);
 renderCountyExtras({counties,censusState,censusCounty,countyName,countyDate,lineChart,colors,source,onCounty:name=>{countyName=name;render();}});
 const ranked=[{county:'Total',value:s.total},...[...s.values].sort((a,b)=>b.value-a.value||a.county.localeCompare(b.county))];
 $('county-table').innerHTML=`<table><caption class="sr-only">${p.name} county breakdown for ${month(s.date)}</caption><thead><tr><th scope="col">County</th><th scope="col">${p.unit}</th><th scope="col">Share of NJ program</th><th scope="col">ACS households</th><th scope="col">Share of NJ households</th><th scope="col">${rateLabel(p)}</th><th scope="col">Year-over-year change</th></tr></thead><tbody>${ranked.map(o=>{const c=countyChange(prior,o.county,o.value),cx=censusCounty(o.county);return `<tr class="${o.county===countyName?'selected-county':''}"><td><button type="button" data-county="${o.county}" aria-pressed="${o.county===countyName}">${o.county==='Total'?'New Jersey state total':o.county}</button></td><td>${number.format(o.value)}</td><td>${o.county==='Total'?'—':(100*o.value/s.total).toFixed(1)+'%'}</td><td>${number.format(cx.households)}</td><td>${o.county==='Total'?'—':(100*cx.households/censusState.households).toFixed(2)+'%'}</td><td>${householdContext(o.value,cx).rate.toFixed(2)}${p.id==='snap'?'%':''}</td><td>${c===null?'—':pct(c)}</td></tr>`;}).join('')}</tbody></table>`;
 $('county-table').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{countyName=b.dataset.county;render();}));
}
function countyBars(snapshot,p){
 const el=$('county-ranking');const draw=()=>{
  const width=el.clientWidth;if(!width)return;el.replaceChildren();const ranked=[{county:'Total',value:snapshot.total},...[...snapshot.values].sort((a,b)=>b.value-a.value||a.county.localeCompare(b.county))];
  const margin={left:100,right:62,top:28,bottom:32},h=ranked.length*25,w=width-margin.left-margin.right;
  const svg=d3.select(el).append('svg').attr('viewBox',`0 0 ${width} ${h+margin.top+margin.bottom}`).attr('role','img').attr('aria-label',`${p.name} state total and counts for all 21 counties, ${month(snapshot.date)}. Select a county using the county menu or table.`);
  const g=svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`);
  const max=d3.max(ranked,o=>o.value)||1,x=d3.scaleLinear().domain([0,max*1.05]).range([0,Math.max(1,w)]),y=d3.scaleBand().domain(ranked.map(o=>o.county)).range([0,h]).padding(.28);
  g.append('g').attr('class','axis').call(d3.axisLeft(y).tickFormat(v=>v==='Total'?'NJ state total':v).tickSize(0)).select('.domain').remove();
  g.append('g').attr('class','axis').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(width<400?2:4).tickFormat(compact.format).tickSizeOuter(0));
  const color=colors[data.programs.findIndex(o=>o.id===p.id)];
  for(const o of ranked){
   const row=g.append('g').attr('data-county-row',o.county).attr('tabindex',0).attr('role','button').attr('aria-label',`${countyLabel(o.county)}: ${number.format(o.value)} ${p.unit.toLowerCase()}. Explore this selection.`).style('cursor','pointer');
   row.append('rect').attr('data-county-bar',o.county).attr('x',0).attr('y',y(o.county)).attr('width',x(o.value)).attr('height',y.bandwidth()).attr('fill',color).attr('opacity',o.county===countyName?1:.45);
   row.append('text').attr('x',x(o.value)+6).attr('y',y(o.county)+y.bandwidth()/2).attr('dominant-baseline','middle').attr('fill','var(--ink)').attr('font-size',11).attr('font-weight',o.county===countyName?600:400).text(number.format(o.value));
   row.append('rect').attr('data-county-hit',o.county).attr('x',-margin.left).attr('y',y(o.county)-3).attr('width',width).attr('height',y.bandwidth()+6).attr('fill','transparent');
   const context=censusCounty(o.county),html=`<strong>${countyLabel(o.county)} · ${month(snapshot.date)}</strong><div>${number.format(o.value)} ${p.unit.toLowerCase()}</div>${o.county==='Total'?'':`<div>${(100*o.value/snapshot.total).toFixed(1)}% of NJ program count</div>`}<div>${number.format(context.households)} estimated households</div><div>${householdContext(o.value,context).rate.toFixed(2)} ${rateLabel(p).toLowerCase()}</div>`;
   const choose=()=>{countyName=o.county;render();};
   row.on('pointermove',e=>tip(e,html)).on('pointerleave',hideTip).on('click',choose).on('focus',e=>{const r=e.target.getBoundingClientRect();tip({clientX:r.left,clientY:r.top},html);}).on('blur',hideTip).on('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});
   row.select('[data-county-hit]').lower();
   g.selectAll('.axis .tick').filter(name=>name===o.county).select('text').style('cursor','pointer').on('pointermove',e=>tip(e,html)).on('pointerleave',hideTip).on('click',choose);
  }
  g.selectAll('.axis').raise();
  svg.append('text').attr('class','axis-title').attr('x',margin.left).attr('y',13).text(p.unit);
 };draw();const observer=new ResizeObserver(draw);observer.observe(el);chartObservers.push(observer);
}
function downloadCounties(){
 const {p,s,prior}=countySelection();
 const rows=['period,county,value,unit,share_percent,yoy_percent,acs_period,acs_households,acs_households_moe,share_nj_households_percent,units_per_100_households,source_pdf,pdf_page,table',...[{county:'Total',value:s.total},...s.values].map(o=>{const yoy=countyChange(prior,o.county,o.value),c=censusCounty(o.county);return [s.date,o.county,o.value,p.unit,(100*o.value/s.total).toFixed(2),yoy===null?'':yoy.toFixed(2),'2020-2024',c.households,c.householdsMoe,(100*c.households/censusState.households).toFixed(4),householdContext(o.value,c).rate.toFixed(4),source(s).split('#')[0],s.page,s.table].join(',');})];
 const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`njcsv-${p.id}-counties-${s.date}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderModels(){
 $('coverage-range').textContent='DEC 2008 — '+month(data.asOf).toUpperCase();
 const p=program(modelProgram),m=models.models[modelProgram],b=m.backtest,last=m.forecast.at(-1),latest=p.observations.at(-1),outlook=percentageChange(last.value,latest.value);
 $('model-summary').innerHTML=stat('OUTLOOK · '+month(last.date).toUpperCase(),pretty(last.value,p.unit),`Historical error range ${pretty(last.lower,p.unit)}–${pretty(last.upper,p.unit)}`)+stat('AVERAGE PAST PREDICTION ERROR',number.format(b.mae),`${p.unit} · ${m.meanAbsolutePercentError.toFixed(1)}% average absolute error`)+stat('PROJECTED SIX-MONTH CHANGE',outlook===null?'—':pct(outlook),`Compared with ${month(latest.date)} published count`);
 const peak=m.forecast.reduce((a,o)=>o.value>a.value?o:a),low=m.forecast.reduce((a,o)=>o.value<a.value?o:a);
 $('forecast-insight').textContent=`The model projects ${outlook>=0?'an increase':'a decrease'} of ${number.format(Math.abs(last.value-latest.value))} ${p.unit.toLowerCase()} by ${month(last.date)}. The highest forecast in this six-month window is ${pretty(peak.value,p.unit)} in ${month(peak.date)}; the lowest is ${pretty(low.value,p.unit)} in ${month(low.date)}.`;
 $('training-description').textContent=`This ${p.name} model learns nine input weights from ${m.trainingTargets} months (${month(m.trainingStart)}–${month(m.trainingEnd)}). Ridge regularization strength is fixed at 1. Census characteristics, policy changes, and economic indicators are outside this forecast; the county analysis below uses Census data separately.`;
 renderWeights(m);renderCountyOutlook({countyModels,counties,p,colors,observe:o=>chartObservers.push(o),tip,hideTip,onCounty:openCounty,source});
 $('forecast-title').textContent=p.name+' · six-month outlook';
 const recent=p.observations.slice(-36),lastObserved=recent.at(-1);
 const flagged=m.anomalies.filter(a=>a.date>=recent[0].date);
 lineChart('forecast-chart',[{name:'Observed',values:recent,color:colors[0]},{name:'Ridge forecast',values:[lastObserved,...m.forecast],color:'var(--teal)',dash:'5 3'}],{unit:p.unit,zero:false,band:[{...lastObserved,lower:lastObserved.value,upper:lastObserved.value},...m.forecast],markers:flagged,height:350,endLabel:false});
 renderBacktest(b,p.unit);

 const anomalies=m.anomalies.slice(-6).reverse();
 $('anomaly-list').innerHTML=anomalies.length?anomalies.map(a=>{const o=p.observations.find(o=>o.date===a.date);return `<div class="anomaly-row"><div>${month(a.date)}<small>Expected ${number.format(a.expected)} · robust score ${a.score.toFixed(2)}<br><a href="${source(o)}" target="_blank" rel="noopener">Published source ↗</a></small></div><div><strong>${number.format(a.value)}</strong><div class="direction">${a.direction} expected</div></div></div>`;}).join(''):`<p class="empty">No residuals crossed the threshold after the model warm-up.</p>`;
}
function renderBacktest(b,unit){
 horizontalBars('backtest-chart',b.metrics.map(o=>({name:`${o.horizon} month${o.horizon===1?'':'s'} ahead`,value:o.mae,color:colors[0]})),{height:200,left:112,title:'Average past prediction error by lead time',unit,format:v=>number.format(Math.round(v))});
 $('backtest-caption').textContent=`Each bar averages 18 predictions from ${month(b.firstOrigin)}–${month(b.lastOrigin)} starting points. Error is the absolute difference between the predicted and actual count. Historical revisions are included.`;
}

function horizontalBars(container,rows,{height=null,left=100,title='',unit='Count',format=v=>number.format(v),log=false,signed=false}={}){
 const el=$(container);const draw=()=>{
  const width=el.clientWidth;if(!width)return;el.replaceChildren();
  const margin={left,right:68,top:32,bottom:38},plotHeight=(height||rows.length*26+70)-margin.top-margin.bottom,w=Math.max(1,width-margin.left-margin.right);
  const maximum=d3.max(rows,o=>Math.abs(o.value))||1;
  const x=log?d3.scaleLog().domain([1,maximum*1.2]).range([0,w]):d3.scaleLinear().domain(signed?[-maximum*1.15,maximum*1.15]:[0,maximum*1.08]).range([0,w]);
  const origin=log?0:x(0),y=d3.scaleBand().domain(rows.map(o=>o.name)).range([0,plotHeight]).padding(.28);
  const svg=d3.select(el).append('svg').attr('role','img').attr('aria-label',title).attr('viewBox',`0 0 ${width} ${plotHeight+margin.top+margin.bottom}`);
  svg.append('title').text(title);const g=svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`);
  g.append('g').attr('class','axis bar-labels').call(d3.axisLeft(y).tickFormat(v=>v==='Total'?'NJ state total':v).tickSize(0)).select('.domain').remove();
  const axis=d3.axisBottom(x).ticks(width<450?3:5).tickSizeOuter(0).tickFormat(v=>signed?v.toFixed(2):compact.format(v));
  if(log)axis.tickValues([1,10,100,1000,10000,100000].filter(v=>v<maximum*1.2));
  g.append('g').attr('class','axis').attr('transform',`translate(0,${plotHeight})`).call(axis);
  if(signed)g.append('line').attr('x1',origin).attr('x2',origin).attr('y1',0).attr('y2',plotHeight).attr('stroke','var(--muted)');
  for(const o of rows){const end=log?(o.value>0?x(o.value):0):x(o.value),html=o.tooltipHtml||`<strong>${o.fullName||o.name}</strong><div>${format(o.value)} ${o.unit||unit}</div>`;
   const row=g.append('g').attr('data-bar-row',o.id||o.name).attr('tabindex',0).attr('role',o.onClick?'button':'img').attr('aria-label',`${o.fullName||o.name}: ${format(o.value)} ${o.unit||unit}`);
   row.append('rect').attr('data-bar',o.id||o.name).attr('x',Math.min(origin,end)).attr('y',y(o.name)).attr('width',Math.abs(end-origin)).attr('height',y.bandwidth()).attr('fill',o.color||colors[0]).attr('opacity',o.opacity||1);
   row.append('text').attr('class','chart-value').attr('x',signed?w+10:end+5).attr('text-anchor','start').attr('y',y(o.name)+y.bandwidth()/2).attr('dominant-baseline','middle').text(format(o.value));
   row.append('rect').attr('data-bar-hit',o.id||o.name).attr('x',-left).attr('y',y(o.name)-2).attr('width',width).attr('height',y.bandwidth()+4).attr('fill','transparent');
   row.style('cursor',o.onClick?'pointer':'default').on('pointermove',e=>tip(e,html)).on('pointerleave',hideTip).on('focus',e=>{const r=e.target.getBoundingClientRect();tip({clientX:r.left,clientY:r.top},html);}).on('blur',hideTip).on('click',()=>{if(o.onClick)o.onClick();}).on('keydown',e=>{if(o.onClick&&(e.key==='Enter'||e.key===' ')){e.preventDefault();o.onClick();}});
   row.select('[data-bar-hit]').lower();
   g.selectAll('.bar-labels .tick').filter(name=>name===o.name).select('text').style('cursor',o.onClick?'pointer':'default').on('pointermove',e=>tip(e,html)).on('pointerleave',hideTip).on('click',()=>{if(o.onClick)o.onClick();});
  }
  g.selectAll('.axis').raise();
  svg.append('text').attr('class','axis-title').attr('x',margin.left).attr('y',15).text(width<450?(signed?'Model weight':unit.length>22?'Program units':unit):unit);
 };draw();const observer=new ResizeObserver(draw);observer.observe(el);chartObservers.push(observer);
}
function renderCaseload(){renderCaseloadLines({data,counties,colors,filtered,observe:o=>chartObservers.push(o),tip,hideTip,source});}
function censusCounty(name){return name==='Total'?censusState:census.counties.find(c=>c.county===name);}
function rateLabel(p){return p.id==='snap'?'Approx. household %':`${p.unit} per 100 households`;}
function renderCensusContext(p,s,value){
 const c=censusCounty(countyName),ratio=householdContext(value,c),rate=ratio.rate.toFixed(2);
 $('census-stats').innerHTML=stat(countyName==='Total'?'ESTIMATED NJ HOUSEHOLDS':'ESTIMATED COUNTY HOUSEHOLDS',number.format(c.households),`ACS 2020–2024 · ±${number.format(c.householdsMoe)} margin of error`)+stat(p.id==='snap'?'APPROX. SNAP HOUSEHOLD SHARE':'PROGRAM UNITS / 100 HOUSEHOLDS',rate+(p.id==='snap'?'%':''),p.id==='snap'?'DFD households ÷ ACS households':`${p.unit} ÷ ACS households × 100`)+(countyName==='Total'?'':stat('SHARE OF ALL NJ HOUSEHOLDS',(100*c.households/censusState.households).toFixed(2)+'%',`Of ${number.format(censusState.households)} estimated NJ households`))+stat('MEDIAN HOUSEHOLD INCOME','$'+number.format(c.medianIncome),'ACS estimate · 2024 inflation-adjusted dollars');
 $('census-reference-note').textContent=`DFD snapshot: ${month(s.date)}. Household reference: ACS 2020–2024, held fixed for all counties and dates. ${s.date<'2024-01'?'This snapshot predates the end of the Census period; the ratio is a comparison with a later household reference, not historical coverage. ':'The Census estimate is a five-year period estimate, not a household count for the selected month. '}Allowing only for the Census household margin of error gives ${ratio.lower.toFixed(2)}–${ratio.upper.toFixed(2)} ${p.id==='snap'?'percent':'units per 100 households'}; this range excludes DFD uncertainty and differences in household definitions.`;
 $('county-rate-title').textContent=`${p.name} · relative to estimated households`;
 $('county-rate-unit').textContent=`${rateLabel(p)} · ${month(s.date)} counts / ACS 2020–2024 households. NJ total: ${householdContext(s.total,censusState).rate.toFixed(2)}${p.id==='snap'?'%':' units / 100 households'}.`; 
 const row=v=>({id:v.county,name:v.county==='Total'?'NJ state total':v.county,value:householdContext(v.value,censusCounty(v.county)).rate,color:colors[data.programs.findIndex(o=>o.id===p.id)],opacity:v.county===countyName?1:.55,tooltipHtml:`<strong>${countyLabel(v.county)} · ${month(s.date)}</strong><div>${number.format(v.value)} ${p.unit.toLowerCase()}</div><div>${number.format(censusCounty(v.county).households)} estimated households</div><div>${householdContext(v.value,censusCounty(v.county)).rate.toFixed(2)} ${rateLabel(p).toLowerCase()}</div>`,onClick:()=>{countyName=v.county;render();}});
 const rows=[row({county:'Total',value:s.total}),...s.values.map(row).sort((a,b)=>b.value-a.value)];
 horizontalBars('county-rate-chart',rows,{left:100,title:`${p.name} normalized by Census household estimates for all 21 counties`,unit:rateLabel(p),format:v=>v.toFixed(2)+(p.id==='snap'?'%':'')});
}
function renderWeights(m){
 const labels=['Last month','2 months earlier','3 months earlier','6 months earlier','12 months earlier','3-month average','12-month average','Seasonal sine','Seasonal cosine'];
 const rows=m.learnedWeights.map((o,i)=>({name:labels[i],fullName:o.feature,value:o.coefficient,color:o.coefficient>=0?colors[0]:colors[1]}));
 horizontalBars('weights-chart',rows,{height:225,left:122,signed:true,title:'Learned signed weights in the ridge autoregression',unit:'Standardized input → log count',format:v=>(v>=0?'+':'')+v.toFixed(3)});
}
function openCounty(name){countyNavigationTarget=name;countyName=name;countyProgram=modelProgram;countyDate=data.asOf;location.hash='counties';}
function renderSources(){
 $('coverage-range').textContent='DEC 2008 — '+month(data.asOf).toUpperCase();
 const notes=new Map();for(const q of data.qualityNotes){if(q[3]==='GA published total differs from components')notes.set(q[2],q);}
 $('quality-notes').innerHTML=`<div class="quality-status">${notes.size} unique GA reporting months have totals that do not equal the listed component sum. These values are retained, not corrected.</div><ul class="quality-list">${[...notes].sort(([a],[b])=>a.localeCompare(b)).map(([d,q])=>`<li>${month(d)}: total ${number.format(q[4][4])}; components ${number.format(q[4][0]+q[4][2])}.</li>`).join('')}</ul>`;
 $('snapshot-date').textContent=`Source snapshot retrieved ${new Date(data.retrievedAt+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})}. Latest reporting month: ${month(data.asOf)}.`;
 const groups=d3.group(data.sources,s=>s.reportDate.slice(0,4));$('source-library').innerHTML=[...groups].sort(([a],[b])=>b.localeCompare(a)).map(([year,reports])=>`<div class="source-year"><h3>${year}</h3>${reports.sort((a,b)=>b.reportDate.localeCompare(a.reportDate)).map(s=>`<a href="${s.url}" target="_blank" rel="noopener">${month(s.reportDate)} report ↗</a>`).join('')}</div>`).join('');
}
function render(){destroyObservers();hideTip();hideDefinitions();const [kicker,title,desc]=titles[view];$('view-kicker').textContent=kicker;$('view-title').textContent=title;$('view-description').textContent=desc;document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==view+'-view');document.querySelectorAll('[data-view]').forEach(a=>{const current=a.dataset.view===view;a.classList.toggle('active',current);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});if(view==='trends')renderTrends();if(view==='compare')renderCompare();if(view==='counties')renderCounties();if(view==='models')renderModels();if(view==='sources')renderSources();addComponentDefinitions();defineTerms();}
function download(){const p=program(active),obs=filtered(p.observations,$('range').value);const rows=['period,value,unit,source_pdf,pdf_page,table',...obs.map(o=>[o.date,o.value,p.unit,source(o).split('#')[0],o.page,o.table].join(','))];const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`njcsv-${active}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function init(){try{if(!window.d3)throw new Error('Chart library unavailable');[data,models,counties,census,censusState,countyModels]=await Promise.all(['/data/programs.json','/data/models.json','/data/counties.json','/data/census.json','/data/census-state.json','/data/county-models.json'].map(async url=>{const r=await fetch(url);if(!r.ok)throw new Error('Could not load '+url);return r.json();}));$('loading').hidden=true;$('content').hidden=false;setupDefinitions();$('signal-threshold').addEventListener('change',render);$('download-signals').addEventListener('click',downloadSignals);$('model-program').innerHTML=data.programs.filter(p=>p.frequency==='monthly').map(p=>`<option value="${p.id}">${p.name}</option>`).join('');$('range').addEventListener('change',render);$('average').addEventListener('change',render);$('compare-range').addEventListener('change',render);$('caseload-scale').addEventListener('change',render);$('model-program').addEventListener('change',e=>{modelProgram=e.target.value;render();});$('download-csv').addEventListener('click',download);$('download-counties').addEventListener('click',downloadCounties);$('county-program').addEventListener('change',e=>{countyProgram=e.target.value;render();});$('county-date').addEventListener('change',e=>{countyDate=e.target.value;render();});$('county-name').addEventListener('change',e=>{countyName=e.target.value;render();});document.querySelector('[data-view="counties"]').addEventListener('click',()=>{countyName='Total';countyNavigationTarget=null;if(view==='counties')render();});window.addEventListener('hashchange',()=>{const next=titles[location.hash.slice(1)]?location.hash.slice(1):'trends';if(next==='counties'&&view!=='counties')countyName=countyNavigationTarget||'Total';countyNavigationTarget=null;view=next;render();});view=titles[location.hash.slice(1)]?location.hash.slice(1):'trends';render();}catch(err){$('loading').hidden=true;$('error').hidden=false;console.error(err);}}
$('reload').addEventListener('click',()=>location.reload());
init();
