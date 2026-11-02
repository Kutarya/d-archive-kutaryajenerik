const fsp=require('node:fs/promises');
// Resmi API: elevenlabs.io/docs/api-reference/voices/search ve text-to-speech/convert.
// Anahtar yalnız HTTP başlığında bulunur; hata, önbellek, proje ve iş kaydına girmez.
class ElevenLabs {
  constructor({getKey=()=>'',fetchImpl=globalThis.fetch}={}){this.getKey=getKey;this.fetch=fetchImpl;this.cache=null;}
  get connected(){return !!this.getKey();}
  async request(endpoint,{key=this.getKey(),signal,body}={}){
    const timed=AbortSignal.timeout(body?120000:30000),combined=signal?AbortSignal.any([signal,timed]):timed;
    let response;
    try{response=await this.fetch('https://api.elevenlabs.io'+endpoint,{method:body?'POST':'GET',headers:{...(key?{'xi-api-key':key}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:combined,redirect:'error'});}
    catch(error){if(signal?.aborted)throw Object.assign(new Error('İşlem iptal edildi.'),{code:'CANCELLED'});throw new Error('ElevenLabs: Bağlantı kurulamadı veya yanıt süresi doldu. Yeniden deneyin.');}
    if(!response.ok){
      await response.body?.cancel().catch(()=>{});
      const reason=response.status===401?'API anahtarını kontrol edin.':response.status===403?'Bu ses veya işlem için hesabınızın izni yok.':response.status===429?'İstek sınırına ulaşıldı. Bir süre sonra yeniden deneyin.':response.status===400||response.status===402?'Hesap kredinizi ve seçilen sesin kullanılabilirliğini kontrol edin.':response.status===422?'Metni veya seçilen sesi kontrol edin.':`Hizmet yanıt vermedi (${response.status}).`;
      throw new Error('ElevenLabs: '+reason);
    }
    return response;
  }
  async voices({refresh=false,key=this.getKey(),signal}={}){
    if(!refresh&&this.cache&&this.cache.key===key&&Date.now()-this.cache.at<600000)return this.cache.voices;
    const voices=[],seen=new Set();let token='';
    for(let page=0;page<30;page++){
      const params=new URLSearchParams({page_size:'100',include_total_count:'false',sort:'name',sort_direction:'asc'});
      if(token)params.set('next_page_token',token);
      const response=await this.request('/v2/voices?'+params,{key,signal}),data=await response.json();
      if(!Array.isArray(data.voices))throw new Error('ElevenLabs: Ses listesi okunamadı.');
      for(const item of data.voices){
        if(!/^[A-Za-z0-9_-]{8,80}$/.test(item.voice_id||'')||seen.has(item.voice_id))continue;
        seen.add(item.voice_id);const gender=String(item.labels?.gender||item.sharing?.labels?.gender||'').toLowerCase();
        const languages=item.verified_languages||[],turkish=languages.some(v=>v.language==='tr')||/^tr|turkish/i.test(item.labels?.language||'');
        voices.push({id:'eleven:'+item.voice_id,name:String(item.name||'Aktör').slice(0,150),gender:gender==='female'?'Female':gender==='male'?'Male':'Unknown',locale:turkish?'tr-TR':'Çok dilli',provider:'elevenlabs',description:String(item.description||'').slice(0,350),turkish});
      }
      if(!data.has_more||!data.next_page_token)break;
      if(data.next_page_token===token)throw new Error('ElevenLabs: Ses listesi sayfaları okunamadı.');
      token=data.next_page_token;
    }
    if(!voices.length)throw new Error('ElevenLabs: Hesapta kullanılabilir ses bulunamadı.');
    this.cache={key,at:Date.now(),voices};return voices;
  }
  async synthesize(settings,output,signal){
    if(!this.connected)throw new Error('ElevenLabs: Önce API anahtarınızla hesabınızı bağlayın veya Türkçe doğal ses seçin.');
    if(settings.text.length>10000)throw new Error('ElevenLabs: Bu model için metni 10.000 karakterin altında tutun.');
    const voices=await this.voices({signal});if(!voices.some(v=>v.id===settings.voice))throw new Error('ElevenLabs: Seçilen ses hesabınızda bulunamadı. Ses listesini yenileyin.');
    const response=await this.request('/v1/text-to-speech/'+encodeURIComponent(settings.voice.slice(7))+'?output_format=mp3_44100_128',{signal,body:{text:settings.text,model_id:'eleven_multilingual_v2',voice_settings:{stability:.5,similarity_boost:.75,style:0,use_speaker_boost:true,speed:Math.max(.7,Math.min(1.2,1+settings.rate/100))}}});
    const type=response.headers.get('content-type')||'';
    if(!/audio\//i.test(type)){await response.body?.cancel().catch(()=>{});throw new Error('ElevenLabs: Hizmet bir ses dosyası döndürmedi.');}
    const buffer=Buffer.from(await response.arrayBuffer());
    if(buffer.length<200||buffer.length>80*1024*1024)throw new Error('ElevenLabs: Ses dosyasının boyutu geçersiz.');
    await fsp.writeFile(output,buffer);return output;
  }
}
module.exports={ElevenLabs};
