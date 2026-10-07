"""Regularized autoregression and causal, rolling residual anomaly detection.

Uses only NumPy; no network calls or model service. All predictions at origin t
are fitted using observations strictly before t. Model parameters are fixed.
"""
from pathlib import Path
import json, math
import numpy as np

def features(logs, t):
    return [logs[t-k] for k in [1,2,3,6,12]] + [float(np.mean(logs[t-3:t])),float(np.mean(logs[t-12:t])),math.sin(2*math.pi*t/12),math.cos(2*math.pi*t/12)]

def fit(values):
    logs=np.log1p(np.array(values,dtype=float))
    assert len(logs)>=36 and np.isfinite(logs).all()
    start=max(12,len(logs)-84)
    x=np.array([features(logs,t) for t in range(start,len(logs))])
    y=logs[start:]
    mean=x.mean(axis=0); scale=x.std(axis=0); scale[scale<1e-9]=1
    z=np.column_stack([np.ones(len(x)),(x-mean)/scale])
    penalty=np.eye(z.shape[1]); penalty[0,0]=0
    beta=np.linalg.solve(z.T@z+penalty,z.T@y)
    return logs,start,mean,scale,beta

def fit_predict(values, horizon=6):
    logs,start,mean,scale,beta=fit(values)
    future=list(logs)
    for _ in range(horizon):
        f=np.array(features(future,len(future)))
        future.append(float(max(0,np.r_[1,(f-mean)/scale]@beta)))
    return np.expm1(future[-horizon:])

def add_month(date, n):
    y,m=map(int,date.split('-')); total=y*12+m-1+n
    return f'{total//12:04}-{total%12+1:02}'

def analyze(obs):
    values=np.array([o['value'] for o in obs],float); n=len(values); horizon=6
    # 18 past origins, each with all six future months observed.
    origins=range(n-horizon-17,n-horizon+1)
    results=[]; log_errors=[]; horizon_errors=[[] for _ in range(horizon)]
    baseline_errors=[[] for _ in range(horizon)]
    traces=[]
    for origin in origins:
        prediction=fit_predict(values[:origin],horizon)
        actual=values[origin:origin+horizon]
        baseline=values[origin-12:origin-12+horizon]
        log_errors.append(np.log1p(actual)-np.log1p(prediction))
        for h in range(horizon):
            horizon_errors[h].append(abs(prediction[h]-actual[h]))
            baseline_errors[h].append(abs(baseline[h]-actual[h]))
            traces.append({'origin':obs[origin-1]['date'],'target':obs[origin+h]['date'],'horizon':h+1,'actual':int(actual[h]),'predicted':round(float(prediction[h])),'baseline':int(baseline[h])})
    predicted=fit_predict(values,horizon)
    quantiles=np.quantile(np.array(log_errors),[0.1,0.9],axis=0)
    forecast=[{'date':add_month(obs[-1]['date'],h+1),'value':round(float(p)),
               'lower':max(0,round(float(np.expm1(np.log1p(p)+min(quantiles[0,h],0))))),
               'upper':round(float(np.expm1(np.log1p(p)+max(quantiles[1,h],0))))}
              for h,p in enumerate(predicted)]
    errors=[]; anomalies=[]
    for t in range(48,n):
        pred=float(fit_predict(values[:t],1)[0])
        residual=float(np.log1p(values[t])-np.log1p(pred))
        previous=np.array(errors[-36:])
        if len(previous)>=24:
            median=float(np.median(previous)); mad=float(np.median(abs(previous-median)))
            score=(residual-median)/max(1.4826*mad,0.005)
            if abs(score)>=3.5:
                anomalies.append({'date':obs[t]['date'],'value':int(values[t]),'expected':round(pred),'score':round(score,2),'direction':'above' if score>0 else 'below'})
        errors.append(residual)
    metrics=[{'horizon':h+1,'mae':round(float(np.mean(horizon_errors[h]))),'baselineMae':round(float(np.mean(baseline_errors[h])))} for h in range(horizon)]
    model_mae=round(float(np.mean(horizon_errors))); baseline_mae=round(float(np.mean(baseline_errors)))
    logs,start,mean,scale,beta=fit(values)
    labels=['Previous month','2 months earlier','3 months earlier','6 months earlier','12 months earlier','Recent 3-month average','Recent 12-month average','Annual seasonality · sine','Annual seasonality · cosine']
    weights=[{'feature':label,'coefficient':float(weight)} for label,weight in zip(labels,beta[1:])]
    percent_errors=[100*abs(t['actual']-t['predicted'])/t['actual'] for t in traces if t['actual']>0]
    return {'model':'Ridge autoregression','alpha':1,'trainingWindow':84,'seasonalPeriod':12,
            'learnedWeights':weights,'trainingTargets':n-start,
            'meanAbsolutePercentError':float(np.mean(percent_errors)),
            'trainingStart':obs[max(12,n-84)]['date'],'trainingEnd':obs[-1]['date'],
            'backtest':{'originCount':18,'firstOrigin':obs[n-horizon-18]['date'],'lastOrigin':obs[n-horizon-1]['date'],
                        'mae':model_mae,'baselineMae':baseline_mae,'improvementPct':round(100*(1-model_mae/baseline_mae),1),
                        'metrics':metrics,'predictions':traces},'forecast':forecast,'anomalies':anomalies}

if __name__=='__main__':
    root=Path(__file__).resolve().parent.parent
    data=json.loads((root/'public/data/programs.json').read_text(encoding='utf-8'))
    models={p['id']:analyze(p['observations']) for p in data['programs'] if p['frequency']=='monthly'}
    (root/'public/data/models.json').write_text(json.dumps({'asOf':data['asOf'],'models':models},indent=2),encoding='utf-8')
    for key,m in models.items(): print(key,'MAE',m['backtest']['mae'],'baseline',m['backtest']['baselineMae'],'anomalies',len(m['anomalies']))
