const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { fixtures } = require("../scripts/fixtures.cjs");
const { run } = require("./process.cjs");
const { probe } = require("./media.cjs");
const { providerAcceptance } = require("./acceptance.cjs");
async function selfTest({ win, engine, selected, testDir, errors, packaged }) {
  const report = {
    version: require('../package.json').version,
    packaged,
    runtime: process.versions.electron,
    checks: [],
    errors,
    startedAt: new Date().toISOString(),
    syntheticMedia: true,
  };
  const check = (name, passed, detail) => {
    report.checks.push({ name, passed: !!passed, detail });
    if (!passed) throw new Error(name + ": " + JSON.stringify(detail));
  };
  const js = (source) => win.webContents.executeJavaScript(source);
  const wait = async (predicate, timeout = 30000) => {
    const end = Date.now() + timeout;
    while (!(await predicate())) {
      if (Date.now() > end)
        throw new Error("Kabul zaman aşımı: " + String(predicate));
      await new Promise((r) => setTimeout(r, 150));
    }
  };
  const capture = async (name) =>
    fs.writeFileSync(
      path.join(testDir, name + ".png"),
      (await win.webContents.capturePage()).toPNG(),
    );
  const input = async (id, value) =>
    js(
      `(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  const click = async (selector) =>
    js(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const advance = async (step) => {
    await click("#next-step");
    await wait(() => js(`wizardStep===${step}&&!wizardBusy`), 120000);
  };
  try {
    await wait(() => js("window.uiReady===true"));
    check('Motor sürümü paket sürümüyle aynı',engine.snapshot().version===require('../package.json').version,engine.snapshot().version);
    const previousSettings=engine.snapshot().settings,blockedSave=path.join(engine.dataDir,'ayarlar.json.tmp');
    fs.mkdirSync(blockedSave);
    try{
      const saved=await js('window.kutarya.save({text:"Diske yazılamayan taslak"})');
      check('IPC kayıt hatasını bildirir ve son taslağı korur',saved.ok===false&&JSON.stringify(engine.snapshot().settings)===JSON.stringify(previousSettings));
    }finally{fs.rmdirSync(blockedSave);}
    const previousFolder=engine.outputDir,blockedFolder=path.join(testDir,'klasor-olmayan-dosya');fs.writeFileSync(blockedFolder,'engel');
    assertFolderFailure: {
      let rejected=false;
      try{engine.setOutput(path.join(blockedFolder,'alt'));}catch{rejected=true;}
      check('Kayıt klasörü hatasında eski çıktı konumu korunur',rejected&&engine.outputDir===previousFolder);
    }
    await js("document.fonts.ready");
    check(
      "Sandbox, sınırlı IPC ve Türkçe ürün",
      await js(
        "typeof require==='undefined'&&typeof api.start==='function'&&document.documentElement.lang==='tr'",
      ),
    );
    check(
      "İlk giriş tek ekran; sonraki adımlar kilitli",
      await js(
        "wizardStep===1&&document.querySelectorAll('[data-panel]:not(.hidden)').length===1&&document.querySelector('#step-speech').disabled&&document.querySelector('#step-result').disabled",
      ),
    );
    await click("#next-step");
    check(
      "Boş şarkı sonraki ekranı veya üretimi açmaz",
      engine.jobs.length === 0 &&
        (await js(
          "wizardStep===1&&!document.querySelector('#song-error').classList.contains('hidden')",
        )),
    );
    await click("#add-song");
    await click("#add-song");
    check(
      "+ düğmesi her şarkıya ayrı metin kutusu açar",
      await js(
        "entries.length===3&&document.querySelectorAll('[data-song-input]').length===3",
      ),
    );
    await input(
      "song-input-" + (await js("entries[0].id")),
      "Tayfun Hadi Yine İyisin",
    );
    await input(
      "song-input-" + (await js("entries[1].id")),
      "https://youtu.be/KUJm6JmYZpU",
    );
    check(
      "Her satır kendi isim/bağlantı seçimini tutar",
      await js(
        "entries[0].sourceMode==='search'&&entries[1].sourceMode==='link'&&entries[0].sourceText==='Tayfun Hadi Yine İyisin'",
      ),
    );
    await click('[data-entry]:last-child [data-song-action="remove"]');
    check(
      "Satır silme diğer şarkıları değiştirmez",
      await js(
        "entries.length===2&&entries[0].sourceText==='Tayfun Hadi Yine İyisin'&&entries[1].sourceText.includes('KUJm6JmYZpU')",
      ),
    );
    const files = await fixtures(
      path.join(testDir, "girdiler"),
      engine.vendorDir,
    );
    files.speech2 = path.join(testDir, "girdiler", "İkinci jenerik.wav");
    await run(path.join(engine.vendorDir, "ffmpeg.exe"), [
      "-v",
      "error",
      "-nostdin",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=700:duration=5:sample_rate=48000",
      "-c:a",
      "pcm_s16le",
      files.speech2,
    ]);
    const song = await selected(files.song),
      speech = await selected(files.speech),
      speech2 = await selected(files.speech2),
      bg = await selected(files.bg);
    await importAcceptance({ engine, js, wait, check, click, input, files });
    await latePreviewAcceptance({
      engine,
      js,
      wait,
      check,
      click,
      advance,
      files,
    });
    const rows = [
      {
        id: "ilk-video",
        sourceMode: "local",
        songPath: song.path,
        speechMode: "file",
        speechPath: speech.path,
        voice: "tr-TR-EmelNeural",
        text: "İlk video metni",
        rate: 0,
        pitch: 0,
        outputName: "",
      },
      {
        id: "ikinci-video",
        sourceMode: "local",
        songPath: song.path,
        speechMode: "file",
        speechPath: speech2.path,
        voice: "tr-TR-AhmetNeural",
        text: "İkinci video metni",
        rate: 10,
        pitch: 2,
        outputName: "",
      },
    ];
    await js(
      `fill(${JSON.stringify({ entries: rows, bgPath: bg.path, backgroundEnabled: true, theme: "light" })});hydrateSelected()`,
    );
    await advance(2);
    check(
      "İki şarkı doğrulanınca ayrı jenerik ekranı açılır",
      await js(
        "wizardStep===2&&activeEntryId==='ilk-video'&&document.querySelector('#step-bg').disabled&&document.querySelector('#narration-item').options.length===2",
      ),
    );
    await click("#narration-next");
    check(
      "İkinci video kendi jenerik dosyası, metni ve aktörünü gösterir",
      await js(
        `activeEntryId==='ikinci-video'&&selected.speech.path===${JSON.stringify(speech2.path)}&&document.querySelector('#jingle-text').value==='İkinci video metni'&&document.querySelector('#voice-select').value==='tr-TR-AhmetNeural'&&Number(document.querySelector('#rate').value)===10`,
      ),
    );
    await click("#narration-previous");
    check(
      "Geri geçiş ilk jeneriği ve hız/tonu korur",
      await js(
        `activeEntryId==='ilk-video'&&selected.speech.path===${JSON.stringify(speech.path)}&&document.querySelector('#jingle-text').value==='İlk video metni'&&Number(document.querySelector('#rate').value)===0`,
      ),
    );
    await click("#next-step");
    await wait(() => js("activeEntryId==='ikinci-video'&&!wizardBusy"));
    check(
      "Birinci jenerik hazır olunca sıradaki açılır, fon hâlâ kilitlidir",
      await js(
        "wizardStep===2&&entries[0].ready&&!entries[1].ready&&document.querySelector('#step-bg').disabled",
      ),
    );
    await advance(3);
    check(
      "Bütün jenerikler hazır olunca ortak fon ekranı açılır",
      await js(
        `entries.every(e=>e.ready)&&selected.bg.path===${JSON.stringify(bg.path)}&&document.querySelector('#step-result').disabled`,
      ),
    );
    await js("selected.bg=null;sourceUI()");
    await click("#next-step");
    check(
      "Fon açık ama dosya yoksa son ekrana geçilemez",
      await js(
        "wizardStep===3&&!document.querySelector('#bg-error').classList.contains('hidden')",
      ),
    );
    await js(`selected.bg=${JSON.stringify(bg)};sourceUI()`);
    for (const [id, value] of [
      ["audio-fade-out", 0],
      ["video-fade-out", 2],
      ["audio-fade-in", 1.5],
      ["video-fade-in", 0],
    ])
      await input(id, String(value));
    check(
      "Ses ve görüntünün dört ayrı geçiş kontrolü korunur",
      await js(
        "settings().audioFadeOut===0&&settings().videoFadeOut===2&&settings().audioFadeIn===1.5&&settings().videoFadeIn===0",
      ),
    );
    await input("cut-mode", "manual");
    await input("cut-second", "99:99");
    await click("#next-step");
    check(
      "Yanlış dakika:saniye değeri üretimden önce açıklanır",
      await js(
        "wizardStep===3&&!document.querySelector('#transition-error').classList.contains('hidden')",
      ),
    );
    await input("cut-second", "00:04");
    check(
      "Dakika:saniye 4 saniyeye çevrilir",
      await js("settings().cutSecond===4"),
    );
    await input("cut-mode", "half");
    await advance(4);
    check(
      "Dosya adları boşken oluşturma düğmesi kapalı, otomatik ad yok",
      await js(
        "document.querySelector('#create').disabled&&outputPlan===null&&entries.every(e=>!e.outputName)&&document.querySelectorAll('[data-output-name]').length===2",
      ),
    );
    await click("#create");
    await js("create()");
    await js(
      "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true}))",
    );
    check(
      "Tıklama, doğrudan renderer çağrısı ve Ctrl+Enter ad yazılmadan iş üretmez",
      engine.jobs.length === 0,
    );
    const bypass = await js("api.start(settings())");
    check(
      "IPC de eksik dosya adını reddeder",
      !bypass.ok && engine.jobs.length === 0,
      bypass.error,
    );
    const legacy = await js(
      "api.start({urls:'https://youtu.be/KUJm6JmYZpU',text:'Deneme',backgroundEnabled:false})",
    );
    check(
      "Eski tek video IPC çağrısı da ad ister",
      !legacy.ok && engine.jobs.length === 0,
      legacy.error,
    );
    await input("output-ilk-video", "Depo - Bir");
    check(
      "Yalnız bir ad yazmak toplu oluşturmayı açmaz",
      await js("document.querySelector('#create').disabled&&outputPlan===null"),
    );
    await input("output-ikinci-video", "hata?");
    await click("#create");
    check(
      "Geçersiz ikinci ad bütün üretimi durdurur",
      engine.jobs.length === 0 &&
        (await js(
          "document.querySelector('#create').disabled&&!document.querySelector('#name-error-ikinci-video').classList.contains('hidden')",
        )),
    );
    await input("output-ikinci-video", "Depo - İki.mp4");
    await wait(() =>
      js('!!outputPlan&&!document.querySelector("#create").disabled'),
    );
    check(
      "Her videonun son adı ve tam kayıt yolu üretimden önce gösterilir",
      await js(
        `outputPlan.files[0].stem==='Depo - Bir'&&outputPlan.files[1].stem==='Depo - İki'&&document.querySelector('#file-plan-ilk-video').textContent.includes(${JSON.stringify(engine.outputDir)})&&document.querySelector('#file-plan-ikinci-video').textContent.includes('Depo - İki.mp4')`,
      ),
    );
    await click("#previous-step");
    await advance(4);
    await wait(() => js("!!outputPlan"));
    check(
      "Geri/ileri adlar, farklı jenerikler ve fonu korur",
      await js(
        `entries[0].outputName==='Depo - Bir'&&entries[1].outputName==='Depo - İki.mp4'&&entries[0].speechPath!==entries[1].speechPath&&selected.bg.path===${JSON.stringify(bg.path)}`,
      ),
    );
    win.showInactive();
    report.visualCapture = true;
    for (const theme of ["light", "dark"]) {
      await js(`setTheme('${theme}');scheduleSave()`);
      await new Promise((r) => setTimeout(r, 550));
      check(theme + " tema kalıcı", engine.settings.theme === theme);
      for (const [width, height] of [
        [1280, 860],
        [900, 650],
      ]) {
        win.setSize(width, height);
        await new Promise((r) => setTimeout(r, 180));
        for (let step = 1; step <= 4; step++) {
          await js(
            `setStep(${step});document.querySelector('#advanced').open=false`,
          );
          await new Promise((r) => setTimeout(r, 150));
          const layout = await js(
            `(()=>{const b=document.querySelector('#'+(wizardStep===4?'create':'next-step')).getBoundingClientRect();return {step:wizardStep,width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,footer:b.bottom,visible:document.querySelectorAll('[data-panel]:not(.hidden)').length,overflow:[...document.querySelectorAll('[data-panel]:not(.hidden) .surface,.step-rail,.footer-inner')].filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.id||el.className)}})()`,
          );
          check(
            theme + " / " + width + " px / ekran " + step,
            layout.scroll <= layout.width &&
              layout.footer <= height &&
              layout.visible === 1 &&
              layout.overflow.length === 0,
            layout,
          );
          await capture(`${theme}-${width}-adim-${step}`);
        }
      }
    }
    win.setSize(1280, 860);
    await js("setTheme('light');setStep(4)");
    await wait(() =>
      js('!!outputPlan&&!document.querySelector("#create").disabled'),
    );
    await js(
      "document.querySelector('#speech-audio').muted=true;document.querySelector('#video-preview').muted=true",
    );
    await click("#create");
    await wait(() => engine.jobs.length === 2);
    await click("#create");
    check(
      "Çift tıklama toplu listeyi tekrar eklemez",
      engine.jobs.length === 2,
    );
    await wait(
      () =>
        engine.jobs
          .slice(0, 2)
          .every((j) => ["completed", "failed"].includes(j.status)),
      180000,
    );
    const [first, second] = engine.jobs;
    check(
      "İki ayrı jenerikle gerçek renderer MP4 + MP3 üretir",
      [first, second].every(
        (j) =>
          j.status === "completed" &&
          fs.existsSync(j.file) &&
          fs.existsSync(j.mp3),
      ),
      [first.errorDetail, second.errorDetail],
    );
    check(
      "Her videonun süresi kendi jeneriğinden hesaplanır",
      Math.abs(first.outputInfo.duration - 15.5) < 0.1 &&
        Math.abs(second.outputInfo.duration - 17.5) < 0.1,
      [first.outputInfo, second.outputInfo],
    );
    check(
      "Ortak kısa fon farklı jenerik sürelerine uzatılır",
      first.settings.bgPath === second.settings.bgPath &&
        first.timing.gap === 3.5 &&
        second.timing.gap === 5.5,
    );
    check(
      "Girilen dosya adları MP4 ve MP3’e aynen uygulanır",
      path.basename(first.file) === "Depo - Bir.mp4" &&
        path.basename(second.file) === "Depo - İki.mp4" &&
        path.basename(second.mp3) === "Depo - İki.mp3",
    );
    await wait(() =>
      js('document.querySelector("#video-preview").readyState>=2'),
    );
    await click(`[data-result-id="${second.id}"]`);
    await wait(() =>
      js(
        `previewMedia?.path===${JSON.stringify(second.file)}&&document.querySelector('#video-preview').readyState>=2`,
      ),
    );
    check(
      "Sonuç kartlarından her video ayrı önizlenir",
      await js(
        `resultJobId===${JSON.stringify(second.id)}&&document.querySelector('#finished-name').textContent==='Depo - İki.mp4'&&document.querySelectorAll('[data-result-id]').length===2`,
      ),
    );
    await click("#jump-to-ad");
    await wait(() => js('!document.querySelector("#video-preview").seeking'));
    check(
      "Reklam arasına git ve portsuz gerçek oynatıcı",
      await js(
        `Math.abs(document.querySelector('#video-preview').currentTime-${second.timing.cut - second.timing.audioFadeOut - 0.5})<.5&&document.querySelector('#video-preview').src.startsWith('kty-media://')`,
      ),
    );
    await js("document.querySelector('#video-preview').pause()");
    await capture("coklu-sonuc");
    report.batchJobs = [first, second];
    report.transitions = first;
    // Gerçek kare/ses kanıtı: ortak 1 sn fonun 3 ve 5 sn jenerik aralarında sürmesi.
    for (const job of [first, second]) {
      const frame = path.join(testDir, job.entryId + "-siyah.png");
      await run(path.join(engine.vendorDir, "ffmpeg.exe"), [
        "-v",
        "error",
        "-nostdin",
        "-y",
        "-ss",
        String(job.timing.cut + job.timing.gap / 2),
        "-i",
        job.file,
        "-frames:v",
        "1",
        frame,
      ]);
      const analysis = await run(path.join(engine.vendorDir, "ffmpeg.exe"), [
        "-hide_banner",
        "-nostdin",
        "-ss",
        String(job.timing.cut + 0.5),
        "-t",
        String(job.timing.gap - 1),
        "-i",
        job.file,
        "-vn",
        "-af",
        "astats=metadata=1:reset=0",
        "-f",
        "null",
        "-",
      ]);
      const peak = Number(
        analysis.stderr.match(/Peak level dB:\s*([-\d.]+)/)?.[1],
      );
      check(
        job.entryId + " jenerik arası sessiz değil, ses tepe düzeyi korunur",
        Number.isFinite(peak) && peak > -30 && peak < 0,
        peak,
      );
    }
    await js("newSong();setStep(1)");
    check(
      "Yeni şarkı jenerik/fonu korur, dosya adını yeniden ister",
      await js(
        `entries.length===1&&entries[0].speechPath===${JSON.stringify(speech2.path)}&&selected.bg.path===${JSON.stringify(bg.path)}&&entries[0].outputName===''&&document.querySelector('#step-speech').disabled`,
      ),
    );
    // Doğal kadın ve erkek sesleri gerçek hizmetten; her metnin sesi bağımsız.
    const textRows = [
      {
        ...rows[0],
        speechMode: "text",
        speechPath: "",
        text: "Kutarya Jenerik. Depo Marketler ile güzel fırsatlar.",
        voice: "tr-TR-EmelNeural",
        outputName: "",
      },
      {
        ...rows[1],
        speechMode: "text",
        speechPath: "",
        text: "Kutarya ile keyifli alışverişler. Mesajınız burada duyulur.",
        voice: "tr-TR-AhmetNeural",
        rate: 0,
        pitch: 0,
        outputName: "",
      },
    ];
    await js(
      `fill(${JSON.stringify({ entries: textRows, backgroundEnabled: false })});hydrateSelected()`,
    );
    await advance(2);
    await click("#preview-speech");
    await wait(
      () =>
        js(
          'entries[0].ready&&!!textSpeechInfo&&document.querySelector("#speech-audio").readyState>=2',
        ),
      120000,
    );
    check(
      "Doğal kadın sesi gerçek oluşturma ve dinleme yolundan gelir",
      await js(
        "textSpeechInfo.duration>1&&document.querySelector('#speech-audio').src.startsWith('kty-media://')",
      ),
    );
    const emel = await js(
      '({path:document.querySelector("#speech-audio").src,duration:textSpeechInfo.duration})',
    );
    await click("#narration-next");
    await click("#preview-speech");
    await wait(
      () =>
        js(
          'entries[1].ready&&!!textSpeechInfo&&document.querySelector("#speech-audio").readyState>=2',
        ),
      120000,
    );
    check(
      "Doğal erkek sesi diğer metne ve aktöre bağlıdır",
      await js(
        "entries[0].voice==='tr-TR-EmelNeural'&&entries[1].voice==='tr-TR-AhmetNeural'&&entries[0].text!==entries[1].text&&textSpeechInfo.duration>1",
      ),
    );
    await click("#narration-previous");
    await input("jingle-text", "Değişen reklam metni");
    check(
      "Bir metin değişince yalnız kendi hazır sesi kaldırılır",
      await js(
        "!entries[0].ready&&entries[0].speechInfo===null&&entries[1].ready&&document.querySelector('#step-bg').disabled",
      ),
    );
    report.realTts = {
      emel,
      ahmetDuration: await js("entries[1].speechInfo.duration"),
      liveSynthesis: true,
    };
    await projectAcceptance({ engine, js, check, testDir });
    await providerAcceptance({ win, engine, js, wait, check, files, testDir });
    report.elevenlabs = {
      contractAndIpc: "mocked-service-real-encryption-and-mp3",
      liveSynthesis: false,
    };
    const beforeCancel = engine.jobs.length;
    const canceled = engine.enqueue({
      songPath: files.song,
      speechMode: "file",
      speechPath: files.speech,
      bgPath: files.bg,
      outputName: "İptal kabulü",
    })[0];
    engine.cancel(canceled);
    await wait(() => !engine.running);
    check(
      "İptal kendi alt sürecini durdurur, çıktı bırakmaz",
      engine.jobs.find((j) => j.id === canceled).status === "cancelled" &&
        !engine.jobs.find((j) => j.id === canceled).file &&
        engine.jobs.length === beforeCancel + 1,
    );
    const bad = engine.enqueue({
        songPath: files.song,
        speechMode: "file",
        speechPath: files.speech,
        bgPath: files.bg,
        outputName: "Hatalı kesim",
        cutMode: "manual",
        cutSecond: 999,
      })[0],
      good = engine.enqueue({
        songPath: files.song,
        speechMode: "file",
        speechPath: files.speech,
        bgPath: files.bg,
        outputName: "Devam kabulü",
      })[0];
    await wait(
      () => engine.jobs.find((j) => j.id === good).status === "completed",
      180000,
    );
    check(
      "Hatalı iş sonraki geçerli işi durdurmaz",
      engine.jobs.find((j) => j.id === bad).status === "failed",
    );
    await js(`openResult(${JSON.stringify(bad)})`);
    await click("#previous-step");
    await wait(() => js("wizardStep===1&&resultJobId===null"));
    check(
      "Hata düzeltme aynı dosyaları ve adı geri getirir",
      await js(
        `entries.length===1&&entries[0].songPath===${JSON.stringify(files.song)}&&entries[0].speechPath===${JSON.stringify(files.speech)}&&entries[0].outputName==='Hatalı kesim'`,
      ),
    );
    const oldFile = first.file,
      oldHash = crypto
        .createHash("sha256")
        .update(fs.readFileSync(oldFile))
        .digest("hex");
    engine.state(first, "interrupted", "Yeniden deneme kabulü", 100);
    engine.retry(first.id);
    await wait(() => first.status === "completed", 180000);
    check(
      "Yeniden deneme önceki çıktıyı koruyup yeni ad ayırır",
      first.file !== oldFile &&
        fs.existsSync(oldFile) &&
        crypto
          .createHash("sha256")
          .update(fs.readFileSync(oldFile))
          .digest("hex") === oldHash,
    );
    if (
      process.argv.includes("--kty-real-youtube") ||
      process.argv.some((a) => a.startsWith("--kty-company-settings="))
    )
      await realYouTube({
        win,
        engine,
        selected,
        js,
        wait,
        check,
        capture,
        input,
        click,
        advance,
        testDir,
        files,
        report,
      });
    const reload = new (require("./engine.cjs").Engine)({ ...engine });
    check(
      "Geçmiş, farklı jenerikler ve tamamlanan dosyalar kalıcı",
      reload.jobs.filter((j) => j.status === "completed").length >= 3 &&
        reload.jobs.find((j) => j.id === second.id).settings.speechPath ===
          files.speech2,
    );
    check("Renderer hata kaydı sıfır", errors.length === 0, errors);
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.failure = error.stack;
    try {
      await capture("hata-anindaki-ekran");
    } catch {}
  }
  report.finishedAt = new Date().toISOString();
  return report;
}
async function realYouTube({
  engine,
  selected,
  js,
  wait,
  check,
  capture,
  click,
  advance,
  files,
  report,
}) {
  const arg = process.argv.find((a) => a.startsWith("--kty-company-settings=")),
    saved = arg ? JSON.parse(fs.readFileSync(arg.slice(23), "utf8")) : null;
  const row = {
    id: "gercek-youtube",
    sourceMode: "search",
    sourceText: "Tayfun Hadi Yine İyisin",
    speechMode: "file",
    speechPath:
      saved?.speechPath || saved?.entries?.[0]?.speechPath || files.speech,
    voice: "tr-TR-EmelNeural",
    text: "",
    outputName: "Depo Marketler - Gerçek kabul",
  };
  const bgPath = saved?.bgPath || files.bg;
  await selected(row.speechPath);
  await selected(bgPath);
  await js(
    `fill(${JSON.stringify({ entries: [row], bgPath, backgroundEnabled: true, outputHeight: 720 })});hydrateSelected();document.querySelector('#speech-audio').muted=true`,
  );
  await click('[data-song-action="find"]');
  await wait(() => js("!!entries[0].resolvedSource"), 120000);
  const found = await js("entries[0].resolvedSource");
  check(
    "Gerçek isim araması ilk YouTube videosunu bulur",
    /^[A-Za-z0-9_-]{11}$/.test(found.id) &&
      found.query === row.sourceText &&
      !!found.title &&
      found.duration > 2,
    found,
  );
  const linked = await js(`api.lookup(${JSON.stringify(found.url)})`);
  check(
    "İsim ve bağlantı aynı videoyu doğrular",
    linked.ok && linked.value.id === found.id,
    linked.ok ? linked.value : linked.error,
  );
  await capture("youtube-bulunan-sarki");
  await click('[data-song-action="listen"]');
  await wait(
    () =>
      js(
        'document.querySelector("#speech-audio").readyState>=2&&!entries[0].listening&&!document.querySelector("#audio-player").classList.contains("hidden")',
      ),
    240000,
  );
  const audio = await engine.previewSong(found.url),
    info = await probe(audio, engine.vendorDir);
  check(
    "YouTube dinleme önizlemesi yalnız ses içerir ve seçilen şarkı süresindedir",
    info.hasAudio &&
      !info.hasVideo &&
      Math.abs(info.duration - found.duration) < 2,
    info,
  );
  check(
    "Şarkı kartındaki düğme doğru şarkıyı portsuz oynatır",
    await js(
      "document.querySelector('#audio-name').textContent.includes('Yalnız şarkı sesi')&&document.querySelector('#speech-audio').src.startsWith('kty-media://')",
    ),
  );
  check(
    "Dinleme çubuğu şarkı ekle ve devam düğmelerini örtmez",
    await js(
      "(()=>{const m=document.querySelector('#main-scroll').getBoundingClientRect(),a=document.querySelector('#audio-player').getBoundingClientRect(),f=document.querySelector('#production-bar').getBoundingClientRect();return a.top>=m.bottom-1&&a.bottom<=f.top+1&&document.documentElement.scrollWidth<=innerWidth;})()",
    ),
  );
  await js("document.querySelector('#speech-audio').pause()");
  await capture("youtube-sarki-dinleme");
  await advance(2);
  await advance(3);
  await advance(4);
  await wait(() =>
    js('!!outputPlan&&!document.querySelector("#create").disabled'),
  );
  const before = engine.jobs.length;
  await click("#create");
  await wait(() => engine.jobs.length === before + 1);
  const job = engine.jobs.at(-1);
  check(
    "Dinlenen ilk sonuç değişmeden üretime bağlanır",
    job.url === found.url,
  );
  await wait(() => ["completed", "failed"].includes(job.status), 600000);
  check(
    "Gerçek YouTube video + hazır jenerik + ortak fon MP4/MP3",
    job.status === "completed" &&
      fs.existsSync(job.file) &&
      fs.existsSync(job.mp3),
    job.errorDetail,
  );
  check(
    "Gerçek şarkı korunur, reklam arası kendi sesine göre eklenir",
    Math.abs(
      job.outputInfo.duration -
        (job.songDuration + job.timing.speechDuration + 0.5),
    ) < 0.2,
    job.outputInfo,
  );
  await wait(() =>
    js('document.querySelector("#video-preview").readyState>=2'),
  );
  await capture("youtube-gercek-sonuc");
  report.company = {
    ...job,
    realUserMedia: !!saved,
    preview: { file: audio, info },
    found,
  };
}
async function importAcceptance({
  engine,
  js,
  wait,
  check,
  click,
  input,
  files,
}) {
  const { dialog, clipboard } = require("electron"),
    originalDialog = dialog.showOpenDialog,
    originalClipboard = clipboard.readText;
  const secondSong = path.join(path.dirname(files.song), "İkinci şarkı.mp4");
  fs.copyFileSync(files.song, secondSong);
  try {
    await js("fill({backgroundEnabled:false})");
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [files.song, secondSong],
    });
    await click("#add-local-songs");
    await wait(() =>
      js("entries.length===2&&entries.every(e=>e.media?.info?.hasAudio)"),
    );
    check(
      "Çoklu dosya seçimi gerçek IPC ile ayrı şarkı satırları açar",
      await js(
        `entries[0].songPath===${JSON.stringify(files.song)}&&entries[1].songPath===${JSON.stringify(secondSong)}`,
      ),
    );
    await js("fill({backgroundEnabled:false})");
    clipboard.readText = () =>
      "Tayfun Hadi Yine İyisin\nhttps://youtu.be/KUJm6JmYZpU\nİkinci Şarkı";
    await click('[data-song-action="paste"]');
    await wait(() => js("entries.length===3"));
    check(
      "Alt alta yapıştırılan isim ve bağlantılar ayrı kutulara ayrılır",
      await js(
        "entries[0].sourceMode==='search'&&entries[1].sourceMode==='link'&&entries[2].sourceText==='İkinci Şarkı'",
      ),
    );
    const originalSearch = engine.search;
    let finish;
    try {
      engine.search = () =>
        new Promise((resolve) => {
          finish = resolve;
        });
      await click('[data-entry]:first-child [data-song-action="find"]');
      await wait(() => !!finish);
      await input("song-input-" + (await js("entries[0].id")), "Değişen şarkı");
      finish({
        id: "KUJm6JmYZpU",
        url: "https://www.youtube.com/watch?v=KUJm6JmYZpU",
        title: "Eski sonuç",
        duration: 221,
        query: "Tayfun Hadi Yine İyisin",
      });
      await wait(() => js("!entries[0].finding"));
      check(
        "Geç gelen arama sonucu değişen şarkının üstüne yazılmaz",
        await js(
          "entries[0].sourceText==='Değişen şarkı'&&entries[0].resolvedSource===null",
        ),
      );
    } finally {
      engine.search = originalSearch;
    }
  } finally {
    dialog.showOpenDialog = originalDialog;
    clipboard.readText = originalClipboard;
  }
}
async function projectAcceptance({ engine, js, check, testDir }) {
  const { dialog } = require("electron"),
    oldSave = dialog.showSaveDialog,
    oldOpen = dialog.showOpenDialog,
    file = path.join(testDir, "İki şarkı.kutarya.json");
  try {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
    const before = await js("settings()"),
      saved = await js("api.saveProject(settings())");
    check(
      "İki şarkılı taslak boş adlarla gerçek proje IPC yolundan kaydedilir",
      saved.ok &&
        fs.existsSync(file) &&
        JSON.parse(fs.readFileSync(file, "utf8")).version === 3,
    );
    const loaded = await js("api.loadProject()");
    check(
      "Proje yükleme bağımsız metin, aktör ve dosya adlarını korur",
      loaded.ok &&
        JSON.stringify(
          loaded.value.settings.entries.map((e) => [
            e.id,
            e.text,
            e.voice,
            e.outputName,
          ]),
        ) ===
          JSON.stringify(
            before.entries.map((e) => [e.id, e.text, e.voice, e.outputName]),
          ),
    );
    await js(`loadProject(${JSON.stringify(loaded.value)})`);
    check(
      "Yüklenen proje doğru satırlarla ilk adımda yeniden doğrulanır",
      await js(
        "entries.length===2&&wizardStep===1&&document.querySelector('#step-speech').disabled&&entries[0].text==='Değişen reklam metni'&&entries[1].voice==='tr-TR-AhmetNeural'",
      ),
    );
  } finally {
    dialog.showSaveDialog = oldSave;
    dialog.showOpenDialog = oldOpen;
  }
}
async function latePreviewAcceptance({
  engine,
  js,
  wait,
  check,
  click,
  advance,
  files,
}) {
  const original = engine.previewSong;
  let finish;
  try {
    engine.previewSong = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const entry = {
      id: "gec-dinleme",
      sourceMode: "link",
      sourceText: "https://youtu.be/KUJm6JmYZpU",
      resolvedSource: {
        id: "KUJm6JmYZpU",
        url: "https://www.youtube.com/watch?v=KUJm6JmYZpU",
        title: "Geç ses denemesi",
        duration: 221,
      },
      speechMode: "file",
      speechPath: files.speech,
      text: "",
      voice: "tr-TR-EmelNeural",
      outputName: "",
    };
    await js(
      `fill(${JSON.stringify({ entries: [entry], backgroundEnabled: false })})`,
    );
    await click('[data-song-action="listen"]');
    await wait(() => !!finish);
    await advance(2);
    finish(files.speech);
    await wait(() => js("!entries[0].listening"));
    check(
      "Ekran değişince geç gelen şarkı sesi yeni ekranı açmaz",
      await js(
        "wizardStep===2&&document.querySelector('#audio-player').classList.contains('hidden')",
      ),
    );
  } finally {
    engine.previewSong = original;
  }
}
module.exports = { selfTest };
