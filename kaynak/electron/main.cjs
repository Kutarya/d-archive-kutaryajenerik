const {app,BrowserWindow,ipcMain,protocol,dialog,shell,clipboard,safeStorage}=require('electron');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {Readable}=require('node:stream');
const {Engine,ACTIVE,readJson,atomic}=require('./engine.cjs');
const {probe,validateSettings}=require('./media.cjs');
const {ElevenLabs}=require('./elevenlabs.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'kty-media',privileges:{standard:true,secure:true,stream:true,supportFetchAPI:true,corsEnabled:true}}]);
const testDir=process.argv.find(a=>a.startsWith('--kty-test-dir='))?.slice(15);
const smoke=process.argv.includes('--kty-smoke');
const base=testDir||process.env.PORTABLE_EXECUTABLE_DIR||path.resolve(__dirname,'../..');
const dataDir=path.join(base,'Veriler');fs.mkdirSync(dataDir,{recursive:true});
app.setPath('userData',path.join(dataDir,'Profil'));app.setAppUserModelId('com.kutarya.jenerik');
let win,engine,quitting=false;const authorized=new Set(),mediaTokens=new Map();
const authorize=file=>authorized.add(path.resolve(file));
const mediaUrl=file=>{authorize(file);const id=crypto.randomUUID();mediaTokens.set(id,path.resolve(file));return `kty-media://local/${id}`;};
const errors=[];
if(!testDir&&!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{win?.show();win?.focus();});
  app.whenReady().then(async()=>{
    const vendorDir=app.isPackaged?path.join(process.resourcesPath,'vendor'):path.join(__dirname,'../vendor');
    const secretFile=path.join(dataDir,'elevenlabs-anahtar.json');
    let elevenKey=process.env.ELEVENLABS_API_KEY||'',remembered=false;
    if(!elevenKey&&safeStorage.isEncryptionAvailable()){
      try{const secret=readJson(secretFile,{});if(secret.encrypted){elevenKey=safeStorage.decryptString(Buffer.from(secret.encrypted,'base64'));remembered=true;}}catch{}
    }
    const eleven=new ElevenLabs({getKey:()=>elevenKey});
    let outputDir=readJson(path.join(dataDir,'konum.json'),{}).outputDir||path.join(base,'Ciktilar');
    if(!path.isAbsolute(outputDir))outputDir=path.join(base,'Ciktilar');
    engine=new Engine({vendorDir,dataDir,outputDir,eleven,authorizeFile:file=>authorized.has(path.resolve(file))});
    for(const file of [engine.settings.songPath,...engine.settings.songPaths,engine.settings.speechPath,engine.settings.bgPath])if(file)authorize(file);
    for(const entry of engine.settings.entries||[])for(const file of [entry.songPath,entry.speechPath])if(file)authorize(file);
    for(const job of engine.jobs)for(const file of [job.songPath,job.settings?.speechPath,job.settings?.bgPath])if(file)authorize(file);
    protocol.handle('kty-media',async request=>{
      const token=new URL(request.url).pathname.slice(1),file=mediaTokens.get(token);
      if(!file)return new Response('Bulunamadı',{status:404});
      try{
        const stat=await fsp.stat(file),range=request.headers.get('range');let start=0,end=stat.size-1,status=200;
        const headers={'Content-Type':({'.mp4':'video/mp4','.webm':'video/webm','.mov':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.ogg':'audio/ogg','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file).toLowerCase()]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'};
        if(range){const m=range.match(/^bytes=(\d*)-(\d*)$/);if(!m)return new Response(null,{status:416});if(m[1]){start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}else if(m[2])start=Math.max(0,stat.size-Number(m[2]));if(start>end||start>=stat.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${stat.size}`}});status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;}
        headers['Content-Length']=String(end-start+1);
        return new Response(request.method==='HEAD'?null:Readable.toWeb(fs.createReadStream(file,{start,end})),{status,headers});
      }catch{return new Response('Dosya bulunamadı',{status:404});}
    });
    win=new BrowserWindow({width:1280,height:860,minWidth:900,minHeight:650,frame:false,backgroundColor:engine.settings.theme==='dark'?'#111916':'#f6f8f7',show:!smoke,
      icon:path.join(__dirname,'../ui/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,devTools:!!testDir,backgroundThrottling:false}});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',event=>event.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
    win.webContents.on('console-message',details=>{if(details.level==='error')errors.push(details.message);});
    const allowed=event=>event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame;
    const handle=(name,fn)=>ipcMain.handle('kty:'+name,async(event,...args)=>{if(!allowed(event))return {ok:false,error:'İstek reddedildi.'};try{return {ok:true,value:await fn(...args)};}catch(error){return {ok:false,error:error.message};}});
    const selected=async(file)=>{authorize(file);const info=await probe(file,vendorDir);return {path:file,name:path.basename(file),info,url:mediaUrl(file)};};
    handle('state',()=>engine.snapshot());handle('save',raw=>engine.updateSettings(raw));handle('voices',refresh=>engine.voices(!!refresh));
    handle('inspect',file=>{engine.checkFile(file);return selected(file);});
    handle('search',query=>engine.search(query));
    handle('lookup',url=>engine.lookup(url));handle('output-plan',raw=>engine.outputPlan(raw));
    handle('preview-song',async url=>selected(await engine.previewSong(url)));handle('cancel-song-preview',()=>engine.cancelSongPreview());
    handle('eleven-voices',refresh=>eleven.voices({refresh:!!refresh}));
    handle('eleven-status',()=>({connected:eleven.connected,remembered,canRemember:safeStorage.isEncryptionAvailable()}));
    handle('connect-eleven',async raw=>{
      const key=String(raw?.key||'').trim();if(key.length<8||key.length>512||/[\s\u0000-\u001f]/.test(key))throw new Error('ElevenLabs API anahtarını girin.');
      const voices=await eleven.voices({key,refresh:true});
      if(raw.remember){if(!safeStorage.isEncryptionAvailable())throw new Error('Windows anahtar saklama hizmeti kullanılamıyor. Hatırlama seçeneğini kapatıp yeniden deneyin.');atomic(secretFile,{encrypted:safeStorage.encryptString(key).toString('base64')});}
      else await fsp.unlink(secretFile).catch(error=>{if(error.code!=='ENOENT')throw error;});
      elevenKey=key;remembered=!!raw.remember;engine.notify();return {voices,connected:true,remembered};
    });
    handle('disconnect-eleven',async()=>{await fsp.unlink(secretFile).catch(error=>{if(error.code!=='ENOENT')throw error;});elevenKey='';remembered=false;eleven.cache=null;engine.notify();return true;});
    handle('choose-batch',async()=>{
      const pick=await dialog.showOpenDialog(win,{title:'Bir veya birden fazla şarkı videosu seç',properties:['openFile','multiSelections'],filters:[{name:'Video / ses',extensions:['mp4','mkv','webm','mov','avi','mp3','wav','m4a','flac','ogg']}]});
      if(pick.canceled)return null;if(pick.filePaths.length>200)throw new Error('Bir seferde en fazla 200 şarkı seçebilirsiniz.');
      const result=[];for(const file of pick.filePaths){const media=await selected(file);if(!media.info.hasAudio)throw new Error(media.name+': Ses kanalı bulunamadı.');result.push(media);}return result;
    });
    handle('choose',async kind=>{
      if(!['song','speech','bg'].includes(kind))throw new Error('Bilinmeyen dosya alanı.');
      const pick=await dialog.showOpenDialog(win,{title:kind==='song'?'Şarkı videosunu seç':kind==='speech'?'Hazır jenerik sesini seç':'Fon müziğini seç',properties:['openFile'],filters:[{name:'Medya dosyaları',extensions:kind==='song'?['mp4','mkv','webm','mov','avi','mp3','wav','m4a','flac','ogg']:['mp3','wav','m4a','flac','ogg','aac','mp4','mkv','webm']}]});
      if(pick.canceled)return null;const result=await selected(pick.filePaths[0]);if(!result.info.hasAudio)throw new Error('Dosyada ses kanalı bulunamadı.');return result;
    });
    handle('speech',async raw=>{const settings=validateSettings(raw),file=await engine.previewSpeech(settings),result=await selected(file);if(settings.speechMode==='text')result.name=(eleven.cache?.voices.find(v=>v.id===settings.voice)?.name||(settings.voice.startsWith('sapi:')?settings.voice.slice(5):settings.voice.match(/-([A-Za-z0-9]+)Neural$/)?.[1])||'Jenerik')+' · Ses önizlemesi';return result;});
    handle('export-speech',async raw=>{const settings=validateSettings(raw),ext=settings.speechMode==='file'?path.extname(settings.speechPath):settings.voice.startsWith('sapi:')?'.wav':'.mp3';const pick=await dialog.showSaveDialog(win,{title:'Jenerik sesini kaydet',defaultPath:path.join(engine.outputDir,'Kutarya Jenerik'+ext),filters:[{name:'Ses dosyası',extensions:[ext.slice(1)||'mp3']}]});if(pick.canceled)return null;const file=await engine.previewSpeech(settings);if(path.resolve(file)!==path.resolve(pick.filePath))await fsp.copyFile(file,pick.filePath);return pick.filePath;});
    handle('start',raw=>engine.enqueue(raw));handle('cancel',id=>engine.cancel(String(id)));handle('retry',id=>engine.retry(String(id)));
    handle('cancel-all',()=>engine.cancelAll());handle('reuse',id=>engine.reuse(String(id)));
    const outputFile=id=>{const job=engine.jobs.find(j=>j.id===id);if(job?.status!=='completed'||!job.file||!fs.existsSync(job.file))throw new Error('Tamamlanmış çıktı bulunamadı.');return job.file;};
    handle('output',async id=>selected(outputFile(id)));handle('reveal',id=>shell.showItemInFolder(outputFile(id)));
    handle('folder',async()=>{const error=await shell.openPath(engine.outputDir);if(error)throw new Error(error);return engine.outputDir;});
    handle('change-folder',async()=>{const pick=await dialog.showOpenDialog(win,{title:'Çıktı klasörünü seç',properties:['openDirectory','createDirectory'],defaultPath:engine.outputDir});if(pick.canceled)return null;engine.setOutput(pick.filePaths[0]);return engine.outputDir;});
    handle('paste',()=>clipboard.readText());
    handle('save-project',async raw=>{const settings=validateSettings(raw);const pick=await dialog.showSaveDialog(win,{title:'Kurgu ayarlarını kaydet',defaultPath:path.join(base,'Kurgu.kutarya.json'),filters:[{name:'Kutarya kurgu',extensions:['json']}]});if(pick.canceled)return null;atomic(pick.filePath,{app:'kutarya-jenerik',version:3,settings,urls:String(raw.urls||''),queries:String(raw.queries||'')});return pick.filePath;});
    handle('load-project',async()=>{const pick=await dialog.showOpenDialog(win,{title:'Kurgu ayarlarını aç',properties:['openFile'],filters:[{name:'Kutarya kurgu',extensions:['json']}]});if(pick.canceled)return null;const stat=await fsp.stat(pick.filePaths[0]);if(stat.size>16000000)throw new Error('Proje dosyası geçersiz.');const data=readJson(pick.filePaths[0],{});if(data.app!=='kutarya-jenerik')throw new Error('Kutarya kurgu dosyası seçin.');const settings=validateSettings({...data.settings,...(data.version===1?{sourceMode:'link'}:{})});for(const file of [settings.songPath,...settings.songPaths,settings.speechPath,settings.bgPath,...(settings.entries||[]).flatMap(e=>[e.songPath,e.speechPath])])if(file)authorize(file);engine.updateSettings(settings);return {settings,urls:String(data.urls||''),queries:String(data.queries||'')};});
    handle('clear-cache',async()=>{if(engine.running||engine.speechFlights.size||engine.speechActivity||engine.songPreviewFlights.size)throw new Error('Önbelleği temizlemek için devam eden kurgu, dinleme veya ses üretimini bitirin.');let count=0;for(const name of await fsp.readdir(engine.cacheDir)){const target=path.resolve(engine.cacheDir,name);if(path.dirname(target)!==path.resolve(engine.cacheDir))continue;await fsp.rm(target,{recursive:true,force:true});count++;}return count;});
    for(const [name,fn]of [['minimize',()=>win.minimize()],['maximize',()=>win.isMaximized()?win.unmaximize():win.maximize()],['close',()=>win.close()]])ipcMain.on('kty:'+name,event=>{if(allowed(event))fn();});
    engine.on('change',state=>{if(!win.isDestroyed())win.webContents.send('kty:changed',state);});
    win.on('close',event=>{if(!quitting&&engine.running){event.preventDefault();void dialog.showMessageBox(win,{type:'question',title:'Kurgu sürüyor',message:'Devam eden kurgu durdurulup uygulama kapatılsın mı?',buttons:['Devam et','Durdur ve kapat'],defaultId:0,cancelId:0}).then(result=>{if(result.response===1){quitting=true;void engine.shutdown().then(()=>app.quit());}});}});
    await win.loadFile(path.join(__dirname,'../ui/index.html'));
    if(!smoke&&process.argv.includes('--kty-capture')){
      // Kendi başlangıç ekranının kabul kanıtı; port açmadan ve proje üretmeden.
      const proofFolder=path.join(base,'Kanitlar','baslangic');await fsp.mkdir(proofFolder,{recursive:true});
      const limit=Date.now()+20000;while(Date.now()<limit&&!await win.webContents.executeJavaScript('window.uiReady===true'))await new Promise(r=>setTimeout(r,100));
      await win.webContents.executeJavaScript('document.fonts.ready');
      await new Promise(r=>setTimeout(r,400));await fsp.writeFile(path.join(proofFolder,'arayuz.png'),(await win.webContents.capturePage()).toPNG());
      atomic(path.join(proofFolder,'durum.json'),{packaged:app.isPackaged,base,outputDir:engine.outputDir,jobs:engine.jobs.length,version:app.getVersion(),capturedAt:new Date().toISOString()});
    }
    if(smoke){const {selfTest}=require('./batch-acceptance.cjs');const report=await selfTest({win,engine,selected,base,testDir,errors,packaged:app.isPackaged});atomic(path.join(testDir,'kabul.json'),report);quitting=true;await engine.shutdown();app.exit(report.passed?0:1);}
  }).catch(error=>{if(testDir)atomic(path.join(testDir,'failure.json'),{error:error.stack});else dialog.showErrorBox('Kutarya Jenerik',error.message);app.exit(1);});
}
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',event=>{if(!quitting&&engine){event.preventDefault();quitting=true;void engine.shutdown().then(()=>app.quit());}});
