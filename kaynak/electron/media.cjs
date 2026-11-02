const fs=require('node:fs/promises');
const path=require('node:path');
const {run}=require('./process.cjs');

function parseYouTube(input) {
  let url;try{url=new URL(String(input).trim());}catch{throw new Error('Bir YouTube video bağlantısı yazın.');}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Geçerli bir YouTube video bağlantısı kullanın.');
  const host=url.hostname.toLowerCase();let id;
  if(host==='youtu.be')id=url.pathname.split('/')[1];
  else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host)){
    if(url.pathname==='/watch')id=url.searchParams.get('v');
    else id=url.pathname.match(/^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})(?:\/)?$/)?.[1];
  }
  if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))throw new Error('Arama/kanal/oynatma listesi yerine video bağlantısı kullanın.');
  return {id,url:`https://www.youtube.com/watch?v=${id}`};
}
const number=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
function validateSettings(raw={}) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Kurgu ayarları geçersiz.');
  const text=String(raw.text||'').trim();
  if(text.length>20000)throw new Error('Metin çok uzun; bu jeneriği birkaç parçaya ayırın.');
  const voice=String(raw.voice||'tr-TR-EmelNeural');
  if(!/^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9]+Neural$/.test(voice)&&!/^sapi:[^\r\n\u0000]{1,150}$/.test(voice)&&!/^eleven:[A-Za-z0-9_-]{8,80}$/.test(voice))throw new Error('Seslendirme kişisini listeden seçin.');
  const songPaths=Array.isArray(raw.songPaths)?[...new Set(raw.songPaths.filter(p=>typeof p==='string'&&p))]:[];
  const sourceMode=raw.sourceMode==='link'?'link':'search',sourceText=String(raw.sourceText??(sourceMode==='link'?raw.urls:raw.queries)??'');
  if(sourceText.length>65000)throw new Error('Şarkı listesi çok uzun; listeyi birkaç parçaya ayırın.');
  if(songPaths.length>200)throw new Error('Bir seferde en fazla 200 şarkı ekleyebilirsiniz.');
  for(const file of [raw.songPath,raw.speechPath,raw.bgPath,...songPaths])if(typeof file==='string'&&(file.length>32000||/[\r\n\u0000]/.test(file)))throw new Error('Dosya yolu geçersiz.');
  const eleven=voice.startsWith('eleven:');
  const fade=number(raw.fade,0,3,1);
  const outputName=String(raw.outputName||'').trim().replace(/\.(mp4|mp3)$/i,'');
  if(outputName.length>80||/[<>:"/\\|?*\u0000-\u001f]/.test(outputName)||/[. ]$/.test(outputName)||/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(outputName))throw new Error('Video adı en fazla 80 karakter olmalı; / \\ : * ? gibi işaretler kullanmayın.');
  return {text,voice,rate:Math.round(number(raw.rate,eleven?-30:-50,eleven?20:50,0)),pitch:eleven?0:Math.round(number(raw.pitch,-30,30,0)),
    fade,audioFadeOut:number(raw.audioFadeOut,0,3,fade),audioFadeIn:number(raw.audioFadeIn,0,3,fade),videoFadeOut:number(raw.videoFadeOut,0,3,fade),videoFadeIn:number(raw.videoFadeIn,0,3,fade),
    voiceGain:number(raw.voiceGain,-12,12,3.7),songGain:number(raw.songGain,-12,6,0),bgGain:number(raw.bgGain,-36,0,-18),
    cutMode:raw.cutMode==='manual'?'manual':'half',cutSecond:number(raw.cutSecond,0,86400,0),
    speechMode:raw.speechMode==='file'?'file':'text',songPath:typeof raw.songPath==='string'?raw.songPath:'',songPaths,speechPath:typeof raw.speechPath==='string'?raw.speechPath:'',
    sourceMode,sourceText,
    bgPath:typeof raw.bgPath==='string'?raw.bgPath:'',backgroundEnabled:raw.backgroundEnabled==null?!!raw.bgPath:raw.backgroundEnabled!==false,alsoMp3:raw.alsoMp3!==false,
    outputName,theme:raw.theme==='dark'?'dark':'light',outputHeight:[720,1080].includes(Number(raw.outputHeight))?Number(raw.outputHeight):1080,
    ...(raw.entries!==undefined?{entries:normalizeDraftEntries(raw.entries)}:{})};
}
function normalizeDraftEntries(entries){
  if(!Array.isArray(entries)||entries.length<1||entries.length>200)throw new Error('Taslakta 1 ile 200 arasında şarkı olmalı.');
  const ids=new Set();
  return entries.map(entry=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry)||typeof entry.id!=='string'||!/^[A-Za-z0-9-]{1,80}$/.test(entry.id)||ids.has(entry.id))throw new Error('Şarkı kaydı geçersiz veya tekrarlı.');
    ids.add(entry.id);
    const s=validateSettings({...entry,entries:undefined,outputName:''});
    if(s.sourceText.length>2048)throw new Error('Her şarkı alanına tek bir isim veya bağlantı yazın.');
    const name=String(entry.outputName||'');if(name.length>84)throw new Error('Video adı çok uzun.');
    let resolvedSource=null;
    if(entry.resolvedSource){const r=entry.resolvedSource,link=parseYouTube(r.url);resolvedSource={...link,title:String(r.title||'').slice(0,500),channel:String(r.channel||'').slice(0,500),query:String(r.query||'').slice(0,300),duration:number(r.duration,0,86400,0)};}
    return {id:entry.id,sourceMode:entry.sourceMode==='local'?'local':s.sourceMode,sourceText:s.sourceText,songPath:s.songPath,resolvedSource,
      speechMode:s.speechMode,speechPath:s.speechPath,text:s.text,voice:s.voice,rate:s.rate,pitch:s.pitch,outputName:name};
  });
}
function searchQuery(input){
  const query=String(input??'').trim().replace(/\s+/gu,' ');
  if(query.length<2)throw new Error('Şarkı veya sanatçı adını en az iki karakterle yazın.');
  if(query.length>300||/[\u0000-\u001f]/u.test(query))throw new Error('Arama metni çok uzun veya geçersiz.');
  if(/^https?:\/\//i.test(query))throw new Error('YouTube bağlantıları için Bağlantı ile seçeneğini kullanın.');
  return query;
}
function sources(raw,settings){
  const paths=settings.songPaths.length?settings.songPaths:settings.songPath?[settings.songPath]:[];
  if(paths.length)return [...new Set(paths)].map(songPath=>({songPath,title:path.parse(songPath).name}));
  const mode=raw.sourceMode|| (raw.queries?'search':'link');
  const input=String(mode==='search'?(raw.queries??raw.urls??''):(raw.urls||''));
  const lines=input.trim().split(mode==='search'?/[\r\n]+/u:/\s+/u).filter(Boolean);
  if(!lines.length)throw new Error('Şarkı adını yazın, YouTube bağlantısı ekleyin veya bilgisayarınızdan video seçin.');
  if(lines.length>200)throw new Error('Bir seferde en fazla 200 şarkı ekleyebilirsiniz.');
  const unique=new Map();
  for(const line of lines){
    if(mode==='search'){
      const query=searchQuery(line),resolved=raw.resolvedSource;
      const pinned=resolved&&String(resolved.query||'').trim().replace(/\s+/gu,' ').toLocaleLowerCase('tr-TR')===query.toLocaleLowerCase('tr-TR')?parseYouTube(resolved.url):null;
      unique.set(query.toLocaleLowerCase('tr-TR'),{query,title:pinned?String(resolved.title||query).slice(0,500):query,...(pinned?{url:pinned.url,id:pinned.id}:{} )});
    }
    else {const link=parseYouTube(line),resolved=raw.resolvedSource;const pinned=resolved?.url&&parseYouTube(resolved.url).id===link.id;unique.set(link.id,{...link,title:pinned?String(resolved.title||'YouTube videosu').slice(0,500):'YouTube '+link.id});}
  }
  return [...unique.values()];
}
async function probe(file,vendor,signal) {
  const stat=await fs.stat(file);if(!stat.isFile()||!stat.size)throw new Error('Medya dosyası boş veya bulunamadı.');
  const result=await run(path.join(vendor,'ffprobe.exe'),['-v','error','-show_format','-show_streams','-of','json',file],{signal,timeout:45000});
  let data;try{data=JSON.parse(result.stdout);}catch{throw new Error('Medya bilgisi okunamadı.');}
  const video=data.streams?.find(s=>s.codec_type==='video'&&!(s.disposition?.attached_pic));
  const audio=data.streams?.find(s=>s.codec_type==='audio');
  const duration=Number(data.format?.duration||video?.duration||audio?.duration);
  if(!Number.isFinite(duration)||duration<=0)throw new Error('Bu dosyanın süresi okunamıyor.');
  return {duration,hasVideo:!!video,hasAudio:!!audio,width:video?.width||0,height:video?.height||0,size:stat.size,videoCodec:video?.codec_name,audioCodec:audio?.codec_name};
}
function plan(song,speech,settings) {
  if(!song.hasAudio)throw new Error('Seçilen şarkıda ses kanalı yok.');
  if(!speech.hasAudio)throw new Error('Seçilen jenerik dosyasında ses kanalı yok.');
  if(song.duration<2)throw new Error('Şarkı en az iki saniye olmalı.');
  const cut=settings.cutMode==='manual'?settings.cutSecond:song.duration/2;
  if(cut<.5||cut>song.duration-.5)throw new Error('Kesim noktası şarkının başlangıcı ve sonundan en az yarım saniye uzakta olmalı.');
  const gap=speech.duration+.5;
  const fade=Math.min(settings.fade,cut,song.duration-cut);
  const audioFadeOut=Math.min(settings.audioFadeOut??settings.fade,cut),audioFadeIn=Math.min(settings.audioFadeIn??settings.fade,song.duration-cut);
  const videoFadeOut=Math.min(settings.videoFadeOut??settings.fade,cut),videoFadeIn=Math.min(settings.videoFadeIn??settings.fade,song.duration-cut);
  const h=Math.min(settings.outputHeight,song.hasVideo?Math.max(2,Math.round(song.height/2)*2):settings.outputHeight);
  const w=song.hasVideo?Math.max(2,Math.round((song.width/song.height*h)/2)*2):Math.round(h*16/9/2)*2;
  return {cut,gap,fade,audioFadeOut,audioFadeIn,videoFadeOut,videoFadeIn,total:song.duration+gap,speechDuration:speech.duration,head:.25,width:w,height:h};
}
function safeName(name) {let value=Array.from(String(name||'Jenerik').replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').trim()).slice(0,95).join('').replace(/[. ]+$/g,'')||'Jenerik';if(/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(value))value='Kutarya '+value;return value;}
function filterGraph(songInfo,timing,settings,hasBg,normal={}) {
  const {cut,gap,fade,width,height,head}=timing;
  const audioOut=timing.audioFadeOut??fade,audioIn=timing.audioFadeIn??fade,videoOut=timing.videoFadeOut??fade,videoIn=timing.videoFadeIn??fade;
  const num=n=>Number(n).toFixed(6);
  const norm=(key,target)=>normal[key]||`loudnorm=I=${target}:TP=-5:LRA=11`;
  const vf=videoOut>0?`,fade=t=out:st=${num(cut-videoOut)}:d=${num(videoOut)}`:'';
  const vi=videoIn>0?`,fade=t=in:st=0:d=${num(videoIn)}`:'';
  const af=audioOut>0?`,afade=t=out:st=${num(cut-audioOut)}:d=${num(audioOut)}`:'';
  const ai=audioIn>0?`,afade=t=in:st=0:d=${num(audioIn)}`:'';
  const g=[];
  if(songInfo.hasVideo)g.push(`[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p,split=2[vpre][vpost]`);
  else g.push(`color=c=0x151523:s=${width}x${height}:r=30:d=${num(songInfo.duration)},split=2[vpre][vpost]`);
  g.push(`[vpre]trim=end=${num(cut)},setpts=PTS-STARTPTS${vf}[v1]`);
  g.push(`color=c=black:s=${width}x${height}:r=30:d=${num(gap)},format=yuv420p,setsar=1[v2]`);
  g.push(`[vpost]trim=start=${num(cut)}:end=${num(songInfo.duration)},setpts=PTS-STARTPTS${vi}[v3]`);
  g.push(`[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,${norm('song',-18)},volume=${settings.songGain}dB,apad,atrim=end=${num(songInfo.duration)},asplit=2[apre][apost]`);
  g.push(`[apre]atrim=end=${num(cut)},asetpts=PTS-STARTPTS${af}[a1]`);
  g.push(`[apost]atrim=start=${num(cut)}:end=${num(songInfo.duration)},asetpts=PTS-STARTPTS${ai}[a3]`);
  const voice=`[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,${norm('voice',-16)},volume=${settings.voiceGain}dB,adelay=${Math.round(head*1000)}:all=1,apad,atrim=end=${num(gap)}`;
  if(hasBg){
    g.push(`${voice},asplit=2[spoken][detector]`);
    g.push(`[2:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,${norm('bg',-16)},volume=${settings.bgGain}dB,atrim=end=${num(gap)},asetpts=PTS-STARTPTS,afade=t=in:d=0.15,afade=t=out:st=${num(Math.max(0,gap-.15))}:d=0.15[bed]`);
    g.push(`[bed][detector]sidechaincompress=threshold=0.025:ratio=6:attack=15:release=250[ducked]`);
    g.push(`[spoken][ducked]amix=inputs=2:duration=first:normalize=0[a2]`);
  }else g.push(`${voice}[a2]`);
  g.push('[v1][a1][v2][a2][v3][a3]concat=n=3:v=1:a=1[vout][joined]');
  // level=false limiter'in sesi kendiliğinden yükseltmesini önler; jenerikte fade yoktur.
  g.push('[joined]alimiter=limit=0.891:level=false:latency=true,aresample=48000[aout]');
  return g.join(';\n');
}
module.exports={parseYouTube,validateSettings,probe,plan,safeName,filterGraph,searchQuery,sources};
