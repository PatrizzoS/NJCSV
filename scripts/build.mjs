import { mkdir, cp, readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for (const f of ['app.js','analytics.js','theme.js','glossary.js','insights.js']) execFileSync(process.execPath,['--check',path.join(root,'public',f)]);
for (const f of ['programs.json','models.json','counties.json','census.json','census-state.json','census-history.json','county-models.json']) JSON.parse(await readFile(path.join(root,'public','data',f),'utf8'));
await mkdir(path.join(root,'dist'),{recursive:true});
await cp(path.join(root,'public'),path.join(root,'dist'),{recursive:true});
console.log('NJCSV static build ready in dist/');
