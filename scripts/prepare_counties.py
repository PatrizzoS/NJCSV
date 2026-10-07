"""County snapshots from published DFD county tables; no interpolated months."""
from pathlib import Path
import re, json, sys
import pdfplumber
ROOT=Path(__file__).resolve().parent.parent
CACHE=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'sources'
COUNTIES=['Atlantic','Bergen','Burlington','Camden','Cape May','Cumberland','Essex','Gloucester','Hudson','Hunterdon','Mercer','Middlesex','Monmouth','Morris','Ocean','Passaic','Salem','Somerset','Sussex','Union','Warren']
NAMES={re.sub(r'\s+','',c).upper():c for c in COUNTIES}
dataset=json.loads((ROOT/'public/data/programs.json').read_text(encoding='utf-8'))
programs={p['id']:{'id':p['id'],'name':p['name'],'unit':p['unit'],'snapshots':[]} for p in dataset['programs']}
programs['childSupport']['unit']='Cases with orders'
programs['childSupport']['note']='County Child Support data counts cases with orders, not collection dollars. Statewide collection charts use a different measure.'
issues=[]

def numeric(text):
    s=re.sub(r'\s+','',text).strip('*∆')
    if s=='-': return 0.0
    match=re.fullmatch(r'(\(?-?\d[\d,]*(?:\.\d+)?%?\)?)[*∆]*',s)
    if not match: return None
    s=match[1].replace(',','').replace('%','').replace('(','-').replace(')','')
    return float(s)

def rows(page):
    words=page.extract_words(keep_blank_chars=True)
    out={}
    for w in words:
        name=NAMES.get(re.sub(r'\s+','',w['text']).upper())
        if not name or name in out: continue
        row=sorted([v for v in words if abs(v['top']-w['top'])<2 and v['x0']>w['x1']-1],key=lambda v:v['x0'])
        groups=[]
        for token in row:
            if groups and token['x0']-groups[-1]['x1']<1:
                groups[-1]['text']+=token['text'];groups[-1]['x1']=token['x1']
            else: groups.append(dict(token))
        values=[numeric(v['text']) for v in groups]
        out[name]=[v for v in values if v is not None]
    assert set(out)==set(COUNTIES),f'Expected 21 counties; got {list(out)}'
    return out

for src in sorted(dataset['sources'],key=lambda s:s['reportDate']):
    txt=(CACHE/Path(src['id']).with_suffix('.txt')).read_text(encoding='utf-8')
    parts=re.split(r'=== PAGE (\d+) ===',txt)
    selected=[]
    for n,text in zip(parts[1::2],parts[2::2]):
        if int(n)<=2: continue
        match=re.search(r'(?im)^\s*TABLE\s+(2|7|9|11)\s*(?::|\s|$)',text)
        if match:selected.append((int(n),int(match[1])))
        elif 'TITLE IV-D REPORT OF CASES WITH ORDERS' in text:
            table=re.search(r'(?i)TABLE\s+(\d+)',text)
            if table:selected.append((int(n),int(table[1])))
    with pdfplumber.open(CACHE/src['id']) as pdf:
        for page_no,table in selected:
            r=rows(pdf.pages[page_no-1])
            if table==2: fields=[('tanf',6)]; allowed=[9]
            elif table==7: fields=[('snap',2)]; allowed=[8,10]
            elif table==9: fields=[('tanfEA',0)]; allowed=[7]
            elif table==11: fields=[('ga',4),('gaEA',8)]; allowed=[10]
            else: fields=[('childSupport',4)]; allowed=[7]
            for c,values in r.items():
                assert len(values) in allowed,(src['id'],table,c,values)
            for key,index in fields:
                vals=[]
                for county in COUNTIES:
                    value=r[county][index]
                    assert value>=0 and value==int(value),(key,county,value)
                    vals.append({'county':county,'value':int(value)})
                snapshot={'date':src['reportDate'],'source':src['id'],'table':table,'page':page_no,'values':vals,'total':sum(v['value'] for v in vals)}
                programs[key]['snapshots'].append(snapshot)
    print(src['id'],flush=True)

for p in programs.values():
    dates=[s['date'] for s in p['snapshots']]
    assert len(dates)==len(set(dates)),(p['id'],'duplicate snapshots')
    assert p['snapshots'][-1]['date']==dataset['asOf'],(p['id'],'missing latest')
    if p['id']!='childSupport':
        observed={o['date']:o['value'] for o in next(v for v in dataset['programs'] if v['id']==p['id'])['observations']}
        for snap in p['snapshots']:
            if snap['date'] in observed and snap['total']!=observed[snap['date']]:
                issues.append({'program':p['id'],'date':snap['date'],'countySum':snap['total'],'statewide':observed[snap['date']],'source':snap['source']})

out={'asOf':dataset['asOf'],'counties':COUNTIES,'frequency':'Published snapshots from March, June, September and December reports; not a complete monthly county series.','zeroValueNote':'Standalone dashes in numeric source-table cells are treated as published zeros. A zero is not an estimate of underlying need.','programs':list(programs.values()),'qualityNotes':issues}
(ROOT/'public/data/counties.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('Snapshots:',[(p['id'],len(p['snapshots'])) for p in programs.values()])
print('County sum / reconciled statewide differences:',len(issues))
