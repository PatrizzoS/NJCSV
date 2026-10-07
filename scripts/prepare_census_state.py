"""Official NJ state estimates, including a state median rather than county medians."""
from pathlib import Path
from urllib.request import urlopen,Request
from concurrent.futures import ThreadPoolExecutor
import csv,json,hashlib
ROOT=Path(__file__).resolve().parent.parent;CACHE=ROOT/'sources/census';CACHE.mkdir(parents=True,exist_ok=True)
BASE='https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/'
def read(table):
 name=f'acsdt5y2024-{table}.dat';dest=CACHE/(name+'.state')
 if not dest.exists():
  with urlopen(Request(BASE+name,headers={'User-Agent':'NJCSV Census research/1.0'}),timeout=90) as r:
   header=r.readline().decode('utf-8-sig').rstrip();selected=None
   for line in r:
    text=line.decode('utf-8').rstrip()
    if text.split('|')[0]=='0400000US34':selected=text;break
  assert selected is not None
  dest.write_text(header+'\n'+selected+'\n',encoding='utf-8')
 row=list(csv.DictReader(dest.read_text(encoding='utf-8').splitlines(),delimiter='|'))[0]
 return table,row,{'table':table.upper(),'url':BASE+name,'extractSha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
state={'county':'Total','name':'New Jersey total','period':'2020–2024','sources':[]}
with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(read,['b11001','b17017','b19013','b25010']))
for table,r,s in results:
 state['sources'].append(s)
 def v(col):
  num=float(r[col]);assert num>=0;return int(num) if num==int(num) else num
 if table=='b11001':state.update(households=v('B11001_E001'),householdsMoe=v('B11001_M001'))
 elif table=='b17017':state.update(povertyUniverse=v('B17017_E001'),povertyHouseholds=v('B17017_E002'))
 elif table=='b19013':state.update(medianIncome=v('B19013_E001'),medianIncomeMoe=v('B19013_M001'))
 else:state.update(averageHouseholdSize=v('B25010_E001'))
state['povertyPct']=100*state['povertyHouseholds']/state['povertyUniverse']
(ROOT/'public/data/census-state.json').write_text(json.dumps(state,indent=2),encoding='utf-8')
print('NJ Census households:',state['households'],'median income:',state['medianIncome'])
