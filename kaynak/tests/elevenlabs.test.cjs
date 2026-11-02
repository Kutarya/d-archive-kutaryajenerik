const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {ElevenLabs}=require('../electron/elevenlabs.cjs');
const voice=(id,name,gender,language)=>({voice_id:id,name,labels:{gender,language}});
const female=voice('femaleVoice12345','Kadın Aktör','female','tr'),male=voice('maleVoice12345','Erkek Aktör','male','en');
test('ElevenLabs sesleri gerçek cevap alanlarından, tüm sayfalardan ve cinsiyetten alınır',async()=>{
 const requests=[],client=new ElevenLabs({getKey:()=> 'test-key',fetchImpl:async(url,options)=>{requests.push({url,options});return Response.json(requests.length===1?{voices:[female],has_more:true,next_page_token:'page2'}:{voices:[male,female],has_more:false});}});
 const list=await client.voices();assert.equal(list.length,2);assert.equal(list[0].gender,'Female');assert.equal(list[0].locale,'tr-TR');assert.equal(list[1].gender,'Male');assert.equal(list[1].locale,'Çok dilli');assert.match(requests[1].url,/next_page_token=page2/);assert.equal(requests[0].options.headers['xi-api-key'],'test-key');assert(!requests[0].url.includes('test-key'));
 await client.voices();assert.equal(requests.length,2);
});
test('ElevenLabs yetki hatasında yanıt gövdesi ve anahtar hata mesajına sızmaz',async()=>{
 const client=new ElevenLabs({getKey:()=> 'secret-key',fetchImpl:async()=>new Response('secret-key raw provider detail',{status:401})});
 await assert.rejects(client.voices(),error=>/API anahtarını/.test(error.message)&&!error.message.includes('secret-key')&&!error.message.includes('raw provider'));
});
test('Anahtar olmadan veya hesabın sesinde bulunmayan aktörde ücretli POST yapılmaz',async()=>{
 let requests=0;const client=new ElevenLabs({fetchImpl:async()=>{requests++;return Response.json({voices:[female]});}});
 await assert.rejects(client.synthesize({text:'Reklam',voice:'eleven:femaleVoice12345'},'unused'),/hesabınızı bağlayın/);assert.equal(requests,0);
 client.getKey=()=> 'test-key';await assert.rejects(client.synthesize({text:'Reklam',voice:'eleven:missingVoice123'},'unused'),/hesabınızda bulunamadı/);assert.equal(requests,1);
});
test('ElevenLabs TTS Türkçe metin ve modelle ses döndürür; yalnız başlık anahtarı taşır',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kutarya-eleven-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let sent;
 const client=new ElevenLabs({getKey:()=> 'test-key',fetchImpl:async(url,options)=>{if(options.method==='GET')return Response.json({voices:[female]});sent={url,options};return new Response(Buffer.alloc(500,1),{headers:{'content-type':'audio/mpeg'}});}});
 const file=path.join(dir,'preview.mp3');await client.synthesize({text:'Güzel fırsatlar, Depo Marketler!',voice:'eleven:femaleVoice12345',rate:-20},file);
 const body=JSON.parse(sent.options.body);assert.equal(body.text,'Güzel fırsatlar, Depo Marketler!');assert.equal(body.model_id,'eleven_multilingual_v2');assert.equal(body.voice_settings.speed,.8);assert.equal(fs.statSync(file).size,500);assert(!sent.options.body.includes('test-key'));assert.match(sent.url,/output_format=mp3_44100_128/);
});
test('Başarılı HTTP ile gelen JSON ses dosyası diye saklanmaz',async()=>{
 const client=new ElevenLabs({getKey:()=> 'test-key',fetchImpl:async(_url,options)=>Response.json(options.method==='GET'?{voices:[female]}:{error:'no audio'})});
 await assert.rejects(client.synthesize({text:'Reklam',voice:'eleven:femaleVoice12345',rate:0},'unused'),/ses dosyası döndürmedi/);
});
test('İptal edilmiş API isteği sıradan bağlantı hatası olarak gösterilmez',async()=>{
 const controller=new AbortController();controller.abort();const client=new ElevenLabs({fetchImpl:async()=>{throw new Error('aborted');}});
 await assert.rejects(client.voices({signal:controller.signal}),error=>error.code==='CANCELLED');
});
