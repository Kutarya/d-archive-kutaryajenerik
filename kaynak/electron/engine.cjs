const {EventEmitter}=require('node:events');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {run}=require('./process.cjs');
const {parseYouTube,validateSettings,probe,plan,safeName,filterGraph,searchQuery,sources}=require('./media.cjs');
const {ElevenLabs}=require('./elevenlabs.cjs');
const {occupied,allocate,planOutputs}=require('./outputs.cjs');
const {batchEntries,batchOutputPlan}=require('./batch.cjs');
const ACTIVE=new Set(['queued','preparing','searching','downloading','speech','analysing','rendering','saving']);
const defaultSettings=()=>validateSettings({});
function atomic(file,value){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2),'utf8');fs.renameSync(tmp,file);}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function friendly(raw){
  if(String(raw).startsWith('ElevenLabs:'))return String(raw).slice(0,600);
  if(/NoAudioReceived|403|Forbidden/.test(raw))return 'Seslendirme hizmeti yanıt vermedi. Yeniden deneyin veya hazır jenerik / çevrimdışı Windows sesi seçin.';
  if(/sign in|not a bot|confirm your age|private video|members.only/i.test(raw))return 'YouTube bu videoya erişim için oturum istiyor. Şifre sorulmadan indirme durduruldu; yerel dosyayı seçebilirsiniz.';
  if(/disk full|No space left|not enough space/i.test(raw))return 'Diskte yeterli boş alan yok.';
  if(/429|unable to download|network|connection|timed out/i.test(raw))return 'İnternet bağlantısı veya hizmet isteği başarısız. Yeniden deneyebilirsiniz.';
  return String(raw).split('\n').filter(Boolean).slice(-2).join(' ').slice(0,650)||'İşlem tamamlanamadı.';
}
class Engine extends EventEmitter {
  constructor({vendorDir,dataDir,outputDir,authorizeFile=()=>true,eleven=new ElevenLabs()}){
    super();Object.assign(this,{vendorDir,dataDir,outputDir,authorizeFile,eleven});
    fs.mkdirSync(dataDir,{recursive:true});fs.mkdirSync(outputDir,{recursive:true});
    this.cacheDir=path.join(dataDir,'Onbellek');fs.mkdirSync(this.cacheDir,{recursive:true});
    this.settings={...defaultSettings(),...validateSettings(readJson(path.join(dataDir,'ayarlar.json'),{}))};
    const history=readJson(path.join(dataDir,'isler.json'),[]);
    this.jobs=(Array.isArray(history)?history:[]).filter(j=>/^[a-f0-9-]{36}$/.test(j?.id||'')).map(j=>({...j,status:ACTIVE.has(j.status)?'interrupted':j.status}));
    this.running=null;this.closing=false;this.lastEmit=0;this.voicesCache=readJson(path.join(vendorDir,'voices.json'),[]);
    this.speechFlights=new Map();this.songPreviewFlights=new Map();this.searchCache=new Map();this.normalCache=new Map();this.speechActivity=0;this.searchActivity=0;this.serviceController=new AbortController();
  }
  snapshot(){return {settings:{...this.settings},jobs:this.jobs.map(j=>({...j})),outputDir:this.outputDir,version:require('../package.json').version,services:{elevenlabs:{connected:this.eleven.connected}}};}
  outputPlan(raw){if(raw.entries!==undefined)return {folder:this.outputDir,files:batchOutputPlan(batchEntries(raw),this.outputDir,this.jobs)};const settings=validateSettings(raw);return {folder:this.outputDir,files:planOutputs(sources(raw,settings),settings,this.outputDir,this.jobs)};}
  save(){atomic(path.join(this.dataDir,'isler.json'),this.jobs);}
  notify(force=true){if(!force&&Date.now()-this.lastEmit<220)return;this.lastEmit=Date.now();this.emit('change',this.snapshot());}
  updateSettings(raw){const settings=validateSettings(raw);atomic(path.join(this.dataDir,'ayarlar.json'),settings);this.settings=settings;return this.settings;}
  setOutput(folder){fs.mkdirSync(folder,{recursive:true});atomic(path.join(this.dataDir,'konum.json'),{outputDir:folder});this.outputDir=folder;this.notify();}
  async voices(refresh=false){
    if(refresh||!this.voicesCache.length){
      try{this.voicesCache=await this.speechRequest({op:'voices'});atomic(path.join(this.dataDir,'sesler.json'),this.voicesCache);}catch{this.voicesCache=readJson(path.join(this.dataDir,'sesler.json'),this.voicesCache);}
    }
    let offline=[];try{offline=await this.speechRequest({op:'voices'},true);}catch{}
    return [...this.voicesCache,...offline];
  }
  async speechRequest(request,offline=false,signal){
    const requestFile=path.join(this.cacheDir,`ses-istegi-${crypto.randomUUID()}.json`);
    this.speechActivity++;
    try{
      await fsp.writeFile(requestFile,JSON.stringify(request),'utf8');
      const file=offline?'powershell.exe':path.join(this.vendorDir,'KutaryaSes.exe');
      const args=offline?['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(this.vendorDir,'tts-windows.ps1'),requestFile]:[requestFile];
      const result=await run(file,args,{signal:signal||this.serviceController.signal,timeout:180000});return JSON.parse(result.stdout.replace(/^\uFEFF/,''));
    }finally{this.speechActivity--;await fsp.unlink(requestFile).catch(()=>{});}
  }
  async synthesize(settings,signal){
    if(!settings.text)throw new Error('Jenerik metnini yazın veya hazır bir ses dosyası seçin.');
    if(signal?.aborted)throw Object.assign(new Error('İşlem iptal edildi.'),{code:'CANCELLED'});
    const hash=crypto.createHash('sha256').update(JSON.stringify([settings.text,settings.voice,settings.rate,settings.pitch])).digest('hex');
    const offline=settings.voice.startsWith('sapi:');const output=path.join(this.cacheDir,`${hash}.${offline?'wav':'mp3'}`);
    if(fs.existsSync(output)&&fs.statSync(output).size>200)return output;
    let flight=this.speechFlights.get(hash);
    if(!flight){
      flight={controller:new AbortController(),consumers:0,settled:false};
      this.speechFlights.set(hash,flight);
      const partial=output+'.'+crypto.randomUUID()+'.partial'+path.extname(output);
      const shared=flight.controller.signal;
      flight.promise=(async()=>{
        try{
          if(settings.voice.startsWith('eleven:'))await this.eleven.synthesize(settings,partial,shared);
          else await this.speechRequest({...settings,output:partial},offline,shared);
          const info=await probe(partial,this.vendorDir,shared);if(!info.hasAudio)throw new Error('Seslendirme hizmeti bir ses kanalı döndürmedi.');
          if(shared.aborted)throw Object.assign(new Error('İşlem iptal edildi.'),{code:'CANCELLED'});
          await fsp.rename(partial,output);return output;
        }catch(error){await fsp.unlink(partial).catch(()=>{});throw Object.assign(new Error(friendly(error.message)),{code:error.code});}
        finally{flight.settled=true;if(this.speechFlights.get(hash)===flight)this.speechFlights.delete(hash);}
      })();
    }
    // Önizleme ve iş aynı üretimi paylaşır. Bir tüketicinin iptali diğerini bozmaz.
    flight.consumers++;
    return new Promise((resolve,reject)=>{
      let ended=false;
      const end=(error,result)=>{if(ended)return;ended=true;signal?.removeEventListener('abort',abort);flight.consumers--;if(!flight.consumers&&!flight.settled){this.speechFlights.delete(hash);flight.controller.abort();}error?reject(error):resolve(result);};
      const abort=()=>end(Object.assign(new Error('İşlem iptal edildi.'),{code:'CANCELLED'}));
      signal?.addEventListener('abort',abort,{once:true});flight.promise.then(value=>end(null,value),end);if(signal?.aborted)abort();
    });
  }
  async previewSpeech(raw,signal){const settings=validateSettings(raw);if(settings.speechMode==='file'){this.checkFile(settings.speechPath);return settings.speechPath;}return this.synthesize(settings,signal);}
  checkFile(file){if(!file||!this.authorizeFile(file)||!fs.existsSync(file))throw new Error('Medya dosyasını Dosya seç düğmesiyle seçin.');}
  enqueue(raw={}){
    if(raw.entries!==undefined)return this.enqueueBatch(raw);
    const settings=validateSettings(raw),songs=sources(raw,settings);
    if(this.closing)throw new Error('Uygulama kapanıyor; yeni kurgu başlatılamaz.');
    if(!settings.outputName)throw new Error('Video için bir dosya adı yazın.');
    for(const song of songs)if(song.songPath)this.checkFile(song.songPath);
    if(settings.speechMode==='file')this.checkFile(settings.speechPath);else if(!settings.text)throw new Error('Jenerik metni boş.');
    if(settings.backgroundEnabled){this.checkFile(settings.bgPath);}
    if(settings.speechMode==='text'&&settings.voice.startsWith('eleven:')&&!this.eleven.connected)throw new Error('ElevenLabs: Önce hesabınızı bağlayın veya Türkçe doğal ses seçin.');
    // Tüm girdiler doğrulanır; kısmen kuyruğa eklenmiş iş bırakılmaz.
    const outputs=planOutputs(songs,settings,this.outputDir,this.jobs);
    const jobs=songs.map((song,index)=>({...song,id:crypto.randomUUID(),videoId:song.id||null,outputStem:outputs[index].stem,settings:{...settings,songPaths:[],sourceText:''},outputDir:this.outputDir,status:'queued',progress:0,title:song.title||'YouTube videosu',createdAt:new Date().toISOString(),error:'',detail:'Sırada'}));
    // Disk yazımı başarısızsa bellekte yarım bir toplu kuyruk bırakılmaz.
    const previous=this.jobs,previousSettings=this.settings;
    try{this.updateSettings(settings);this.jobs=[...previous,...jobs];this.save();}
    catch(error){this.jobs=previous;this.settings=previousSettings;try{atomic(path.join(this.dataDir,'ayarlar.json'),previousSettings);}catch{}throw error;}
    this.notify();this.pump();return jobs.map(j=>j.id);
  }
  enqueueBatch(raw){
    if(this.closing)throw new Error('Uygulama kapanıyor; yeni kurgu başlatılamaz.');
    const entries=batchEntries(raw);
    for(const {song,settings} of entries){
      if(song.songPath)this.checkFile(song.songPath);
      if(settings.speechMode==='file')this.checkFile(settings.speechPath);else if(!settings.text)throw new Error('Her şarkı için jenerik metni veya hazır ses seçin.');
      if(settings.backgroundEnabled)this.checkFile(settings.bgPath);
      if(settings.speechMode==='text'&&settings.voice.startsWith('eleven:')&&!this.eleven.connected)throw new Error('ElevenLabs: Önce hesabınızı bağlayın veya Türkçe doğal ses seçin.');
    }
    const outputs=batchOutputPlan(entries,this.outputDir,this.jobs);
    const jobs=entries.map(({entryId,song,settings},index)=>({...song,entryId,id:crypto.randomUUID(),videoId:song.id||null,outputStem:outputs[index].stem,settings,outputDir:this.outputDir,status:'queued',progress:0,title:song.title||'YouTube videosu',createdAt:new Date().toISOString(),error:'',detail:'Sırada'}));
    const previous=this.jobs,previousSettings=this.settings;
    try{this.updateSettings(raw);this.jobs=[...previous,...jobs];this.save();}
    catch(error){this.jobs=previous;this.settings=previousSettings;try{atomic(path.join(this.dataDir,'ayarlar.json'),previousSettings);}catch{}throw error;}
    this.notify();this.pump();return jobs.map(j=>j.id);
  }
  pump(){if(this.running||this.closing)return;const job=this.jobs.find(j=>j.status==='queued');if(job)void this.execute(job);}
  state(job,status,detail,progress){Object.assign(job,{status,detail,progress:Math.max(job.progress||0,progress||0)});this.save();this.notify();}
  async search(input,signal){
    const query=searchQuery(input),key=query.toLocaleLowerCase('tr-TR'),cached=this.searchCache.get(key);
    if(cached&&Date.now()-cached.at<600000)return {...cached.value};
    let result;this.searchActivity++;
    try{result=await run(path.join(this.vendorDir,'yt-dlp.exe'),['--ignore-config','--no-plugin-dirs','--no-color','--encoding','utf-8','--flat-playlist','--dump-single-json','--socket-timeout','20','--retries','2','--','ytsearch1:'+query],{signal:signal||this.serviceController.signal,timeout:75000});}
    finally{this.searchActivity--;}
    let item;try{item=JSON.parse(result.stdout).entries?.[0];}catch{throw new Error('YouTube arama sonucu okunamadı.');}
    if(!item?.id)throw new Error('Bu isimle video bulunamadı. Sanatçı ve şarkı adını birlikte yazın.');
    const link=parseYouTube('https://www.youtube.com/watch?v='+item.id);
    const value={...link,title:String(item.title||query),duration:Number(item.duration)||null,channel:String(item.channel||item.uploader||''),query};
    this.searchCache.set(key,{at:Date.now(),value});return {...value};
  }
  async lookup(input,signal){
    const link=parseYouTube(input),key='url:'+link.id,cached=this.searchCache.get(key);
    if(cached&&Date.now()-cached.at<600000)return {...cached.value};
    this.searchActivity++;let result;
    try{result=await run(path.join(this.vendorDir,'yt-dlp.exe'),['--ignore-config','--no-plugin-dirs','--no-playlist','--no-color','--encoding','utf-8','--skip-download','--dump-single-json','--js-runtimes',`deno:${path.join(this.vendorDir,'deno.exe')}`,'--socket-timeout','20','--retries','1','--',link.url],{signal:signal||this.serviceController.signal,timeout:75000});}
    catch(error){throw new Error(friendly(error.message));}finally{this.searchActivity--;}
    let item;try{item=JSON.parse(result.stdout);}catch{throw new Error('Video bilgisi okunamadı. Başka bir bağlantı deneyin.');}
    if(item.is_live||!Number(item.duration))throw new Error('Canlı yayın yerine süresi belli bir video seçin.');
    const value={...link,title:String(item.title||'YouTube videosu'),duration:Number(item.duration),channel:String(item.channel||item.uploader||'')};
    this.searchCache.set(key,{at:Date.now(),value});return {...value};
  }
  async previewSong(input){
    const link=parseYouTube(input),output=path.join(this.cacheDir,'sarki-'+link.id+'.mp3');
    if(fs.existsSync(output)&&fs.statSync(output).size>200){const info=await probe(output,this.vendorDir,this.serviceController.signal);if(info.hasAudio)return output;}
    if(this.songPreviewFlights.has(link.id))return this.songPreviewFlights.get(link.id).promise;
    const controller=new AbortController(),abort=()=>controller.abort();
    this.serviceController.signal.addEventListener('abort',abort,{once:true});
    const work=path.join(this.cacheDir,'dinle-'+crypto.randomUUID());
    const flight={controller};
    flight.promise=(async()=>{
      try{
        await fsp.mkdir(work,{recursive:true});let downloaded;
        const args=['--ignore-config','--no-plugin-dirs','--no-playlist','--no-color','--encoding','utf-8','--no-simulate','--js-runtimes',`deno:${path.join(this.vendorDir,'deno.exe')}`,'--ffmpeg-location',this.vendorDir,'--socket-timeout','20','--retries','2','--fragment-retries','2','--match-filters','!is_live','-f','bestaudio/best','--extract-audio','--audio-format','mp3','--audio-quality','5','-o',path.join(work,'sarki.%(ext)s'),'--print','after_move:KTY_FILE:%(filepath)j','--',link.url];
        await run(path.join(this.vendorDir,'yt-dlp.exe'),args,{signal:controller.signal,timeout:180000,onLine:line=>{if(line.startsWith('KTY_FILE:')){try{downloaded=JSON.parse(line.slice(9));}catch{}}}});
        if(!downloaded||!path.resolve(downloaded).startsWith(path.resolve(work)+path.sep))throw new Error('Şarkının sesi hazırlanamadı.');
        const info=await probe(downloaded,this.vendorDir,controller.signal);if(!info.hasAudio||info.hasVideo)throw new Error('Şarkının ses önizlemesi geçersiz.');
        if(controller.signal.aborted)throw new Error('Dinleme iptal edildi.');
        await fsp.rename(downloaded,output);return output;
      }catch(error){throw new Error(friendly(error.message));}
      finally{this.serviceController.signal.removeEventListener('abort',abort);await fsp.rm(work,{recursive:true,force:true}).catch(()=>{});this.songPreviewFlights.delete(link.id);}
    })();
    this.songPreviewFlights.set(link.id,flight);return flight.promise;
  }
  cancelSongPreview(){for(const flight of this.songPreviewFlights.values())flight.controller.abort();return true;}
  async download(job,work,signal){
    const args=['--ignore-config','--no-plugin-dirs','--no-playlist','--no-color','--newline','--encoding','utf-8','--no-simulate',
      '--js-runtimes',`deno:${path.join(this.vendorDir,'deno.exe')}`,'--ffmpeg-location',this.vendorDir,'--no-mtime','--socket-timeout','25','--retries','3','--fragment-retries','3','--concurrent-fragments','4',
      '-f','bestvideo[height<=1080]+bestaudio/best[height<=1080]/best','--merge-output-format','mp4','--remux-video','mp4',
      '-o',path.join(work,'sarki.%(ext)s'),'--print','before_dl:KTY_META:{"title":%(title)j,"duration":%(duration)j,"is_live":%(is_live)j}',
      '--print','after_move:KTY_FILE:%(filepath)j','--progress-template','download:KTY_PROGRESS:%(progress)j','--progress-delta','0.5','--match-filters','!is_live','--',job.url];
    let downloaded;
    await run(path.join(this.vendorDir,'yt-dlp.exe'),args,{signal,cwd:work,onLine:line=>{
      if(line.startsWith('KTY_META:')){try{const meta=JSON.parse(line.slice(9));job.title=meta.title||job.title;job.songDuration=meta.duration;this.notify();}catch{}}
      if(line.startsWith('KTY_FILE:')){try{downloaded=JSON.parse(line.slice(9));}catch{}}
      if(line.startsWith('KTY_PROGRESS:')){try{const p=JSON.parse(line.slice(13)),percent=Number(p.downloaded_bytes)/Number(p.total_bytes||p.total_bytes_estimate)*100;if(Number.isFinite(percent)){job.progress=Math.max(job.progress,2+percent*.3);job.detail=`Şarkı indiriliyor · %${Math.round(percent)}`;this.notify(false);}}catch{}}
    }});
    if(!downloaded||!path.resolve(downloaded).startsWith(path.resolve(work)+path.sep))throw new Error('Video indirilemedi; canlı yayın veya erişilemeyen bağlantı olabilir.');
    return downloaded;
  }
  async normalization(file,target,signal,seconds){
    const stat=await fsp.stat(file),key=JSON.stringify([path.resolve(file),stat.size,stat.mtimeMs,target,seconds]);
    if(signal?.aborted)throw Object.assign(new Error('İşlem iptal edildi.'),{code:'CANCELLED'});
    if(this.normalCache.has(key))return this.normalCache.get(key);
    const args=['-hide_banner','-nostdin'];if(seconds)args.push('-t',String(seconds));
    args.push('-i',file,'-vn','-sn','-dn','-af',`loudnorm=I=${target}:TP=-5:LRA=11:print_format=json`,'-f','null','-');
    const result=await run(path.join(this.vendorDir,'ffmpeg.exe'),args,{signal});
    const match=result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/g)?.at(-1);if(!match)return `loudnorm=I=${target}:TP=-5:LRA=11`;
    const d=JSON.parse(match);if(![d.input_i,d.input_tp,d.input_lra,d.input_thresh,d.target_offset].every(x=>Number.isFinite(Number(x))))return `loudnorm=I=${target}:TP=-5:LRA=11`;
    const value=`loudnorm=I=${target}:TP=-5:LRA=11:measured_I=${d.input_i}:measured_TP=${d.input_tp}:measured_LRA=${d.input_lra}:measured_thresh=${d.input_thresh}:offset=${d.target_offset}:linear=true`;
    this.normalCache.set(key,value);return value;
  }
  async execute(job){
    const controller=new AbortController();this.running={job,controller};const signal=controller.signal;
    const work=path.join(this.cacheDir,`is-${job.id}`);
    let partial;const created=[];
    try{
      await fsp.mkdir(work,{recursive:true});
      job.startedAt=new Date().toISOString();job.progress=0;this.state(job,'preparing','Kaynaklar hazırlanıyor',1);
      if(job.query&&!job.url){this.state(job,'searching','YouTube’da ilk video bulunuyor',2);const found=await this.search(job.query,signal);Object.assign(job,{url:found.url,videoId:found.id,title:found.title,channel:found.channel,songDuration:found.duration});this.save();this.notify();}
      const song=job.songPath||await (this.state(job,'downloading','YouTube şarkısı indiriliyor',2),this.download(job,work,signal));
      const songInfo=await probe(song,this.vendorDir,signal);
      // Geçersiz kesimi ses hizmeti/üretim maliyetinden önce yakala.
      plan(songInfo,{duration:1,hasAudio:true},job.settings);
      const settings=job.settings;this.state(job,'speech',settings.speechMode==='text'?'Jenerik seslendiriliyor':'Hazır jenerik okunuyor',34);
      const speech=settings.speechMode==='file'?settings.speechPath:await this.synthesize(settings,signal);
      const speechInfo=await probe(speech,this.vendorDir,signal),timing=plan(songInfo,speechInfo,settings);
      const bg=settings.backgroundEnabled?settings.bgPath:null;if(bg&&!(await probe(bg,this.vendorDir,signal)).hasAudio)throw new Error('Fon dosyasında ses kanalı yok.');
      job.timing=timing;job.songDuration=songInfo.duration;this.state(job,'analysing','Şarkı, konuşma ve fon sesleri dengeleniyor',42);
      const normal={song:await this.normalization(song,-18,signal),voice:await this.normalization(speech,-16,signal)};
      if(bg)normal.bg=await this.normalization(bg,-16,signal,Math.min(timing.gap,120));
      const graph=filterGraph(songInfo,timing,settings,!!bg,normal),script=path.join(work,'kurgu.ffscript');await fsp.writeFile(script,graph,'utf8');
      await fsp.mkdir(job.outputDir,{recursive:true});
      let stem=job.outputStem||`${safeName(job.title)} - Jenerik`;
      // Kullanıcı arada aynı adıyla bir dosya koymuşsa üzerine yazmak yerine yeni adı bildir.
      if(fs.existsSync(path.join(job.outputDir,stem+'.mp4'))||fs.existsSync(path.join(job.outputDir,stem+'.mp3')))stem=allocate(stem,occupied(job.outputDir,this.jobs.filter(j=>j.id!==job.id)));
      job.outputStem=stem;this.save();this.notify();const output=path.join(job.outputDir,stem+'.mp4');partial=path.join(work,'sonuc.mp4');
      const args=['-hide_banner','-nostdin','-y','-i',song,'-i',speech];if(bg)args.push('-stream_loop','-1','-i',bg);
      args.push('-filter_complex',graph,'-map','[vout]','-map','[aout]','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart','-t',String(timing.total),'-progress','pipe:1','-nostats',partial);
      this.state(job,'rendering','Siyah ekran, sesler ve geçişler birleştiriliyor',50);
      await run(path.join(this.vendorDir,'ffmpeg.exe'),args,{signal,onLine:line=>{if(line.startsWith('out_time_us=')){const seconds=Number(line.slice(12))/1e6;job.progress=Math.max(job.progress,Math.min(93,50+43*seconds/timing.total));job.detail=`Video hazırlanıyor · %${Math.round((job.progress-50)/43*100)}`;this.notify(false);}}});
      const media=await probe(partial,this.vendorDir,signal);if(!media.hasVideo||!media.hasAudio||Math.abs(media.duration-timing.total)>.3)throw new Error('Çıktı süresi/kanalları doğrulanamadı; tamamlandı olarak kaydedilmedi.');
      this.state(job,'saving','Çıktı kontrol edilip kaydediliyor',94);
      await fsp.copyFile(partial,output,fs.constants.COPYFILE_EXCL);created.push(output);job.file=output;
      if(settings.alsoMp3){const mp3=path.join(job.outputDir,stem+'.mp3'),tmp=path.join(work,'sonuc.mp3');await run(path.join(this.vendorDir,'ffmpeg.exe'),['-v','error','-nostdin','-y','-i',partial,'-vn','-c:a','libmp3lame','-b:a','192k',tmp],{signal});await fsp.copyFile(tmp,mp3,fs.constants.COPYFILE_EXCL);created.push(mp3);job.mp3=mp3;}
      if(signal.aborted)throw new Error('İşlem iptal edildi.');
      job.completedAt=new Date().toISOString();job.elapsedSeconds=(Date.now()-Date.parse(job.startedAt))/1000;job.outputInfo=media;this.state(job,'completed','MP4 hazır'+(job.mp3?' · MP3 de kaydedildi':''),100);
      // Yalnız bu işin özel geçici klasörü silinir. Seçilen asıl dosyalar korunur.
    }catch(error){for(const file of created)await fsp.unlink(file).catch(()=>{});job.file=null;job.mp3=null;job.error=signal.aborted?'İşlem iptal edildi.':friendly(error.message);job.errorDetail=signal.aborted?'':String(error.message).slice(-5000);this.state(job,signal.aborted?'cancelled':'failed',job.error,job.progress);}
    finally{
      if(path.dirname(work)===path.resolve(this.cacheDir))await fsp.rm(work,{recursive:true,force:true}).catch(()=>{});
      this.running=null;this.save();this.notify();this.pump();
    }
  }
  cancel(id){const job=this.jobs.find(j=>j.id===id);if(!job)throw new Error('İş bulunamadı.');if(this.running?.job.id===id)this.running.controller.abort();else if(job.status==='queued')this.state(job,'cancelled','Sıradan çıkarıldı',0);return true;}
  retry(id){const job=this.jobs.find(j=>j.id===id);if(!job||!['failed','cancelled','interrupted'].includes(job.status))throw new Error('Bu iş yeniden başlatılamıyor.');Object.assign(job,{status:'queued',progress:0,error:'',errorDetail:'',file:null,mp3:null,renderAttempt:(Number(job.renderAttempt)||0)+1,detail:'Yeniden sıraya alındı'});this.save();this.notify();this.pump();}
  cancelAll(){this.running?.controller.abort();for(const job of this.jobs)if(job.status==='queued')Object.assign(job,{status:'cancelled',detail:'Sıradan çıkarıldı',progress:0});this.save();this.notify();return true;}
  reuse(id){const job=this.jobs.find(j=>j.id===id);if(!job)throw new Error('İş bulunamadı.');return {settings:validateSettings({...job.settings,songPath:job.songPath||'',songPaths:[]}),urls:job.url||'',queries:job.query||''};}
  async shutdown(){this.closing=true;this.running?.controller.abort();this.serviceController.abort();for(const flight of this.speechFlights.values())flight.controller.abort();const end=Date.now()+12000;while((this.running||this.speechFlights.size||this.songPreviewFlights.size||this.speechActivity||this.searchActivity)&&Date.now()<end)await new Promise(r=>setTimeout(r,100));}
}
module.exports={Engine,ACTIVE,atomic,readJson,defaultSettings};
