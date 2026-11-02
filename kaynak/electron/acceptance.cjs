const fs=require('node:fs'),path=require('node:path');
const {run}=require('./process.cjs');
const {uiAcceptance,advanceToReview}=require('./wizard-acceptance.cjs');
async function providerAcceptance({win,engine,js,wait,check,files,testDir}){
 const originalFetch=engine.eleven.fetch,encoded=path.join(testDir,'aktor-test.mp3');
 await run(path.join(engine.vendorDir,'ffmpeg.exe'),['-v','error','-nostdin','-y','-i',files.speech,'-c:a','libmp3lame',encoded]);
 engine.eleven.fetch=async(_url,options)=>options.method==='GET'?Response.json({voices:[{voice_id:'femaleTestVoice1',name:'Test Kadın',labels:{gender:'female',language:'tr'}},{voice_id:'maleTestVoice12',name:'Test Erkek',labels:{gender:'male',language:'tr'}}],has_more:false}):new Response(fs.readFileSync(encoded),{headers:{'content-type':'audio/mpeg'}});
 try{
  const connected=await js("window.kutarya.connectEleven({key:'kutarya-sadece-test-anahtari',remember:true})");
  check('ElevenLabs bağlantı IPC ve gerçek Windows şifrelemesi (servis taklidi)',connected.ok&&fs.existsSync(path.join(engine.dataDir,'elevenlabs-anahtar.json'))&&!fs.readFileSync(path.join(engine.dataDir,'elevenlabs-anahtar.json'),'utf8').includes('kutarya-sadece-test-anahtari'));
  await js("document.querySelector('#voice-provider').value='elevenlabs';document.querySelector('#voice-provider').dispatchEvent(new Event('change'))");
  await wait(()=>js("Array.from(document.querySelector('#voice-select').options).some(o=>o.value==='eleven:maleTestVoice12')"));
  check('ElevenLabs kadın/erkek aktörler renderer listesine gelir (servis taklidi)',await js("document.querySelectorAll('#voice-cards [data-voice]').length===2"));
  await js("document.querySelector('#actor-gender').value='Male';document.querySelector('#actor-gender').dispatchEvent(new Event('input'))");
  check('Aktör filtresi cinsiyete göre seçenekleri daraltır (servis taklidi)',await js("Array.from(document.querySelector('#voice-select').options).some(o=>o.value==='eleven:maleTestVoice12')"));
  const voice=await js("window.kutarya.speech({text:'Kutarya aktör servis kabulü',voice:'eleven:maleTestVoice12'})");
  check('ElevenLabs ses üretim IPC / gerçek MP3 çözümleme (servis taklidi)',voice.ok&&voice.value.info.hasAudio&&voice.value.info.duration>2);
  const disconnected=await js('window.kutarya.disconnectEleven()');
  check('ElevenLabs bağlantısı kaldırılınca şifreli kayıt da kalkar',disconnected.ok&&!fs.existsSync(path.join(engine.dataDir,'elevenlabs-anahtar.json')));
 }finally{engine.eleven.fetch=originalFetch;engine.eleven.cache=null;await js("fill({backgroundEnabled:false})");}
}
async function companyAcceptance({win,engine,selected,js,wait,check,testDir,report}){
 const arg=process.argv.find(a=>a.startsWith('--kty-company-settings='));if(!arg)return;
 const saved=JSON.parse(fs.readFileSync(arg.slice(23),'utf8'));
 check('Şirkette kullanılan hazır jenerik/fon dosyaları mevcut',fs.existsSync(saved.speechPath)&&fs.existsSync(saved.bgPath));
 const speech=await selected(saved.speechPath),bg=await selected(saved.bgPath),before=engine.jobs.length;
 const raw={...saved,songPath:'',songPaths:[],speechMode:'file',sourceMode:'search',sourceText:'Tayfun Hadi Yine İyisin'};
 await js(`fill(${JSON.stringify(raw)});selected.speech=${JSON.stringify(speech)};selected.bg=${JSON.stringify(bg)};sourceUI();document.querySelector('#find-song').click();`);
 await wait(()=>js('!!searchResult'),90000);
 check('İsim araması CapCut görselindeki videoyu bulur',await js("searchResult.id==='KUJm6JmYZpU'"));
 fs.writeFileSync(path.join(testDir,'sirket-ilk-sonuc.png'),(await win.webContents.capturePage()).toPNG());
 await advanceToReview({js,wait});await js("document.querySelector('#create').click()");await wait(()=>engine.jobs.length===before+1);
 const job=engine.jobs.at(-1);await wait(()=>['completed','failed'].includes(job.status),600000);
 check('Şirket jeneriği + fon + isimle YouTube, portable gerçek çıktı',job.status==='completed',job.errorDetail);
 check('Gerçek şarkı korunur, ara jenerik süresinden hesaplanır',Math.abs(job.outputInfo.duration-(job.songDuration+speech.info.duration+.5))<.2,job.outputInfo);
 await js(`switchView('archive');document.querySelector('[data-id="${job.id}"] [data-job-action="play"]').click()`);
 await wait(()=>js(`previewMedia?.path===${JSON.stringify(job.file)} && document.querySelector('#video-preview').readyState>=2 && !document.querySelector('#jump-to-ad').disabled`));
 await js("document.querySelector('#jump-to-ad').click()");await wait(()=>js("!document.querySelector('#video-preview').seeking"));await js("document.querySelector('#video-preview').pause()");
 const seek=await js(`({position:document.querySelector('#video-preview').currentTime,expected:${Math.max(0,job.timing.cut-job.timing.audioFadeOut-.5)}})`);
 check('Reklam arasına git gerçek video üzerinde çalışır',Math.abs(seek.position-seek.expected)<.5,seek);
 fs.writeFileSync(path.join(testDir,'sirket-sonuc.png'),(await win.webContents.capturePage()).toPNG());report.company={...job,sourceSpeechInfo:speech.info,sourceBgInfo:bg.info,realUserMedia:true};
}
module.exports={uiAcceptance,providerAcceptance,companyAcceptance};
