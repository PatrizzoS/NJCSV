"""2015-2019 ACS vintage for time-respecting county forecast validation."""
from pathlib import Path
from urllib.request import urlopen,Request
from concurrent.futures import ThreadPoolExecutor
import csv,json,hashlib,sys
ROOT=Path(__file__).resolve().parent.parent
BASE='https://www2.census.gov/programs-surveys/acs/summary_file/2019/prototype/5YRData/'
CACHE=ROOT/'sources/census';CACHE.mkdir(parents=True,exist_ok=True)
current=json.loads((ROOT/'public/data/census.json').read_text(encoding='utf-8'))
names={c['fips']:c['county'] for c in current['counties']}
def read(table):
 name=f'acsdt5y2019-{table}.dat';path=CACHE/name
 if not path.exists() or '--download' in sys.argv:
  with urlopen(Request(BASE+name,headers={'User-Agent':'NJCSV Census research/1.0'}),timeout=90) as r:
   header=r.readline().decode('utf-8-sig').rstrip();rows=[]
   for line in r:
    text=line.decode('utf-8').rstrip();geo=text.split('|')[0]
    if geo.startswith('0500000US34') and geo[-5:] in names: rows.append(text)
    if len(rows)==21:break
  assert len(rows)==21
  path.write_text(header+'\n'+'\n'.join(rows)+'\n',encoding='utf-8')
 data=list(csv.DictReader(path.read_text(encoding='utf-8-sig').splitlines(),delimiter='|'))
 return table,data,{'table':table.upper(),'url':BASE+name,'extractSha256':hashlib.sha256(path.read_bytes()).hexdigest()}
rows={fips:{'fips':fips,'county':name} for fips,name in names.items()};sources=[]
with ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(read,['b11001','b17017','b19013','b25010']))
for table,data,source in results:
 sources.append(source)
 for r in data:
  c=rows[next(iter(r.values()))[-5:]]
  def v(col):
   value=float(r[col]);assert value>=0;return value
  if table=='b11001':c.update(households=int(v('B11001_E001')),householdsMoe=int(v('B11001_M001')))
  elif table=='b17017':c.update(povertyPct=100*v('B17017_E002')/v('B17017_E001'))
  elif table=='b19013':c.update(medianIncome=int(v('B19013_E001')))
  else:c.update(averageHouseholdSize=v('B25010_E001'))
out={'year':2019,'period':'2015–2019','availableFrom':'2021-03','sources':sources,'counties':list(rows.values()),
 'note':'The 2019 ACS release was published December 10, 2020. Validation conservatively uses this vintage from March 2021 onward; updated files may incorporate later revisions.'}
(ROOT/'public/data/census-history.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('Historical Census vintage:',len(rows),'NJ counties')
