"""Extract published statewide tables, preserving PDF provenance and revisions."""
from pathlib import Path
from datetime import date as today_date
import re, json, hashlib
ROOT = Path(__file__).resolve().parent.parent
MONTHS = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split()
links = {}
for name in ['cps.shtml', 'cps_archives.shtml']:
    for path in re.findall(r'href="([^"]+\.pdf)"', (ROOT/'sources'/name).read_text(encoding='utf-8')):
        links[path.split('/')[-1].lower()] = 'https://www.nj.gov'+path
def report_date(name):
    url=links[name.lower()]
    year=int(re.search(r'/cps/(\d{4})/',url)[1])
    month=3 if 'mar' in name.lower() else 6 if 'jun' in name.lower() else 9 if 'sep' in name.lower() else 12
    return f'{year:04}-{month:02}'
def clean(s):
    s=re.sub(r'(?<=\d)\s+(?=,)', '',s)
    s=re.sub(r'(?<=,)\s+(?=\d)', '',s)
    s=re.sub(r'(?<=\d)\s+(?=\.\d)', '',s)
    s=re.sub(r'\(\s+', '(',s)
    s=re.sub(r'(?<![\d.,])([1-9])\s+(\d{1,2},\d{3})(?!\d)',r'\1\2',s)
    s=re.sub(r'(?<![\d.,])([1-9])\s+(\d{2})(?![\d.,%])',r'\1\2',s)
    return s
def numbers(s):
    return [float(x.replace(',','').replace('%','').replace('(','-').replace(')','')) for x in re.findall(r'\(?-?\d[\d,]*(?:\.\d+)?%?\)?',clean(s))]
records={}; warnings=[]; sources={}; child={}
files=[p for p in (ROOT/'sources').glob('*.txt') if p.with_suffix('.pdf').exists() and report_date(p.with_suffix('.pdf').name)>='2010-01']
latest_name=max(files,key=lambda p:report_date(p.with_suffix('.pdf').name)).with_suffix('.pdf').name
as_of=report_date(latest_name)
for path in sorted(files,key=lambda p:report_date(p.with_suffix('.pdf').name)):
    name=path.with_suffix('.pdf').name
    published=report_date(name)
    sources[name]={'id':name,'url':links[name.lower()],'reportDate':published,'sha256':hashlib.sha256(path.with_suffix('.pdf').read_bytes()).hexdigest()}
    pages=re.split(r'=== PAGE (\d+) ===',path.read_text(encoding='utf-8'))
    for page_no,txt in zip(pages[1::2],pages[2::2]):
        found=re.search(r'(?im)^\s*TABLE\s+(1|5|8|10)\s*(?::|\s|$)',txt)
        if found and int(page_no)>2 and ('dec' in name.lower() or name==latest_name):
            table=int(found[1]); year=None; row_count=0
            for line in txt.splitlines():
                match=re.match(r'^\s*(?:(\d{4})\s*)?('+'|'.join(MONTHS)+r')\s+(.+)$',line)
                if not match: continue
                if match[1]: year=int(match[1])
                if year is None: raise ValueError(f'Unknown year {name}, table {table}')
                date=f'{year:04}-{MONTHS.index(match[2])+1:02}'
                n=numbers(match[3]); row_count+=1
                try:
                    if table==1:
                        assert len(n)==11, n
                        vals={'tanf':n[5],'tanfPersons':n[7],'tanfAdults':n[9],'tanfChildren':n[10],'tanfChildOnly':n[2]}
                        if n[3]+n[4]!=n[5] or n[9]+n[10]!=n[7]: warnings.append([name,table,date,'TANF component mismatch',n])
                    elif table==5:
                        assert len(n) in [8,10], n
                        vals={'snap':n[2],'snapPersons':n[6],'snapAdults':n[4],'snapChildren':n[5]}
                        if n[4]+n[5]!=n[6]: warnings.append([name,table,date,'SNAP persons component mismatch',n])
                    elif table==8:
                        assert len(n)==10,n
                        vals={'tanfEA':n[0]}
                    else:
                        assert len(n)==10,n
                        vals={'ga':n[4],'gaEA':n[8]}
                        if n[0]+n[2]!=n[4]: warnings.append([name,table,date,'GA published total differs from components',n])
                    for key,value in vals.items():
                        assert value>=0 and value==int(value),(date,key,value)
                        records.setdefault(key,{})[date]={'date':date,'value':int(value),'source':name,'page':int(page_no),'table':table}
                except Exception as exc: raise ValueError(f'{name} page {page_no} table {table} {date}: {line} {exc}') from exc
            if row_count != 25: warnings.append([name,table,'row count',row_count])
        if re.search(r'TITLE IV-D SOURCE COLLECTION REPORT',txt):
            periods=re.findall(r'\b([1369]|12)/(?:30|31)/(20\d{2})\b',txt)
            periods=list(dict.fromkeys(periods))
            collection=re.search(r'(?m)^TOTAL COLLECTIONS\*?\s+(.+)',txt)
            if not collection:
                # Some reports put the row label on two lines.
                collection=re.search(r'(?m)^TOTAL\s+\$?\s*([\d,]+.+)\nCOLLECTIONS',txt)
            if not collection:
                collection=re.search(r'(?m)^\s*(\$[\d,]+\s+100%\s+\$[\d,]+.+)\nCOLLECTIONS\*',txt)
            if collection and len(periods)==2:
                dollar_values=numbers(collection[1])
                if len(dollar_values)>=4:
                    for (m,y),v in zip(periods,[dollar_values[0],dollar_values[2]]):
                        date=f'{int(y):04}-{int(m):02}'
                        child[date]={'date':date,'value':int(v),'source':name,'page':int(page_no),'table':12}
                else: warnings.append([name,'child collection parse',collection[1]])
            else: warnings.append([name,'child missing',periods])
