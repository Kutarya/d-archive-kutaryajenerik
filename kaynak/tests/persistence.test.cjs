const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Engine}=require('../electron/engine.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'kty-persistence-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return new Engine({vendorDir:path.join(root,'vendor'),dataDir:path.join(root,'data'),outputDir:path.join(root,'output')});}
test('Taslak yazımı başarısızsa kullanıcıya gösterilen ve diskteki son ayarlar korunur',t=>{
 const e=fixture(t);e.updateSettings({text:'Korunacak jenerik'});
 const before=e.snapshot().settings,file=path.join(e.dataDir,'ayarlar.json');
 fs.mkdirSync(file+'.tmp');
 assert.throws(()=>e.updateSettings({text:'Kaydedilemeyen jenerik'}));
 assert.deepEqual(e.snapshot().settings,before);
 assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).text,before.text);
 fs.rmdirSync(file+'.tmp');
 e.updateSettings({text:'Düzeltmeden sonra kaydedildi'});
 assert.equal(new Engine(e).settings.text,'Düzeltmeden sonra kaydedildi');
});
test('Kayıt klasörü oluşturulamazsa çıktı planı önceki konumda kalır',t=>{
 const e=fixture(t),original=e.outputDir,blocked=path.join(e.dataDir,'dosya');fs.writeFileSync(blocked,'engel');
 assert.throws(()=>e.setOutput(path.join(blocked,'alt')));
 assert.equal(e.outputDir,original);
 assert.equal(e.outputPlan({sourceMode:'search',queries:'Bir şarkı',text:'Jenerik',outputName:'Çıktı',backgroundEnabled:false}).folder,original);
});
test('Kayıt konumu diske yazılamazsa yeni konum etkinleşmez; düzeltme sonrası tekrar denenebilir',t=>{
 const e=fixture(t),original=e.outputDir,newFolder=path.join(e.dataDir,'yeni'),file=path.join(e.dataDir,'konum.json');
 e.setOutput(original);fs.mkdirSync(file+'.tmp');
 assert.throws(()=>e.setOutput(newFolder));assert.equal(e.outputDir,original);
 assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).outputDir,original);
 fs.rmdirSync(file+'.tmp');e.setOutput(newFolder);
 assert.equal(e.outputDir,newFolder);assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).outputDir,newFolder);
});
