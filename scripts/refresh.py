"""Explicit local refresh. Not run during Vercel builds or web requests."""
from pathlib import Path
from urllib.request import urlopen, Request
from concurrent.futures import ThreadPoolExecutor
import re, subprocess, sys
ROOT=Path(__file__).resolve().parent.parent
cache=ROOT/'sources'; cache.mkdir(exist_ok=True)
base='https://www.nj.gov'
def get(url):
    with urlopen(Request(url,headers={'User-Agent':'NJCSV public statistics research/1.0'}),timeout=60) as response:
        return response.read()
urls=set()
for name in ['cps.shtml','cps_archives.shtml']:
    body=get(f'{base}/humanservices/dfd/news/reports/{name}')
    (cache/name).write_bytes(body)
    for path in re.findall(r'href="([^"]+\.pdf)"',body.decode('utf-8')):
        year=re.search(r'/cps/(\d{4})/',path)
        if year and int(year[1])>=2010 and re.search(r'(?i)(dec|sep|jun|mar)',path): urls.add(base+path)
def download(url):
    dest=cache/url.split('/')[-1]
    # Redownload to capture upstream revisions. Text cache is regenerated too.
    payload=get(url)
    if not payload.startswith(b'%PDF'): raise ValueError(f'Not a PDF: {url}')
    dest.write_bytes(payload)
    dest.with_suffix('.txt').unlink(missing_ok=True)
    print(dest.name,flush=True)
with ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(download,sorted(urls)))
for script in ['extract.py','prepare_data.py','prepare_counties.py','prepare_census.py','prepare_census_history.py','prepare_census_state.py','model.py','county_model.py']:
    subprocess.run([sys.executable,str(ROOT/'scripts'/script)],check=True,cwd=ROOT)
print('Refresh complete. Review source quality notes and run npm test before deployment.')
