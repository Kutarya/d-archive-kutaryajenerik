const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {validateSettings,plan,filterGraph,sources}=require('../electron/media.cjs');
const {Engine}=require('../electron/engine.cjs');
function engine(){const base=path.resolve(__dirname,'../../Kanitlar','isim-'+crypto.randomUUID());const e=new Engine({vendorDir:path.join(base,'arac'),dataDir:path.join(base,'Veriler'),outputDir:path.join(base,'Ciktilar')});e.pump=()=>{};return e;}
test('Ses kısılma/açılma ile görüntü kararma/açılma birbirinden bağımsız çalışır',()=>{
 const s=validateSettings({audioFadeOut:0,videoFadeOut:2,audioFadeIn:1.7,videoFadeIn:.4}),song={duration:12,hasAudio:true,hasVideo:true,width:640,height:360};
 const t=plan(song,{duration:3,hasAudio:true},s),g=filterGraph(song,t,s,false).split(';\n');
 assert(!g.find(x=>x.startsWith('[apre]')).includes('afade'));
 assert(g.find(x=>x.startsWith('[vpre]')).includes('fade=t=out:st=4.000000:d=2.000000'));
 assert(g.find(x=>x.startsWith('[apost]')).includes('afade=t=in:st=0:d=1.700000'));
 assert(g.find(x=>x.startsWith('[vpost]')).includes('fade=t=in:st=0:d=0.400000'));
 assert(!g.find(x=>x.startsWith('[1:a]')).includes('fade'));
 assert.equal(validateSettings({fade:.8}).videoFadeIn,.8);
});
test('Önceden gösterilen çıktı adı ve klasör, sıraya alınan işte aynen kullanılır',()=>{
 const e=engine(),raw={sourceMode:'search',queries:'Bir şarkı',text:'Reklam',outputName:'Depo Marketler',backgroundEnabled:false};
 const preview=e.outputPlan(raw);const [id]=e.enqueue(raw),job=e.jobs.find(j=>j.id===id);
 assert.equal(job.outputStem,'Depo Marketler');assert.equal(preview.files[0].mp4,path.join(job.outputDir,job.outputStem+'.mp4'));
 const reload=new Engine(e);assert.equal(reload.jobs[0].outputStem,'Depo Marketler');
});
test('Diskteki video/ses ve sıradaki iş adları çakışınca dosyaların üzerine yazılmaz',()=>{
 const e=engine(),raw={sourceMode:'search',queries:'Bir şarkı',text:'Reklam',outputName:'ISIM',backgroundEnabled:false};
 fs.writeFileSync(path.join(e.outputDir,'isim.mp3'),'koru');e.enqueue(raw);
 assert.equal(e.jobs[0].outputStem,'ISIM (2)');assert.equal(e.outputPlan(raw).files[0].stem,'ISIM (3)');
 assert.equal(fs.readFileSync(path.join(e.outputDir,'isim.mp3'),'utf8'),'koru');
});
test('Toplu özel ad her şarkıya ayrı dosya üretir; Windows geçersiz adları reddedilir',()=>{
 const e=engine(),raw={sourceMode:'search',queries:'Şarkı A\nŞarkı B',text:'Reklam',outputName:'Depo',backgroundEnabled:false};
 assert.deepEqual(e.outputPlan(raw).files.map(f=>f.stem),['Depo - Şarkı A','Depo - Şarkı B']);
 for(const name of ['CON','NUL.mp4','LPT1','../hata','ad.','ad?'])assert.throws(()=>validateSettings({outputName:name}));
});
test('Şarkı ekranında doğrulanan ilk sonuç daha sonra başka arama sonucuyla değişmez',()=>{
 const raw={sourceMode:'search',queries:'Bir şarkı\nDiğer şarkı',resolvedSource:{query:'Bir şarkı',url:'https://youtu.be/KUJm6JmYZpU',title:'Seçilen video'}};
 const s=sources(raw,validateSettings(raw));assert.equal(s[0].url,'https://www.youtube.com/watch?v=KUJm6JmYZpU');assert.equal(s[0].title,'Seçilen video');assert.equal(s[1].url,undefined);
 const linked={sourceMode:'link',urls:'https://youtu.be/KUJm6JmYZpU',resolvedSource:raw.resolvedSource};assert.equal(sources(linked,validateSettings(linked))[0].title,'Seçilen video');
});
test('Eski proje ayarları açık temaya ve önceki ortak geçiş değerine taşınır',()=>{const s=validateSettings({fade:1.5});assert.equal(s.theme,'light');assert.equal(s.audioFadeOut,1.5);assert.equal(s.videoFadeIn,1.5);assert.equal(validateSettings({theme:'dark'}).theme,'dark');});
