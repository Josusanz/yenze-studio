import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
const origin=process.env.YENZE_SHOWCASE_ORIGIN;
let html=readFileSync('dist-showcase/index.html','utf8');
if(origin){const u=new URL(origin);if(u.origin!==origin||u.protocol!=='https:')throw Error('Use an exact HTTPS showcase origin.');html=html.replace('content="/launch/social-card.png"',`content="${origin}/launch/social-card.png"`).replace('</head>',`<link rel="canonical" href="${origin}/"><meta property="og:url" content="${origin}/"></head>`);}
writeFileSync('dist-showcase/index.html',html);
copyFileSync('deploy/vercel-showcase.json','dist-showcase/vercel.json');
console.log('Prepared static showcase. No backend or credentials included.');
