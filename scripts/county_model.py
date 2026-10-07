"""Pooled quarterly county ridge growth forecasting with as-of Census vintages.

Forecasts are exploratory caseload projections, never causal policy predictions.
The primary statewide monthly models remain independent of this county model.
"""
from pathlib import Path
import json,math
import numpy as np
ROOT=Path(__file__).resolve().parent.parent
def read(name):return json.loads((ROOT/f'public/data/{name}.json').read_text(encoding='utf-8'))
def demographic(census):
 rows=census['counties']; income=float(np.mean([np.log(c['medianIncome']) for c in rows]))
 return {c['county']:[np.log(c['households']),np.log(c['medianIncome'])-income,c['averageHouseholdSize']] for c in rows}

def vector(history,quarter,demo,households,with_census=True):
 logs=np.log1p(history)
 base=[logs[-1]-logs[-2],logs[-1]-logs[-5],float(np.mean(np.diff(logs[-4:]))),math.sin(2*math.pi*quarter/4),math.cos(2*math.pi*quarter/4)]
 # Household exposure and county characteristics enter the actual fitted model.
 return base+[logs[-1]-np.log(households),*demo] if with_census else base

def fit(x,y,alpha=10):
 x=np.array(x,float);y=np.array(y,float);mean=x.mean(axis=0);scale=x.std(axis=0);scale[scale<1e-9]=1
 z=np.column_stack([np.ones(len(x)),(x-mean)/scale]);penalty=np.eye(z.shape[1])*alpha;penalty[0,0]=0
 beta=np.linalg.solve(z.T@z+penalty,z.T@y)
 return mean,scale,beta

def vintage(date,current,old):return current if date>='2026-03' else old

def training(program,origin,current,old,with_census=True):
 dates=[s['date'] for s in program['snapshots']];series={c['county']:[s['values'][i]['value'] for s in program['snapshots']] for i,c in enumerate(current['counties'])}
 x=[];y=[];sample_dates=[]
 for t in range(max(5,origin-16),origin):
  if dates[t]<'2021-03':continue
  cv=vintage(dates[t],current,old);demo=demographic(cv);counts={c['county']:c for c in cv['counties']}
  for county,values in series.items():
   x.append(vector(values[:t+1],int(dates[t][5:])//3,demo[county],counts[county]['households'],with_census))
   y.append(np.log1p(values[t+1])-np.log1p(values[t]));sample_dates.append(dates[t+1])
 assert len(x)>=105
 return fit(x,y),series,len(x),sample_dates

def predict(program,origin,current,old,with_census=True,horizon=2):
 model,series,n,targets=training(program,origin,current,old,with_census)
 mean,scale,beta=model;origin_date=program['snapshots'][origin]['date'];cv=vintage(origin_date,current,old);demo=demographic(cv);hh={c['county']:c['households'] for c in cv['counties']};forecasts={}
 for county,values in series.items():
  history=list(values[:origin+1]);forecast=[]
  for h in range(horizon):
   quarter=(int(origin_date[5:])//3-1+h)%4+1
   f=vector(history,quarter,demo[county],hh[county],with_census)
   growth=float(np.r_[1,(f-mean)/scale]@beta)
   value=float(max(0,np.expm1(np.log1p(history[-1])+growth)))
   assert np.isfinite(value)
   forecast.append(round(value));history.append(value)
  forecasts[county]=forecast
 return forecasts,{'trainingSamples':n,'trainingLastTarget':max(targets),'trainingFirstTarget':min(targets),'censusYear':cv['year'],'weights':beta[1:].tolist()}

def analyze(program,current,old):
 snapshots=program['snapshots'];n=len(snapshots);traces=[]
 for origin in range(n-10,n-2):
  forecasts,fit_info=predict(program,origin,current,old);without,_=predict(program,origin,current,old,False)
  for county,values in forecasts.items():
   for h,value in enumerate(values):
    target=snapshots[origin+h+1];actual=next(v['value'] for v in target['values'] if v['county']==county)
    traces.append({'origin':snapshots[origin]['date'],'target':target['date'],'county':county,'horizon':h+1,'actual':actual,'predicted':value,'withoutCensus':without[county][h],**{k:fit_info[k] for k in ['censusYear','trainingLastTarget']}})
 forecasts,fit_info=predict(program,n-1,current,old)
 errors=np.array([t['predicted']-t['actual'] for t in traces]);no_errors=np.array([t['withoutCensus']-t['actual'] for t in traces]);mae=float(np.mean(abs(errors)));no_mae=float(np.mean(abs(no_errors)))
 years,month=map(int,snapshots[-1]['date'].split('-'));future=[]
 for h in [1,2]:
  total=years*12+month-1+3*h;future.append(f'{total//12:04}-{total%12+1:02}')
 by_county=[]
 for c in current['counties']:
  county=c['county'];actual=next(v['value'] for v in snapshots[-1]['values'] if v['county']==county)
  projected=[]
  for h,(d,v) in enumerate(zip(future,forecasts[county])):
   errors=[np.log1p(t['actual'])-np.log1p(t['predicted']) for t in traces if t['county']==county and t['horizon']==h+1]
   scenarios=[max(0,round(float(np.expm1(np.log1p(v)+e)))) for e in errors]
   assert len(scenarios)==8
   projected.append({'date':d,'value':v,'per100Households':100*v/c['households'],'scenarios':scenarios,
                     'lower':min(v,round(float(np.quantile(scenarios,.1)))),'upper':max(v,round(float(np.quantile(scenarios,.9))))})
  by_county.append({'county':county,'observed':actual,'households':c['households'],'forecast':projected})
 return {'model':'Pooled county ridge growth model','alpha':10,'frequency':'quarterly','asOf':snapshots[-1]['date'],**fit_info,'counties':by_county,
  'validation':{'origins':8,'predictions':traces,'mae':mae,'withoutCensusMae':no_mae,'censusErrorReductionPct':100*(1-mae/no_mae)},
  'features':['Last-quarter log growth','Year-over-year log growth','Average recent log growth','Quarter seasonality sine','Quarter seasonality cosine','Log cases relative to households','Log household count','Relative log median income','Average household size']}

if __name__=='__main__':
 current=read('census');old=read('census-history');data=read('counties')
 models={p['id']:analyze(p,current,old) for p in data['programs'] if p['id']!='childSupport'}
 out={'asOf':data['asOf'],'models':models,'notes':['Census 2015–2019 is used for origins from March 2021 through December 2025; Census 2020–2024 is used from March 2026. Forecast vintages stay fixed at the forecast origin.',
 'Validation uses revised administrative histories and potentially revised Census extracts; it is not a reconstruction of exact real-time data vintages.',
 'Two-quarter county predictions are independent of the statewide monthly forecast. Differences between their totals are expected. No causal or eligibility inference is made.']}
 (ROOT/'public/data/county-models.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
 for id,m in models.items():print(id,'MAE',round(m['validation']['mae'],2),'Census error reduction',round(m['validation']['censusErrorReductionPct'],1))
