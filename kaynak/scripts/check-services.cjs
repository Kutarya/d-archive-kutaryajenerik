const fs=require('node:fs'),path=require('node:path');
const {Engine}=require('../electron/engine.cjs'),{ElevenLabs}=require('../electron/elevenlabs.cjs');
(async()=>{
 const base=path.resolve('../Kanitlar/servis-1-2');fs.mkdirSync(base,{recursive:true});
 const e=new Engine({vendorDir:path.resolve('vendor'),dataDir:path.join(base,'data'),outputDir:path.join(base,'out')});
 const report={at:new Date().toISOString(),elevenLiveSynthesis:false};
 const result=await e.search('Tayfun Hadi Yine İyisin');report.youtubeSearch=result;
 const linked=await e.lookup(result.url);report.youtubeLink=linked;
 if(linked.id!==result.id||!linked.duration)throw new Error('Bağlantı doğrulaması aranan videoyla eşleşmedi.');
 try{const list=await new ElevenLabs().voices();report.elevenPublic={available:true,count:list.length,female:list.filter(v=>v.gender==='Female').slice(0,3),male:list.filter(v=>v.gender==='Male').slice(0,3)};}catch(error){report.elevenPublic={available:false,error:error.message};}
 fs.writeFileSync(path.join(base,'kabul.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
