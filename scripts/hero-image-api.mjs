import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
const env={...parseEnv(await readFile('.env.local','utf8')),...process.env};
const root='.tmp/image-audit';
await mkdir(root,{recursive:true});
const [mode,id,promptFile,reference,...extraReferences]=process.argv.slice(2);
async function responseBody(response){
 if(!response.ok) throw new Error(`API returned HTTP ${response.status}; request stopped (response omitted to protect credentials).`);
 return response;
}
if(mode==='generate'){
 const prompt=await readFile(promptFile,'utf8');
 const parts=[{text:prompt}];
 const references=[reference,...extraReferences].filter(Boolean);
 for(const path of references) parts.push({inlineData:{mimeType:path.endsWith('.webp')?'image/webp':path.endsWith('.png')?'image/png':'image/jpeg',data:(await readFile(path)).toString('base64')}});
 const res=await responseBody(await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent',{
 method:'POST',headers:{'x-goog-api-key':env.GEMINI_API_KEY,'Content-Type':'application/json'},signal:AbortSignal.timeout(240000),
 body:JSON.stringify({contents:[{parts}],generationConfig:{responseModalities:['TEXT','IMAGE'],imageConfig:{aspectRatio:id.includes('portrait')?'3:4':id.includes('-square')?'1:1':'16:9',imageSize:'2K'}}})}));
 const data=await res.json();
 const image=data.candidates?.[0]?.content?.parts?.find(p=>p.inlineData?.mimeType?.startsWith('image/'))?.inlineData;
 if(!image) throw new Error('No image returned; generation blocked or unavailable.');
 const ext=image.mimeType==='image/jpeg'?'jpg':'png';
 await writeFile(`${root}/${id}.${ext}`,Buffer.from(image.data,'base64'));
 await writeFile(`${root}/${id}.metadata.json`,JSON.stringify({model:'gemini-3.1-flash-image',prompt,reference:reference||null,references,createdAt:new Date().toISOString(),mimeType:image.mimeType},null,2));
 console.log(`${root}/${id}.${ext}`);
}else if(mode==='compose'){
 const form=new FormData();
 form.set('imageFile',new Blob([await readFile(promptFile)]),'product.jpg');
 form.set('background.imageFile',new Blob([await readFile(reference)]),'background.jpg');
 const parameters={removeBackground:'true',outputSize:'1920x1080',padding:'0.18',paddingLeft:'0.45',paddingRight:'0.04',horizontalAlignment:'right','shadow.mode':'ai.soft',outputFormat:'webp'};
 for(const[k,v]of Object.entries(parameters)) form.set(k,v);
 const res=await responseBody(await fetch('https://image-api.photoroom.com/v2/edit',{method:'POST',headers:{'x-api-key':env.PHOTOROOM_API_KEY},body:form,signal:AbortSignal.timeout(120000)}));
 if(!res.headers.get('content-type')?.startsWith('image/')) throw new Error('Photoroom did not return an image');
 await writeFile(`${root}/${id}.webp`,Buffer.from(await res.arrayBuffer()));
 await writeFile(`${root}/${id}.metadata.json`,JSON.stringify({provider:'Photoroom',parameters,source:promptFile,background:reference,createdAt:new Date().toISOString()},null,2));
 console.log(`${root}/${id}.webp`);
}else if(mode==='photoroom' || mode==='remove-text'){
 const form=new FormData();
 form.set('imageFile',new Blob([await readFile(promptFile)]),promptFile.split('/').pop());
 if(mode==='remove-text') form.set('textRemoval.mode','ai.artificial');
 form.set('removeBackground','false');
 form.set('referenceBox','originalImage');
 form.set('outputFormat','webp');
 const res=await responseBody(await fetch('https://image-api.photoroom.com/v2/edit',{method:'POST',headers:{'x-api-key':reference==='sandbox'?env.PHOTOROOM_SANDBOX_API_KEY:env.PHOTOROOM_API_KEY},body:form,signal:AbortSignal.timeout(120000)}));
 if(!res.headers.get('content-type')?.startsWith('image/')) throw new Error('Photoroom did not return an image');
 await writeFile(`${root}/${id}.webp`,Buffer.from(await res.arrayBuffer()));
 console.log(`${root}/${id}.webp`);
}else{throw new Error('Usage: generate ID PROMPT [REFERENCES...] | compose ID PRODUCT BACKGROUND | photoroom ID INPUT [sandbox] | remove-text ID INPUT');}
