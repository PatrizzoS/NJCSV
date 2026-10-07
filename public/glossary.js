const cps='https://www.nj.gov/humanservices/dfd/news/reports/pdf/cps/2026/CPS_June2026.pdf';
const acs='https://www.census.gov/data/developers/data-sets/acs-5year.html';
export const definitions={
 'NJCSV':['New Jersey Civil Statistics Visualizations','An independent visualization project using public administrative and Census data.'],
 'CPS':['Current Program Statistics','DFD’s monthly program report. The site uses selected published reports and links each value to its source.',cps],
 'SNAP':['Supplemental Nutrition Assistance Program','Food assistance. DFD participation tables count administrative households and people; those household definitions can differ from Census households.',cps+'#page=10'],
 'TANF':['Temporary Assistance for Needy Families','The program series here counts eligible families, rather than unique people.',cps+'#page=5'],
 'WFNJ':['Work First New Jersey','New Jersey’s cash-assistance program, including TANF for families and General Assistance for single adults and couples without dependent children.','https://nj.gov/humanservices/wfnj/'],
 'GA':['General Assistance','The reported caseload for General Assistance. Older reports say persons; later reports say cases. Long-term comparisons need care.',cps+'#page=15'],
 'EA':['Emergency Assistance','Housing and shelter-related assistance. These charts compare published TANF EA families and GA EA cases with reported parent-program caseloads. They are not percentages of unique people. SSI-related EA is outside the combined ratio.','https://nj.gov/humanservices/wfnj/recipients/stay/'],
 'SSI':['Supplemental Security Income','A federal income-support program. SSI-related EA counts are separate from the TANF/GA EA comparison.','https://www.ssa.gov/ssi'],
 'ACS':['American Community Survey','A Census Bureau survey. A five-year estimate combines responses across a five-year period; it is not a count for one particular month.',acs],
 'SDW':['Shared Data Warehouse','The data source identified in DFD’s reporting-conversion note.',cps+'#page=5'],
 'MMIS':['Medicaid Management Information System','The system name used in DFD’s phrase “NJ MMIS Shared Data Warehouse Issuance files.”',cps+'#page=5'],
 'reporting source changed':['July 2013 reporting change','DFD’s exact note: “Effective July 2013 this data query source was converted to the SDW”. This documents a source change; it does not quantify an effect on the caseload or establish an eligibility change.',cps+'#page=5'],
 'query conversion':['July 2013 reporting change','DFD’s exact note: “Effective July 2013 this data query source was converted to the SDW”. Compare across that date with care.',cps+'#page=5'],
 'ML':['Machine learning','Methods that fit patterns from examples. A forecast is a statistical estimate, not a statement of what must happen.'],
 'AI':['Artificial intelligence','A broad term for computational methods that perform prediction, pattern recognition or structured judgments.'],
 'USD':['United States dollars','Child Support collection dollars are nominal: they have not been adjusted for inflation.'],
 'FFY':['Federal fiscal year','The federal fiscal year runs from October 1 through September 30. Child Support quarter-end dates are taken from the report.'],
 'JSON':['JavaScript Object Notation','A structured data download containing observations, calculations and model results.'],
 'ridge autoregression':['Ridge autoregression','Supervised forecasting that predicts a series from its earlier values, while penalizing large fitted weights to reduce overfitting.'],
 'ridge regression':['Ridge regression','A regression model with a penalty on large weights. The penalty strength is fixed before the reported evaluations.'],
 'autoregression':['Autoregression','Predicting a time series using earlier values of that same series.'],
 'supervised learning':['Supervised learning','Training on examples that contain both inputs and an observed target, such as earlier counts and the next reported count.'],
 'unsupervised learning':['Unsupervised learning','Finding structure without a target answer, such as grouping counties by similarity.'],
 'pooled county model':['Pooled county model','One regression learns from multiple counties together. Here it predicts quarterly proportional caseload changes using prior counts and Census features.'],
 'pooled':['Pooled data','Examples from different counties are combined to train one shared model. This does not combine recipients into unique people.'],
 'forecast':['Forecast','A prediction based on fitted patterns. Monthly statewide and quarterly county forecasts are separate models and need not sum to the same total.'],
 'recursive forecasting':['Recursive forecasting','Using a predicted value as an input to predict the following period. Errors can accumulate with each step.'],
 'rolling time validation':['Rolling time validation','Repeatedly fitting on earlier dates and testing on later dates. Future targets remain outside each training fit.'],
 'validation':['Validation','Checking predictions against observed data that was excluded from the training fit.'],
 'regularization':['Regularization','A penalty that restrains model weights. It can reduce fitting to noise, but does not guarantee an accurate forecast.'],
 'overfitting':['Overfitting','Learning accidental patterns in the training sample that do not hold on later or different data.'],
 'standardized':['Standardized inputs','Subtracting the training average and dividing by the training standard deviation so inputs use comparable scales.'],
 'log-transformed':['Log-transformed counts','The model works with log(1 + count), which emphasizes proportional changes and handles zeros. Predictions are converted back to counts.'],
 'log scale':['Logarithmic scale','Equal distances represent equal ratios rather than equal count differences.'],
 'seasonality':['Seasonality','Patterns associated with the time of year. The model includes smooth annual sine/cosine signals.'],
 'sine':['Sine feature','One smooth repeating component used with cosine to represent seasonality.'],
 'cosine':['Cosine feature','A repeating component offset from sine; together they represent seasonal timing.'],
 'weight':['Model weight','A fitted coefficient describing how an input changes the model prediction, holding other inputs fixed. It is not a causal effect.'],
 'weights':['Model weights','Fitted coefficients, rather than causal explanations or a ranking of real-world importance.'],
 'coefficient':['Coefficient','A learned numerical weight in a regression equation.'],
 'anomaly detection':['Anomaly detection','Identifying observations that depart unusually from a learned pattern. A flag is not a finding of fraud or a proven reporting error.'],
 'residual':['Residual','The difference between an observation and its model prediction.'],
 'median absolute deviation':['Median absolute deviation','A robust measure of typical distance from the median. It is less sensitive to extreme observations than the standard deviation.'],
 'robust score':['Robust score','A prediction error measured against the median and median absolute deviation of earlier errors.'],
 'median household income':['Median household income','The income level dividing households into two equal halves. State totals use the published state median, not an average of county medians.','https://data.census.gov/table/ACSDT5Y2024.B19013'],
 'household poverty':['Census-defined household poverty','The published B17017 household measure, defined by Census income thresholds. It is not inferred from SNAP participation.','https://api.census.gov/data/2024/acs/acs5/groups/B17017.html'],
 'margin of error':['Margin of error','Census’s published uncertainty around a survey estimate. The site’s household-ratio range uses denominator uncertainty only; it does not include administrative reporting error.',acs],
 'nominal':['Nominal dollars','Dollar amounts at the time reported, without inflation adjustment.'],
 'caseload':['Caseload','The program’s reported administrative units: households, families or cases depending on the table. It is not automatically a count of people.'],
 'blended ratio':['Blended administrative-unit ratio','(TANF EA families + GA EA cases) divided by (TANF families + GA cases), times 100. This mixes administrative units and is not a percentage of unique people.'],
 'scenario':['Scenario','A possible value formed by applying a historical forecast error to the current forecast. This is exploratory, rather than a policy-effect simulation.'],
 'scenarios':['Scenarios','Eight error-adjusted forecast paths, one for each past validation starting point. Frequencies are not calibrated probabilities.'],
 'calibrated':['Calibrated probabilities','Probabilities whose stated levels agree with observed event frequencies on representative held-out examples. NJCSV’s eight-scenario frequencies have not established this calibration.'],
 'planning signals':['Statistical planning signals','A fixed set of categories with explicit evidence: review_increase, review_decrease, mixed_scenarios or insufficient_reference. These are review prompts, not funding or eligibility decisions.'],
 'threshold':['Threshold','The percentage change you choose for the planning question. Changing it changes the question, rather than changing the learned forecast.'],
 'treemap':['Treemap','Rectangles sized by a quantity. In the county outlook quilt, area shows current caseload and color shows projected proportional change.'],
 'heatmap':['Heatmap','A grid whose colors encode values. Here it shows actual county changes over time; missing or undefined ratios are marked with a dash.'],
 'MAE':['Mean absolute error','The average absolute difference between predicted and observed counts. Smaller errors indicate closer past predictions.'],
 'source vintage':['Source vintage','The Census release available at a forecast starting point. Later Census releases stay outside earlier validation fits.']
};
let box,hideTimer;
const programTerms=new Set(['SNAP','TANF','WFNJ','GA','EA','SSI']);
const excluded='a,button,summary,label,select,option,input,textarea,header,.brand,nav';
export function addComponentDefinitions(){
 document.querySelectorAll('.component-definitions').forEach(el=>el.remove());
 document.querySelectorAll('.chart-panel,.mini').forEach(panel=>{
  // Collect the component's own content, including its legend, but not nested components.
  const walker=document.createTreeWalker(panel,NodeFilter.SHOW_TEXT),parts=[];
  while(walker.nextNode()){const node=walker.currentNode,parent=node.parentElement;if(parent.closest('.chart-panel,.mini')===panel&&!parent.closest('select,option'))parts.push(node.textContent);}
  const text=parts.join(' ');
  const terms=[...programTerms].filter(key=>new RegExp('\\b'+key+'\\b','i').test(text)||text.includes(definitions[key][0]));
  if(!terms.length)return;
  const footer=document.createElement('p');footer.className='component-definitions';
  footer.textContent='Program definitions: '+terms.map(key=>key+' — '+definitions[key][0]).join('; ')+'.';panel.append(footer);
 });
}
function permitted(term,parent){
 if(parent.closest(excluded))return false;
 if(term==='NJCSV')return !!parent.closest('footer');
 if(programTerms.has(term))return !!parent.closest('.component-definitions,.chart-footer,.chart-panel .notice,footer');
 return true;
}
function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function hide(){if(box)box.hidden=true;}
export function hideDefinitions(){clearTimeout(hideTimer);hide();}
function show(el){
 clearTimeout(hideTimer);box=document.getElementById('definition-tooltip');const d=definitions[el.dataset.term];if(!box||!d)return;
 box.innerHTML=`<strong>${escape(d[0])}</strong><p>${escape(d[1])}</p>${d[2]?`<a href="${d[2]}" target="_blank" rel="noopener">Read the source ↗</a>`:''}`;box.hidden=false;
 const r=el.getBoundingClientRect(),b=box.getBoundingClientRect();box.style.left=Math.max(8,Math.min(r.left,innerWidth-b.width-8))+'px';box.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-b.height-8))+'px';
}
export function defineTerms(root=document.body){
 const keys=Object.keys(definitions).sort((a,b)=>b.length-a.length),regex=new RegExp('\\b('+keys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')\\b','gi');
 const lookup=new Map(keys.map(k=>[k.toLowerCase(),k]));const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
 while(walker.nextNode()){const node=walker.currentNode,p=node.parentElement;if(!p||p.closest('script,style,svg,code,.glossary-term,#definition-tooltip,#tooltip,[hidden],'+excluded))continue;regex.lastIndex=0;if(regex.test(node.textContent))nodes.push(node);}
 for(const node of nodes){const fragment=document.createDocumentFragment();let end=0;regex.lastIndex=0;
  for(const match of node.textContent.matchAll(regex)){fragment.append(node.textContent.slice(end,match.index));const term=lookup.get(match[0].toLowerCase());if(permitted(term,node.parentElement)){const span=document.createElement('span');span.className='glossary-term';span.dataset.term=term;span.textContent=match[0];span.tabIndex=0;span.setAttribute('aria-describedby','definition-tooltip');fragment.append(span);}else fragment.append(match[0]);end=match.index+match[0].length;}
  fragment.append(node.textContent.slice(end));node.replaceWith(fragment);
 }
 // Chart annotations are explicitly marked because SVG text is not rewritten.
 document.querySelectorAll('[data-term]').forEach(el=>{if(el.dataset.definitionBound)return;el.dataset.definitionBound='true';el.addEventListener('pointerenter',()=>show(el));el.addEventListener('pointerleave',()=>{hideTimer=setTimeout(hide,160);});el.addEventListener('focus',()=>show(el));el.addEventListener('blur',()=>{hideTimer=setTimeout(hide,160);});el.addEventListener('click',e=>{if(!el.closest('button,a,summary')){e.stopPropagation();show(el);}});});
}
export function setupDefinitions(){
 box=document.getElementById('definition-tooltip');box.addEventListener('pointerenter',()=>clearTimeout(hideTimer));box.addEventListener('pointerleave',hide);box.addEventListener('focusin',()=>clearTimeout(hideTimer));box.addEventListener('focusout',()=>{hideTimer=setTimeout(hide,160);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});document.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-term],#definition-tooltip'))hide();});
 document.addEventListener('click',e=>{const link=e.target.closest('[data-footnote]');if(link){e.preventDefault();document.getElementById(link.dataset.footnote)?.scrollIntoView({behavior:'smooth',block:'start'});}});
}
