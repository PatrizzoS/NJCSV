"""Official 2020-2024 ACS estimates, county normalization and unsupervised grouping.

Streams Census table-based Summary Files, retaining only all 21 NJ county rows.
No API key is required. No Census estimates are used by the time-series forecast.
"""
from pathlib import Path
from urllib.request import urlopen, Request
from concurrent.futures import ThreadPoolExecutor
import csv, json, hashlib, sys
import numpy as np

ROOT=Path(__file__).resolve().parent.parent
CACHE=ROOT/'sources'/'census'; CACHE.mkdir(parents=True,exist_ok=True)
BASE='https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/'
TABLES=['b11001','b17017','b19013','b25010']
COUNTIES=json.loads((ROOT/'public/data/counties.json').read_text(encoding='utf-8'))['counties']
FIPS={f'{2*i+1:03}':county for i,county in enumerate(COUNTIES)}

def get_table(table):
    filename=f'acsdt5y2024-{table}.dat'; dest=CACHE/filename
    if '--download' in sys.argv or not dest.exists():
        with urlopen(Request(BASE+filename,headers={'User-Agent':'NJCSV Census statistics/1.0'}),timeout=90) as response:
            header=response.readline().decode('utf-8-sig').rstrip('\r\n')
            selected=[]
            for line in response:
                text=line.decode('utf-8').rstrip('\r\n')
                geoid=text.split('|',1)[0]
                if geoid.startswith('0500000US34') and geoid[-3:] in FIPS:
                    selected.append(text)
                if len(selected)==21: break
        assert len(selected)==21,(table,'missing NJ county rows')
        dest.write_text(header+'\n'+'\n'.join(selected)+'\n',encoding='utf-8')
    rows=list(csv.DictReader(dest.read_text(encoding='utf-8-sig').splitlines(),delimiter='|'))
    assert len(rows)==21
    return table,rows,{'table':table.upper(),'url':BASE+filename,'extractSha256':hashlib.sha256(dest.read_bytes()).hexdigest()}

def cluster(x,k=3):
    """Lloyd k-means, 40 deterministic random restarts; smallest squared distance."""
    mean=x.mean(axis=0); scale=x.std(axis=0); scale[scale<1e-9]=1
    z=(x-mean)/scale; rng=np.random.default_rng(42); best=None
    for _ in range(40):
        centers=z[rng.choice(len(z),k,replace=False)].copy()
        for iteration in range(200):
            labels=np.argmin(((z[:,None,:]-centers[None,:,:])**2).sum(axis=2),axis=1)
            if len(set(labels))<k: break
            updated=np.array([z[labels==j].mean(axis=0) for j in range(k)])
            if np.max(abs(updated-centers))<1e-8:
                centers=updated; break
            centers=updated
        if len(set(labels))<k: continue
        inertia=float(((z-centers[labels])**2).sum())
        if best is None or inertia<best[0]: best=(inertia,labels.copy(),centers.copy())
    assert best is not None
    inertia,labels,centers=best
    # Stable group letters ordered by centroid poverty share, without value judgments.
    order=np.argsort(centers[:,0]); mapping={int(old):int(new) for new,old in enumerate(order)}
    labels=np.array([mapping[int(v)] for v in labels])
    centers=centers[order]
    return labels,{'method':'K-means clustering','k':k,'seed':42,'restarts':40,
                   'inertia':inertia,'featureMeans':mean.tolist(),'featureScales':scale.tolist(),
                   'standardizedCenters':centers.tolist(),'features':['Household poverty percentage','Log median household income','Average household size']}

def main():
    sources=[]; by_county={c:{'county':c,'fips':'34'+code} for code,c in FIPS.items()}
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(get_table,TABLES))
    for table,rows,source in results:
        sources.append(source)
        for r in rows:
            geoid=r.get('GEO_ID') or r.get('GEOID') or next(iter(r.values()))
            c=by_county[FIPS[geoid[-3:]]]
            def value(field):
                v=float(r[field]); assert np.isfinite(v) and v>=0,(table,field,r)
                return int(v) if v==int(v) else v
            if table=='b11001': c.update(households=value('B11001_E001'),householdsMoe=value('B11001_M001'))
            elif table=='b17017': c.update(povertyUniverse=value('B17017_E001'),povertyHouseholds=value('B17017_E002'),povertyHouseholdsMoe=value('B17017_M002'))
            elif table=='b19013': c.update(medianIncome=value('B19013_E001'),medianIncomeMoe=value('B19013_M001'))
            else: c.update(averageHouseholdSize=value('B25010_E001'))
    rows=[by_county[c] for c in COUNTIES]
    for c in rows:
        assert c['households']>c['householdsMoe']>=0
        assert 0<=c['povertyHouseholds']<=c['povertyUniverse']
        c['povertyPct']=100*c['povertyHouseholds']/c['povertyUniverse']
    x=np.array([[c['povertyPct'],np.log(c['medianIncome']),c['averageHouseholdSize']] for c in rows])
    labels,method=cluster(x)
    for c,label in zip(rows,labels): c['group']=chr(65+int(label))
    groups=[]
    for label in ['A','B','C']:
        members=[c for c in rows if c['group']==label]
        groups.append({'id':label,'counties':[c['county'] for c in members],
                       'households':sum(c['households'] for c in members),
                       'povertyPct':100*sum(c['povertyHouseholds'] for c in members)/sum(c['povertyUniverse'] for c in members),
                       'meanCountyMedianIncome':float(np.mean([c['medianIncome'] for c in members]))})
    out={'year':2024,'period':'2020–2024','survey':'American Community Survey 5-year estimates',
         'retrievedAt':'2026-10-03','sources':sources,'counties':rows,'grouping':{**method,'groups':groups},
         'notes':['Five-year period estimates, not a count for June 2026. Fixed 2020–2024 reference for all county snapshot dates.',
                  'SNAP administrative households and ACS households have different definitions; their ratio is approximate.',
                  'Other program counts are families/cases, so ratios are units per 100 households, not the percent of households served.',
                  'Published household margins of error are 90% confidence margins. They do not include DFD reporting uncertainty.',
                  'Grouping uses Census features only, without participation data. Groups are exploratory and are not forecast inputs.']}
    (ROOT/'public/data/census.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
    print('Official Census county estimates:',len(rows),'Groups:',[(g['id'],len(g['counties'])) for g in groups])

if __name__=='__main__': main()