metadata=[
 ('snap','NJ SNAP','Households','Food assistance','snapPersons'),
 ('tanf','WFNJ / TANF','Families','Cash assistance for families','tanfPersons'),
 ('ga','General Assistance','Cases / recipients','Cash assistance for adults',None),
 ('tanfEA','TANF Emergency Assistance','Families','Families receiving emergency assistance',None),
 ('gaEA','GA Emergency Assistance','Cases','GA cases receiving emergency assistance',None),
]
programs=[]
for key,label,unit,description,people in metadata:
    obs=sorted(records[key].values(),key=lambda v:v['date'])
    assert obs[0]['date']=='2008-12' and obs[-1]['date']==as_of,(key,obs[0],obs[-1])
    expected=(int(as_of[:4])-2008)*12+int(as_of[-2:])-12+1
    assert len(obs)==expected,(key,len(obs),expected)
    for left,right in zip(obs,obs[1:]):
        y,m=map(int,left['date'].split('-')); ym=y*12+m
        assert right['date']==f'{ym//12:04}-{ym%12+1:02}',(key,left,right)
    series={'id':key,'name':label,'unit':unit,'description':description,'frequency':'monthly','observations':obs}
    if people: series['people']=sorted(records[people].values(),key=lambda v:v['date'])
    if key in ['snap','tanf']:
        series['composition']={k:sorted(records[key+k].values(),key=lambda v:v['date']) for k in ['Adults','Children']}
    programs.append(series)
if child:
    programs.append({'id':'childSupport','name':'Child Support','unit':'Nominal USD','description':'Quarterly collections, including current support and arrears','frequency':'quarterly','observations':sorted(child.values(),key=lambda v:v['date'])})
data={'title':'NJCSV - New Jersey Civil Statistics Visualizations','asOf':as_of,'coverageStart':'2008-12','retrievedAt':today_date.today().isoformat(),'programs':programs,'sources':list(sources.values()),'qualityNotes':warnings}
(ROOT/'public/data/programs.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
print('Coverage:',[(p['id'],len(p['observations']),p['observations'][0]['date'],p['observations'][-1]['date']) for p in programs])
print('Quality notes:',len(warnings)); print(json.dumps(warnings[:15],indent=2))
