import {readdir,lstat,readFile} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {planLayers} from './layers.mjs';

// Local proof of ingestion. PNG metadata only: production needs decode + asset processing.
export async function importFolder(directory, metadata = {}) {
 const root = resolve(directory), files = []; let totalBytes = 0;
 if (!(await lstat(root)).isDirectory()) throw Error('Selecciona una carpeta. No se admiten enlaces simbólicos.');
 async function walk(dir, depth=0) {
  if (depth>3) throw Error('La carpeta tiene demasiados niveles.');
  for (const entry of await readdir(dir,{withFileTypes:true})) {
   if (entry.name.startsWith('.')) continue;
   const path=join(dir,entry.name);
   if (entry.isSymbolicLink()) throw Error('No se admiten enlaces simbólicos.');
   if (entry.isDirectory()) { await walk(path,depth+1); continue; }
   if (!entry.isFile() || !/\.png$/i.test(entry.name)) throw Error('La prueba local admite solo PNG.');
   if (files.length>=500) throw Error('Máximo 500 imágenes.');
   const stat=await lstat(path); totalBytes+=stat.size;
   if (stat.size>20*1024*1024 || totalBytes>100*1024*1024) throw Error('Límite: 20 MB por imagen, 100 MB por carpeta.');
   const bytes=await readFile(path);
   if (bytes.length<33 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.readUInt32BE(8)!==13 || bytes.toString('ascii',12,16)!=='IHDR') throw Error('Cabecera PNG no válida.');
   files.push({path:relative(root,path).split('\\').join('/'),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});
  }
 }
 await walk(root); return planLayers(files,metadata);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 try {if(!process.argv[2])throw Error('Uso: npm run import:layers -- /ruta/al/producto');console.log(JSON.stringify(await importFolder(process.argv[2]),null,2));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
