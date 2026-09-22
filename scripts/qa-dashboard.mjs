// Isolated browser fixtures. Does not load app env, auth, database or provider clients.
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
const mocks=resolve('tests/ui/qa-mocks.tsx');
const bundle=await build({entryPoints:['tests/ui/dashboard-fixture.tsx'],bundle:true,write:false,format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'isolated-actions',setup(b){b.onResolve({filter:/next\/(link|image)|i18n\/use-text|ai\/work|scans\/inline-actions|\.\/change-progress|\.\/settings$/},()=>({path:mocks}));}}]});
const css=await postcss([tailwind()]).process(await readFile('src/app/globals.css','utf8'),{from:resolve('src/app/globals.css')});
const html='<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ReplaceAll isolated QA</title><link rel="stylesheet" href="/styles.css"><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>';
createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);}else if(req.url==='/styles.css'){res.setHeader('Content-Type','text/css');res.end(css.css);}else{res.setHeader('Content-Type','text/html');res.end(html);}}).listen(3101,'127.0.0.1',()=>console.log('Isolated UI fixtures: http://127.0.0.1:3101'));
