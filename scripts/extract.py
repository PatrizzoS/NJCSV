from pathlib import Path
import pdfplumber
ROOT = Path(__file__).resolve().parent.parent
for path in sorted((ROOT / 'sources').glob('*.pdf')):
    dest = path.with_suffix('.txt')
    if dest.exists():
        continue
    try:
        with pdfplumber.open(path) as pdf:
            pages = [(page.extract_text(layout=False) or '') for page in pdf.pages]
    except Exception as exc:
        print(path.name, str(exc), flush=True)
        continue
    dest.write_text('\n'.join(f'\n=== PAGE {i+1} ===\n{text}' for i, text in enumerate(pages)), encoding='utf-8')
    print(path.name, len(pages), sum(map(len,pages)), flush=True)
