const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {run}=require('../electron/process.cjs');
const ff=path.resolve(__dirname,'../vendor/ffmpeg.exe');
function pixel(file,at){return new Promise((resolve,reject)=>{const child=spawn(ff,['-v','error','-nostdin','-ss',String(at),'-i',file,'-frames:v','1','-vf','scale=1:1,format=rgb24','-f','rawvideo','pipe:1'],{windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});const buffers=[];let errors='';child.stdout.on('data',b=>buffers.push(b));child.stderr.on('data',b=>errors+=b);child.on('error',reject);child.on('close',code=>code?reject(new Error(errors)):resolve([...Buffer.concat(buffers).subarray(0,3)]));});}
async function levels(file,start,seconds){const args=['-hide_banner','-nostdin'];if(start!=null)args.push('-ss',String(start));args.push('-i',file);if(seconds)args.push('-t',String(seconds));args.push('-vn','-af','volumedetect','-f','null','-');const result=await run(ff,args);return {mean:Number(result.stderr.match(/mean_volume:\s*([-\d.]+)/)?.[1]),peak:Number(result.stderr.match(/max_volume:\s*([-\d.]+)/)?.[1])};}
(async()=>{
 const input=path.resolve(process.argv[2]),report=JSON.parse(fs.readFileSync(input,'utf8')),folder=path.dirname(input),job=report.batchJobs?.[0]||report.job;
 assert(report.passed,'Portable kabul başarısız');
 const cut=job.timing.cut,gap=job.timing.gap;
 const samples=await Promise.all([pixel(job.file,4),pixel(job.file,cut+1),pixel(job.file,cut+gap+1.5),levels(job.file,3,.25),levels(job.file,cut-.15,.1),levels(job.file,cut+gap+.05,.1),levels(job.file,cut+.4,.25),levels(job.file,cut+1.5,.25),levels(job.file,cut+2.8,.25),levels(job.file)]);
 const [before,black,after,song,fadeOut,fadeIn,voiceStart,voiceMiddle,voiceEnd,total]=samples;
 assert(before.some(v=>v>15)&&after.some(v=>v>15),'Şarkı kareleri eksik');assert(black.every(v=>v<=2),'Jenerik ekranı siyah değil');
 assert(job.timing.audioFadeOut===0?Math.abs(fadeOut.mean-song.mean)<1:fadeOut.mean<song.mean-8,'Ses çıkışı seçilen süreye uymuyor');
 assert(job.timing.audioFadeIn===0?Math.abs(fadeIn.mean-song.mean)<1:fadeIn.mean<song.mean-8,'Ses dönüşü seçilen süreye uymuyor');
 assert(Math.max(voiceStart.mean,voiceMiddle.mean,voiceEnd.mean)-Math.min(voiceStart.mean,voiceMiddle.mean,voiceEnd.mean)<1,'Jenerik boyunca istenmeyen fade var');assert(total.peak<0,'Çıktıda clipping var');
 const frames={};for(const [name,at]of [['once',4],['siyah',cut+1],['sonra',cut+gap+1.5]]){const output=path.join(folder,name+'.png');await run(ff,['-v','error','-nostdin','-y','-ss',String(at),'-i',job.file,'-frames:v','1',output]);frames[name]=output;}
 const result={passed:true,synthetic:{file:job.file,pixels:{before,black,after},audio:{song,fadeOut,fadeIn,voiceStart,voiceMiddle,voiceEnd,total},frames}};
 if(report.batchJobs){result.batch=[];for(const item of report.batchJobs){const at=item.timing.cut+item.timing.gap/2,black=await pixel(item.file,at),audio=await levels(item.file);assert(black.every(v=>v<=2),'Toplu videoda siyah ekran eksik');assert(audio.peak<0,'Toplu videoda ses taşması');result.batch.push({file:item.file,speechPath:item.settings.speechPath,bgPath:item.settings.bgPath,gap:item.timing.gap,duration:item.outputInfo.duration,black,audio});}}
 if(report.transitions){
  const t=report.transitions,cut=t.timing.cut,end=cut+t.timing.gap;
  const [full,dim,back,normal,unchanged,soft]=await Promise.all([pixel(t.file,3),pixel(t.file,cut-.5),pixel(t.file,end+.2),levels(t.file,3,.1),levels(t.file,cut-.3,.1),levels(t.file,end+.05,.1)]);
  assert(Math.max(...dim)<Math.max(...full)*.55,'Görüntü ayrı 2 saniye kararmıyor');
  assert(Math.abs(unchanged.mean-normal.mean)<1,'Sıfır seçilen ses çıkışı beklenmedik biçimde kısılıyor');
  assert(Math.max(...back)>120&&soft.mean<normal.mean-12,'Görüntü hemen dönerken ses ayrı yumuşak açılmıyor');
  result.independentTransitions={passed:true,file:t.file,settings:{audioOut:0,videoOut:2,audioIn:1.5,videoIn:0},pixels:{full,dim,back},audio:{normal,unchanged,soft}};
 }
 if(report.company){const c=report.company,black=await pixel(c.file,c.timing.cut+c.timing.head+.5),audio=await levels(c.file);assert(black.every(v=>v<=2),'Şirket reklam arası siyah değil');assert(audio.peak<0,'Şirket çıktısında clipping var');result.company={file:c.file,black,audio,duration:c.outputInfo.duration,elapsedSeconds:c.elapsedSeconds,realUserMedia:true};}
 fs.writeFileSync(path.join(folder,'goruntu-ses-kabul.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
