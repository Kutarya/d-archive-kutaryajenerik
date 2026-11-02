const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {sources,validateSettings}=require('../electron/media.cjs');
const {Engine}=require('../electron/engine.cjs');
function engine(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kutarya-queue-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const e=new Engine({vendorDir:dir,dataDir:path.join(dir,'data'),outputDir:path.join(dir,'out')});e.pump=()=>{};return e;}
test('İsim araması çok kelimeli satırları korur ve aynı isimleri tek işe indirger',()=>{
 const raw={sourceMode:'search',queries:'Tayfun Hadi Yine İyisin\n  TAYFUN Hadi Yine İyisin\nİkinci Şarkı'};
 assert.deepEqual(sources(raw,validateSettings(raw)).map(s=>s.query),['TAYFUN Hadi Yine İyisin','İkinci Şarkı']);
});
test('Toplu kuyruğun son satırı geçersizse hiçbir iş eklenmez',t=>{
 const e=engine(t);assert.throws(()=>e.enqueue({sourceMode:'link',urls:'https://youtu.be/YE7VzlLtp-4\nhttps://evil.example/x',text:'Reklam',backgroundEnabled:false}));assert.equal(e.jobs.length,0);
 assert.throws(()=>e.enqueue({sourceMode:'search',queries:'Geçerli Şarkı\nx',text:'Reklam',backgroundEnabled:false}));assert.equal(e.jobs.length,0);
});
test('150 şarkı tek başvuruda ayrı kimlik ve değişmez jenerikle kalıcı sıraya girer',t=>{
 const e=engine(t),queries=Array.from({length:150},(_,i)=>'Sanatçı Şarkı '+i).join('\n');
 const ids=e.enqueue({sourceMode:'search',queries,text:'Depo Marketler',outputName:'Toplu test',backgroundEnabled:false});
 assert.equal(ids.length,150);assert.equal(new Set(ids).size,150);assert(e.jobs.every(j=>j.settings.text==='Depo Marketler'&&j.query&&!j.settings.sourceText));
 const reopened=new Engine({...e});assert.equal(reopened.jobs.length,150);assert(reopened.jobs.every(j=>j.status==='interrupted'));
});
test('Boş fon varsayılanı üretimi engellemez, kullanıcı fonu açmışsa dosya gerekir',t=>{
 const e=engine(t);assert.equal(validateSettings({}).backgroundEnabled,false);
 assert.throws(()=>e.enqueue({urls:'https://youtu.be/YE7VzlLtp-4',text:'Reklam',outputName:'Fon testi',backgroundEnabled:true}),/Dosya seç/);assert.equal(e.jobs.length,0);
});
test('Disk yazımı başarısızsa kuyruk ve son ayarlar geri alınır',t=>{
 const e=engine(t),previous=e.settings;e.save=()=>{throw new Error('Disk yazımı başarısız');};
 assert.throws(()=>e.enqueue({urls:'https://youtu.be/YE7VzlLtp-4',text:'Yeni metin',outputName:'Disk testi'}),/Disk/);assert.equal(e.jobs.length,0);assert.deepEqual(e.settings,previous);
});
test('API anahtarı veya tanınmayan alanlar kurgu/iş ayarlarına alınmaz',()=>{
 const settings=validateSettings({voice:'eleven:JBFqnCBsd6RMkjVDRZzb',apiKey:'secret',elevenKey:'secret',rate:50,pitch:22});
 assert(!JSON.stringify(settings).includes('secret'));assert.equal(settings.rate,20);assert.equal(settings.pitch,0);
 assert.throws(()=>validateSettings({voice:'eleven:../../bad'}));assert.throws(()=>validateSettings({sourceText:'x'.repeat(65001)}));
});
test('200 üzeri kaynak işi başlamadan reddedilir',()=>{
 const raw={sourceMode:'search',queries:Array.from({length:201},(_,i)=>'Şarkı '+i).join('\n')};assert.throws(()=>sources(raw,validateSettings(raw)),/200/);
});
