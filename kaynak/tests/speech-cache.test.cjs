const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),fsp=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {Engine}=require('../electron/engine.cjs'),{validateSettings}=require('../electron/media.cjs');
function wave(){const sampleRate=16000,length=sampleRate/4,b=Buffer.alloc(44+length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sampleRate,24);b.writeUInt32LE(sampleRate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(length*2,40);for(let i=0;i<length;i++)b.writeInt16LE(Math.round(Math.sin(i/sampleRate*440*Math.PI*2)*8000),44+i*2);return b;}
function engine(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kutarya-speech-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return new Engine({vendorDir:path.resolve(__dirname,'../vendor'),dataDir:path.join(dir,'data'),outputDir:path.join(dir,'out')});}
test('Önizleme ve kurgu aynı sesi tek üretimden alır; birinin iptali diğerini bozmaz',async t=>{
 const e=engine(t);let calls=0;e.speechRequest=async(request)=>{calls++;await new Promise(r=>setTimeout(r,100));await fsp.writeFile(request.output,wave());};
 const settings=validateSettings({text:'Aynı reklam',voice:'sapi:Test'}),cancel=new AbortController();
 const first=e.synthesize(settings,cancel.signal),second=e.synthesize(settings);cancel.abort();
 await assert.rejects(first,error=>error.code==='CANCELLED');const output=await second;assert(fs.existsSync(output));assert.equal(calls,1);assert.equal(e.speechFlights.size,0);
 assert.equal(await e.synthesize(settings),output);assert.equal(calls,1);assert(!(await fsp.readdir(e.cacheDir)).some(n=>n.includes('.partial')));
});
test('Ses ayarı değiştiğinde eski ses önbelleği kullanılmaz',async t=>{
 const e=engine(t);let calls=0;e.speechRequest=async request=>{calls++;await fsp.writeFile(request.output,wave());};
 const first=await e.synthesize(validateSettings({text:'Reklam',voice:'sapi:Test',rate:0})),second=await e.synthesize(validateSettings({text:'Reklam',voice:'sapi:Test',rate:10}));assert.notEqual(first,second);assert.equal(calls,2);
});
