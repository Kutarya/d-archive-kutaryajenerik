const fs=require('node:fs'),path=require('node:path');
async function advanceToReview({js,wait}){
 for(let step=1;step<=3;step++){
  await js("document.querySelector('#next-step').click()");
  await wait(()=>js(`wizardStep===${step+1}&&!wizardBusy`),120000);
 }
 await wait(()=>js('!!outputPlan'));
}
async function uiAcceptance({win,engine,js,wait,check,testDir,selected,files}){
 check('Yeni ürün düzeni: tek adım, kenar çubuğu yok, varsayılan beyaz tema',await js("document.documentElement.dataset.theme==='light'&&!document.querySelector('.sidebar')&&document.querySelectorAll('[data-panel]:not(.hidden)').length===1"));
 check('İlk girişte sonraki bütün adımlar ve oluşturma kilitli',await js("wizardStep===1&&document.querySelector('#step-speech').disabled&&document.querySelector('#step-bg').disabled&&document.querySelector('#step-result').disabled&&document.querySelector('#create').classList.contains('hidden')"));
 await js("document.querySelector('#next-step').click()");
 await wait(()=>js("!document.querySelector('#song-error').classList.contains('hidden')"));
 check('Eksik şarkı sonraki ekranı açmaz veya iş oluşturmaz',engine.jobs.length===0&&await js('wizardStep===1'));
 const song=await selected(files.song),speech=await selected(files.speech),bg=await selected(files.bg);
 await js(`fill({songPath:${JSON.stringify(song.path)},backgroundEnabled:false});selected.song=${JSON.stringify(song)};sourceUI();document.querySelector('#next-step').click()`);
 await wait(()=>js('wizardStep===2&&!wizardBusy'));
 check('Şarkı tamamlanınca yalnız jenerik ekranı açılır',await js("document.querySelector('#song-screen').classList.contains('hidden')&&!document.querySelector('#speech-screen').classList.contains('hidden')&&document.querySelector('#step-bg').disabled"));
 await js("document.querySelector('#next-step').click()");
 check('Boş jenerik metni bir sonraki ekranı açmaz',await js("wizardStep===2&&!document.querySelector('#speech-error').classList.contains('hidden')"));
 await js(`document.querySelector('#file-tab').click();selected.speech=${JSON.stringify(speech)};sourceUI();document.querySelector('#next-step').click()`);
 await wait(()=>js('wizardStep===3&&!wizardBusy'));
 check('Hazır jenerik doğrulanınca fon ekranı açılır, sonuç hâlâ kilitli',await js("!document.querySelector('#bg-screen').classList.contains('hidden')&&document.querySelector('#step-result').disabled"));
 await js("document.querySelector('#background-enabled').checked=true;document.querySelector('#background-enabled').dispatchEvent(new Event('input'));document.querySelector('#next-step').click()");
 check('Açılmış fon dosyasızken son ekrana geçilemez',await js("wizardStep===3&&!document.querySelector('#bg-error').classList.contains('hidden')"));
 await js(`selected.bg=${JSON.stringify(bg)};sourceUI();document.querySelector('#advanced').open=true;document.querySelector('#audio-fade-out').value='0';document.querySelector('#video-fade-out').value='2';document.querySelector('#audio-fade-in').value='1.7';document.querySelector('#video-fade-in').value='.4';updateControls()`);
 check('Ses ve görüntü geçişlerinin dört ayrı kontrolü ayarı korur',await js("settings().audioFadeOut===0&&settings().videoFadeOut===2&&settings().audioFadeIn===1.7&&settings().videoFadeIn===.4"));
 await js("document.querySelector('#cut-mode').value='manual';document.querySelector('#cut-mode').dispatchEvent(new Event('input'));document.querySelector('#cut-second').value='99:99';document.querySelector('#cut-second').dispatchEvent(new Event('input'));document.querySelector('#next-step').click()");
 check('Geçersiz dakika:saniye değeri sonucu engeller',await js("wizardStep===3&&!document.querySelector('#transition-error').classList.contains('hidden')"));
 await js("document.querySelector('#cut-second').value='00:04';document.querySelector('#cut-second').dispatchEvent(new Event('input'))");
 check('Dakika:saniye kontrolü gerçek saniyeye çevrilir',await js('settings().cutSecond===4'));
 await js("document.querySelector('#previous-step').click()");
 check('Geri dönüş jenerik ve fon dosyalarını korur',await js(`wizardStep===2&&selected.speech.path===${JSON.stringify(speech.path)}&&selected.bg.path===${JSON.stringify(bg.path)}`));
 await js("document.querySelector('#next-step').click()");await wait(()=>js('wizardStep===3&&!wizardBusy'));
 await js("document.querySelector('#reset-settings').click();document.querySelector('#cut-mode').value='half';document.querySelector('#cut-mode').dispatchEvent(new Event('input'));document.querySelector('#advanced').open=false;document.querySelector('#next-step').click()");
 await wait(()=>js('wizardStep===4&&!wizardBusy&&!!outputPlan'));
 check('Üç adım tamamlanınca ayrı kontrol/kayıt ekranı açılır',engine.jobs.length===0&&await js("!document.querySelector('#result-screen').classList.contains('hidden')&&!document.querySelector('#create').classList.contains('hidden')"));
 await js("document.querySelector('#output-name').value='Depo Marketler - Kabul';document.querySelector('#output-name').dispatchEvent(new Event('input'))");
 await wait(()=>js("outputPlan?.files[0].stem==='Depo Marketler - Kabul'"));
 check('Oluşturmadan önce ad, MP4 uzantısı ve tam kayıt klasörü açıklanır',await js(`document.querySelector('#planned-name').textContent==='Depo Marketler - Kabul.mp4'&&document.querySelector('#output-dir').textContent===${JSON.stringify(engine.outputDir)}`));
 await js("document.querySelector('#output-name').value='hata?';document.querySelector('#output-name').dispatchEvent(new Event('input'));document.querySelector('#create').click()");
 check('Geçersiz dosya adı iş oluşturmadan ilgili alanda gösterilir',engine.jobs.length===0&&await js("!document.querySelector('#output-error').classList.contains('hidden')"));
 await js("document.querySelector('#output-name').value='Depo Marketler - Kabul';document.querySelector('#output-name').dispatchEvent(new Event('input'))");
 // Ekranların gerçek boyalı hali; düzen üretim kontrollerinin üstünü kapatmamalı.
 for(const theme of ['light','dark']){
  await js(`setTheme('${theme}');scheduleSave()`);await new Promise(r=>setTimeout(r,600));
  check(theme+' tema kayda alınır',engine.settings.theme===theme);
  for(const [width,height]of [[1280,860],[900,650]]){
   win.setSize(width,height);await new Promise(r=>setTimeout(r,150));
   for(let step=1;step<=4;step++){
    await js(`setStep(${step});document.querySelector('#advanced').open=false;`);
    await new Promise(r=>setTimeout(r,180));
    const detail=await js(`(()=>{const b=document.querySelector('#'+(wizardStep===4?'create':'next-step')).getBoundingClientRect();return {step:wizardStep,width:innerWidth,scroll:document.documentElement.scrollWidth,footer:b.bottom,visible:Array.from(document.querySelectorAll('[data-panel]:not(.hidden)')).length,overflow:Array.from(document.querySelectorAll('[data-panel]:not(.hidden) .surface,.step-rail,.footer-inner')).filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.id||el.className)};})()`);
    check(theme+' / '+width+' px / ekran '+step,detail.scroll<=detail.width&&detail.footer<=height&&detail.visible===1&&detail.overflow.length===0,detail);
    fs.writeFileSync(path.join(testDir,`${theme}-${width}-adim-${step}.png`),(await win.webContents.capturePage()).toPNG());
   }
  }
 }
 await js("setStep(1);document.querySelector('#song-url').value='Yeni şarkı';document.querySelector('#song-url').dispatchEvent(new Event('input'))");
 check('Önceki şarkı değişirse sonraki adımlar yeniden doğrulama ister',await js("document.querySelector('#step-speech').disabled&&document.querySelector('#step-result').disabled"));
 await js("fill({backgroundEnabled:false,theme:'light'});document.querySelector('#voice-provider').value='elevenlabs';document.querySelector('#voice-provider').dispatchEvent(new Event('change'))");
 await wait(()=>js("!document.querySelector('#eleven-connect').classList.contains('hidden')"));
 check('ElevenLabs anahtarsızken bağlantı alanı ve doğru hız/ton sınırı',await js("document.querySelector('#pitch').disabled&&document.querySelector('#rate').max==='20'&&document.querySelector('#voice-connection').textContent.includes('gerekir')"));
 await js("document.querySelector('#eleven-connect').click()");await wait(()=>js("document.querySelector('#eleven-dialog').open"));
 fs.writeFileSync(path.join(testDir,'elevenlabs-baglanti.png'),(await win.webContents.capturePage()).toPNG());
 await js("document.querySelector('#eleven-form').requestSubmit()");await wait(()=>js("!document.querySelector('#eleven-error').classList.contains('hidden')"));
 check('Boş API anahtarı işlem yapmadan açıklanır',!fs.existsSync(path.join(engine.dataDir,'elevenlabs-anahtar.json')));
 await js("document.querySelector('#eleven-dialog').close();fill({backgroundEnabled:false,theme:'light'})");win.setSize(1280,860);
}
module.exports={uiAcceptance,advanceToReview};
