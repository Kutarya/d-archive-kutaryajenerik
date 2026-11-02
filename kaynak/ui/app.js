"use strict";
const $ = (id) => document.getElementById(id),
  api = window.kutarya;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name) =>
  '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
const format = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const ticks = Math.round(seconds * 10),
    whole = Math.floor(ticks / 10),
    fraction = ticks % 10;
  return (
    String(Math.floor(whole / 60)).padStart(2, "0") +
    ":" +
    String(whole % 60).padStart(2, "0") +
    (fraction ? "," + fraction : "")
  );
};
const parseTime = (value) => {
  const text = String(value).trim().replace(",", ".");
  if (/^\d+:[0-5]\d(?:\.\d+)?$/.test(text)) {
    const [m, s] = text.split(":").map(Number);
    return m * 60 + s;
  }
  return /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : NaN;
};
const active = (status) =>
  [
    "queued",
    "preparing",
    "searching",
    "downloading",
    "speech",
    "analysing",
    "rendering",
    "saving",
  ].includes(status);
const statusName = {
  queued: "Sırada",
  preparing: "Hazırlanıyor",
  searching: "Video bulunuyor",
  downloading: "İndiriliyor",
  speech: "Ses hazırlanıyor",
  analysing: "Sesler dengeleniyor",
  rendering: "Video hazırlanıyor",
  saving: "Kaydediliyor",
  completed: "Tamamlandı",
  failed: "Kontrol gerekiyor",
  cancelled: "Durduruldu",
  interrupted: "Yarım kaldı",
};
const naturalVoices = [
  { id: "tr-TR-EmelNeural", name: "Emel", gender: "Female", locale: "tr-TR" },
  { id: "tr-TR-AhmetNeural", name: "Ahmet", gender: "Male", locale: "tr-TR" },
];
const fades = [
  ["audio-fade-out", "audioFadeOut"],
  ["video-fade-out", "videoFadeOut"],
  ["audio-fade-in", "audioFadeIn"],
  ["video-fade-in", "videoFadeIn"],
];
let state = { jobs: [], settings: {}, services: {} },
  selected = { song: null, speech: null, bg: null },
  selectedSongs = [],
  view = "editor",
  wizardStep = 1,
  speechMode = "text",
  sourceMode = "search",
  voices = [...naturalVoices],
  elevenVoices = [],
  textSpeechInfo = null,
  previewMedia = null,
  previewCut = null,
  previewFade = 1,
  searchResult = null,
  theme = "light";
let saveTimer,
  toastTimer,
  planTimer,
  voiceLoadToken = 0,
  searchToken = 0,
  hydrateToken = 0,
  speechRevision = 0,
  workflowRevision = 0,
  planToken = 0,
  lastSubmission = null,
  pendingVoice = "tr-TR-EmelNeural",
  wizardBusy = false,
  findingSong = false,
  currentJobIds = [],
  resultJobId = null,
  outputPlan = null;
let elevenStatus = { connected: false, remembered: false, canRemember: false };
const completedSteps = new Set(),
  touched = new Set(),
  notified = new Set(),
  serverErrors = new Map(),
  voiceMemory = { natural: "tr-TR-EmelNeural", elevenlabs: "", other: "" };
async function call(promise) {
  const result = await promise;
  if (!result?.ok) throw new Error(result?.error || "İşlem tamamlanamadı.");
  return result.value;
}
function toast(message, error = false) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").className = "toast" + (error ? " error" : "");
  toastTimer = setTimeout(() => $("toast").classList.add("hidden"), 6500);
}
async function action(fn, button, field) {
  if (button?.disabled) return;
  if (button) button.disabled = true;
  try {
    if (field) serverErrors.delete(field);
    return await fn();
  } catch (error) {
    if (field) {
      serverErrors.set(field, error.message);
      paintError(field, error.message);
      touched.add(field);
    }
    toast(error.message, true);
  } finally {
    if (button) button.disabled = false;
    updateReadiness();
  }
}
const localSongs = () =>
  entries
    .filter((e) => e.sourceMode === "local" && e.media)
    .map((e) => e.media);

function settings() {
  captureNarration();
  const e = activeEntry() || {};
  return {
    theme,
    outputName: "",
    sourceMode: e.sourceMode,
    sourceText: e.sourceText || "",
    entries: serializedEntries(),
    text: e.text || "",
    voice: e.voice || "tr-TR-EmelNeural",
    speechMode: e.speechMode || "text",
    speechPath: e.speechPath || "",
    bgPath: selected.bg?.path || "",
    backgroundEnabled: $("background-enabled").checked,
    fade: Number($("audio-fade-out").value),
    ...Object.fromEntries(fades.map(([id, key]) => [key, Number($(id).value)])),
    voiceGain: Number($("voice-gain").value),
    bgGain: Number($("bg-gain").value),
    songGain: Number($("song-gain").value),
    rate: e.rate || 0,
    pitch: e.pitch || 0,
    cutMode: $("cut-mode").value,
    cutSecond: parseTime($("cut-second").value),
    outputHeight: Number($("output-height").value),
    alsoMp3: $("also-mp3").checked,
  };
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const raw = settings();
    if (!Number.isFinite(raw.cutSecond)) raw.cutSecond = 0;
    void call(api.save(raw)).catch((error) => toast(error.message, true));
  }, 450);
}
function sourceLines() {
  return entries;
}
function validLink(value) {
  try {
    const u = new URL(value),
      host = u.hostname.toLowerCase();
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
      return false;
    const id =
      host === "youtu.be"
        ? u.pathname.split("/")[1]
        : [
              "youtube.com",
              "www.youtube.com",
              "m.youtube.com",
              "music.youtube.com",
            ].includes(host)
          ? u.pathname === "/watch"
            ? u.searchParams.get("v")
            : u.pathname.match(
                /^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})\/?$/,
              )?.[1]
          : null;
    return /^[A-Za-z0-9_-]{11}$/.test(id || "");
  } catch {
    return false;
  }
}
function issues() {
  captureNarration();
  const result = [];
  for (const e of entries) {
    const message = songProblem(e);
    if (message)
      result.push({
        field: "song",
        message: entries.indexOf(e) + 1 + ". şarkı: " + message,
        step: 1,
        entryId: e.id,
        focus: "song-input-" + e.id,
      });
  }
  if (!entries.length)
    result.push({
      field: "song",
      message: "En az bir şarkı ekleyin.",
      step: 1,
      focus: "add-song",
    });
  for (const e of entries) {
    const message = narrationProblem(e);
    if (message)
      result.push({
        field: "speech",
        message: entries.indexOf(e) + 1 + ". şarkı: " + message,
        step: 2,
        entryId: e.id,
        focus: e.speechMode === "file" ? "choose-speech" : "jingle-text",
      });
  }
  if (
    $("background-enabled").checked &&
    (!selected.bg ||
      selected.bg.error ||
      (selected.bg.info && !selected.bg.info.hasAudio))
  )
    result.push({
      field: "bg",
      message: "Ortak fon müziğini seçin veya fonu kapalı bırakın.",
      focus: "choose-bg",
      step: 3,
    });
  if ($("cut-mode").value === "manual") {
    const cut = parseTime($("cut-second").value),
      durations = entries
        .map((e) => e.media?.info?.duration || e.resolvedSource?.duration)
        .filter(Number.isFinite);
    if (
      !Number.isFinite(cut) ||
      cut < 0.5 ||
      durations.some((d) => cut > d - 0.5)
    )
      result.push({
        field: "transition",
        message:
          "01:30 gibi bir zaman yazın. Bu zaman bütün şarkıların başlangıcı ve bitişinden en az yarım saniye uzakta olmalı.",
        focus: "cut-second",
        step: 3,
      });
  }
  for (const e of entries) {
    const message = nameProblem(e);
    if (message)
      result.push({
        field: "output",
        message: entries.indexOf(e) + 1 + ". video: " + message,
        step: 4,
        entryId: e.id,
        focus: "output-" + e.id,
      });
  }
  return result;
}
function paintError(field, message) {
  const el = $(field + "-error");
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("hidden", !message);
  $(field + "-card")?.classList.toggle("invalid", !!message);
}
function invalidateFrom(step) {
  workflowRevision++;
  for (const field of step === 1
    ? ["song", "output"]
    : step === 2
      ? ["speech", "output"]
      : ["bg", "transition", "output"])
    serverErrors.delete(field);
  for (let i = step; i <= 3; i++) completedSteps.delete(i);
  if (resultJobId) {
    currentJobIds = [];
    resultJobId = null;
    resetVideo();
  }
  outputPlan = null;
  updateReadiness();
}
function invalidateSpeech() {
  speechRevision++;
  textSpeechInfo = null;
  const e = activeEntry();
  if (e) {
    e.speechInfo = null;
    e.ready = false;
    e.revision++;
  }
  invalidateFrom(2);
  $("speech-duration").textContent = "";
  $("speech-audio").pause();
  updateReadiness();
}
function setTheme(value) {
  theme = value === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  const next = theme === "light" ? "Koyu tema" : "Açık tema";
  $("theme-toggle").innerHTML =
    icon(theme === "light" ? "moon" : "sun") + "<span>" + next + "</span>";
  $("theme-toggle").title = next + "ya geç";
  $("theme-toggle").setAttribute("aria-label", next + "ya geç");
}
function maxStep() {
  for (let i = 1; i <= 3; i++) if (!completedSteps.has(i)) return i;
  return 4;
}
function currentJob() {
  return state.jobs.find((j) => j.id === resultJobId) || null;
}
function setStep(step, { focus = true } = {}) {
  if (step > maxStep()) return false;
  wizardStep = step;
  songPreviewToken++;
  clearTimeout(toastTimer);
  $("toast").classList.add("hidden");
  switchView("editor", false);
  document
    .querySelectorAll("[data-panel]")
    .forEach((panel) =>
      panel.classList.toggle("hidden", Number(panel.dataset.panel) !== step),
    );
  $("main-scroll").scrollTop = 0;
  $("speech-audio").pause();
  $("audio-player").classList.add("hidden");
  $("video-preview").pause();
  updateControls();
  if (step === 4) {
    renderOutputNames();
    updateSummary();
    renderResult();
    if (!currentJob()) void refreshOutputPlan();
  }
  if (focus)
    $(
      step === 1
        ? "song-heading"
        : step === 2
          ? "speech-heading"
          : step === 3
            ? "bg-heading"
            : "result-heading",
    ).focus({ preventScroll: true });
  return true;
}
function updateReadiness() {
  const problems = issues(),
    count = sourceLines().length,
    job = currentJob(),
    busy = !!job && active(job.status),
    finished = job?.status === "completed",
    failed = !!job && !busy && !finished;
  for (const field of touched)
    paintError(
      field,
      problems.find((p) => p.field === field)?.message ||
        serverErrors.get(field) ||
        "",
    );
  for (const button of document.querySelectorAll("[data-step]")) {
    const step = Number(button.dataset.step),
      done = completedSteps.has(step);
    button.disabled = wizardBusy || step > maxStep();
    button.classList.toggle("done", done && step !== wizardStep);
    button.classList.toggle("current", step === wizardStep);
    button.setAttribute("aria-current", step === wizardStep ? "step" : "false");
    button.querySelector("b").textContent =
      done && step !== wizardStep ? "✓" : step;
  }
  $("source-count").textContent = count + " / 200 şarkı";
  $("create-label").textContent =
    count > 1 ? count + " videoyu oluştur" : "Videoyu oluştur";
  $("previous-step").classList.toggle(
    "hidden",
    wizardStep === 1 || busy || finished,
  );
  $("previous-step").disabled = wizardBusy;
  $("previous-step").innerHTML =
    icon("back") + (failed ? "Ayarları düzelt" : "Geri");
  $("next-step").classList.toggle("hidden", wizardStep === 4);
  $("next-step").disabled = wizardBusy || findingSong;
  $("create").classList.toggle("hidden", wizardStep !== 4 || !!job);
  $("create").disabled =
    wizardBusy ||
    maxStep() < 4 ||
    problems.length > 0 ||
    !outputPlan ||
    outputPlanSignature !== JSON.stringify(settings());
  paintOutputNames();
  renderNarrationNavigation();
  $("new-song").classList.toggle("hidden", wizardStep !== 4 || !job || failed);
  $("retry-current").classList.toggle("hidden", wizardStep !== 4 || !failed);
  if (!wizardBusy) {
    $("next-label").textContent =
      wizardStep === 1
        ? "Jeneriğe geç"
        : wizardStep === 2
          ? entries.some((e) => e.id !== activeEntryId && !e.ready)
            ? "Jeneriği kaydet ve sıradakine geç"
            : speechMode === "text" && !textSpeechInfo
              ? "Sesi oluştur ve devam et"
              : "Fon ve geçişlere geç"
          : "Son kez kontrol et";
  }
  const texts =
    wizardStep === 1
      ? ["Şarkınızı seçin", "İsim, bağlantı veya bilgisayarınızdaki dosya."]
      : wizardStep === 2
        ? [
            "Her şarkının jeneriği ayrı kaydedilir",
            speechMode === "text"
              ? "Devam ederken metin seslendirilir."
              : "Seçtiğiniz sesin tamamı kullanılır.",
          ]
        : wizardStep === 3
          ? [
              "Önerilen ayarlar hazır",
              "Fon isteğe bağlı. Geçişleri isterseniz değiştirin.",
            ]
          : finished
            ? [
                "Videonuz kaydedildi",
                "Yeni şarkıya geçerken jenerik ve fon korunur.",
              ]
            : busy
              ? [
                  "Kutarya videonuzu hazırlıyor",
                  "İsterseniz sıraya yeni şarkılar ekleyebilirsiniz.",
                ]
              : failed
                ? [
                    "Bu kurgu tamamlanamadı",
                    "Ayarları düzenleyin veya yeniden deneyin.",
                  ]
                : [
                    problems.some((p) => p.step === 4)
                      ? "Her videonun dosya adını yazın"
                      : "Kayıt adları ve klasör hazır",
                    count > 1
                      ? count + " video, kendi jeneriğiyle sırayla hazırlanır."
                      : "Hazır olunca videonuzu burada izleyebilirsiniz.",
                  ];
  $("ready-title").textContent = wizardBusy ? "Biraz bekleyin…" : texts[0];
  $("ready-detail").textContent = wizardBusy
    ? wizardStep === 1
      ? "Şarkı kontrol ediliyor."
      : wizardStep === 2
        ? "Jenerik sesi hazırlanıyor."
        : "Ayarlar kontrol ediliyor."
    : texts[1];
}
function updateControls() {
  for (const [id] of fades)
    $(id + "-value").textContent =
      Number($(id).value).toLocaleString("tr-TR", {
        maximumFractionDigits: 1,
      }) + " sn";
  for (const id of ["voice-gain", "bg-gain", "song-gain"])
    $(id + "-value").textContent =
      Math.round(100 * Math.pow(10, Number($(id).value) / 20)) + "%";
  const r = Number($("rate").value),
    p = Number($("pitch").value);
  $("rate-value").textContent =
    r === 0 ? "Normal" : r < 0 ? Math.abs(r) + "% yavaş" : r + "% hızlı";
  $("pitch-value").textContent =
    p === 0 ? "Normal" : p < 0 ? "Daha kalın" : "Daha ince";
  $("manual-cut").classList.toggle("hidden", $("cut-mode").value !== "manual");
  $("text-count").textContent =
    $("jingle-text").value.length.toLocaleString("tr-TR") + " karakter";
  const provider = $("voice-provider").value,
    eleven = provider === "elevenlabs";
  $("voice-cards").classList.toggle(
    "hidden",
    provider === "other" || (eleven && !elevenVoices.length),
  );
  $("voice-list").classList.toggle("hidden", provider === "natural");
  $("actor-filters").classList.toggle("hidden", !eleven);
  $("eleven-connect").classList.toggle("hidden", !eleven);
  $("eleven-connect").textContent = elevenStatus.connected
    ? "Hesabı yönet"
    : "Hesabı bağla";
  $("voice-connection").textContent = eleven
    ? elevenStatus.connected
      ? "ElevenLabs hesabı bağlı"
      : "Hesap bağlantısı gerekir"
    : provider === "other"
      ? "Dile göre ses seçin"
      : "Kadın veya erkek sesini seçin";
  $("voice-note").textContent = eleven
    ? "Metin ElevenLabs’e gönderilir; ses oluşturma hesabınızdaki krediyi kullanır."
    : provider === "other"
      ? "Windows sesleri çevrimdışı çalışır. Diğer doğal sesler için internet gerekir."
      : "Doğal seslendirme için internet gerekir. Metin Microsoft ses hizmetine gönderilir.";
  $("rate").min = eleven ? "-30" : "-50";
  $("rate").max = eleven ? "20" : "50";
  $("pitch").disabled = eleven || speechMode === "file";
  $("rate").disabled = speechMode === "file";
  $("pitch-hint").textContent =
    speechMode === "file"
      ? "Hazır kaydın tonu korunur."
      : eleven
        ? "Ses tonu seçtiğiniz aktöre bağlıdır."
        : "Sol: kalın · Sağ: ince";
  $("rate-hint").textContent =
    speechMode === "file"
      ? "Hazır kaydın hızı korunur."
      : "Sol: daha yavaş · Sağ: daha hızlı";
  for (const card of document.querySelectorAll(".voice-card")) {
    const chosen = card.dataset.voice === $("voice-select").value;
    card.classList.toggle("selected", chosen);
    card.setAttribute("aria-pressed", String(chosen));
  }
  const bg = $("background-enabled").checked;
  $("bg-picker").classList.toggle("hidden", !bg);
  $("no-bg-note").classList.toggle("hidden", bg);
  $("bg-switch-label").textContent = bg ? "Açık" : "Kapalı";
  $("bg-name").textContent = selected.bg
    ? selected.bg.name
    : "Fon müziği seçin";
  $("bg-description").textContent = selected.bg?.info
    ? format(selected.bg.info.duration) + " · Jenerik boyunca çalar."
    : "Bir kez seçin; sonraki videolarda hatırlanır.";
  $("listen-bg").classList.toggle(
    "hidden",
    !selected.bg || !!selected.bg.error,
  );
  const values = fades.map(([id]) => Number($(id).value));
  for (const button of document.querySelectorAll("[data-transition]")) {
    const chosen = values.every((v) => v === Number(button.dataset.transition));
    button.classList.toggle("selected", chosen);
    button.setAttribute("aria-pressed", String(chosen));
  }
  $("timeline-voice-label").textContent = bg
    ? "Siyah ekran + fon"
    : "Siyah ekran";
  updateTimeline();
  updateReadiness();
}
function updateTimeline(timing) {
  const song = localSongs()[0]?.info?.duration || searchResult?.duration,
    speech = (speechMode === "text" ? textSpeechInfo : selected.speech?.info)
      ?.duration;
  if (!timing && song) {
    const cut =
      $("cut-mode").value === "manual"
        ? parseTime($("cut-second").value)
        : song / 2;
    timing = {
      cut,
      gap: speech ? speech + 0.5 : null,
      total: speech ? song + speech + 0.5 : null,
    };
  }
  $("cut-info").textContent = timing ? format(timing.cut) : "Tam ortada";
  $("gap-info").textContent = timing?.gap ? format(timing.gap) : "Ses kadar";
  $("timeline-duration").textContent = timing?.total
    ? format(timing.total)
    : "Otomatik";
}
function setSpeechMode(mode) {
  speechMode = mode;
  $("text-source").classList.toggle("hidden", mode !== "text");
  $("file-source").classList.toggle("hidden", mode !== "file");
  for (const [id, current] of [
    ["text-tab", "text"],
    ["file-tab", "file"],
  ]) {
    $(id).classList.toggle("selected", mode === current);
    $(id).setAttribute("aria-selected", String(mode === current));
  }
  updateControls();
}
function resetSearch() {
  searchToken++;
  searchResult = null;
  const e = activeEntry();
  if (e) {
    e.resolvedSource = null;
    e.resolveToken++;
  }
  renderSongRows();
}
function setSourceMode(mode) {
  const e = activeEntry();
  if (!e) return;
  sourceMode = mode;
  e.sourceMode = mode;
  renderSongRows();
  updateReadiness();
}
function updateBatch() {
  renderSongRows();
  updateReadiness();
}
function sourceUI() {
  const fileButton = $("choose-speech"),
    hasSpeech = !!selected.speech;
  fileButton.classList.toggle("has-selection", hasSpeech);
  fileButton.querySelector("strong").textContent = hasSpeech
    ? selected.speech.name
    : "Jenerik sesini seçin";
  fileButton.querySelector("span:not(.drop-icon)").textContent = hasSpeech
    ? "Değiştirmek için farklı bir ses dosyası seçin."
    : "Elinizdeki reklam sesini doğrudan kullanın.";
  $("speech-description").textContent = selected.speech
    ? selected.speech.name +
      (selected.speech.info
        ? " · " + format(selected.speech.info.duration)
        : "")
    : "Henüz dosya seçilmedi.";
  $("listen-file").classList.toggle(
    "hidden",
    !selected.speech || !!selected.speech.error,
  );
  renderNarrationNavigation();
  updateControls();
}
function providerOf(voice) {
  return voice?.startsWith("eleven:")
    ? "elevenlabs"
    : naturalVoices.some((v) => v.id === voice)
      ? "natural"
      : "other";
}
function fill(raw) {
  hydrateToken++;
  state.settings = raw;
  speechRevision++;
  workflowRevision++;
  touched.clear();
  serverErrors.clear();
  completedSteps.clear();
  wizardStep = 1;
  currentJobIds = [];
  resultJobId = null;
  outputPlan = null;
  outputPlanSignature = "";
  resetVideo();
  selected.bg = raw.bgPath
    ? { path: raw.bgPath, name: raw.bgPath.split(/[\\/]/).at(-1) }
    : null;
  for (const [id, key, fallback] of [
    ["voice-gain", "voiceGain", 3.7],
    ["bg-gain", "bgGain", -18],
    ["song-gain", "songGain", 0],
    ["cut-mode", "cutMode", "half"],
    ["output-height", "outputHeight", 1080],
  ])
    $(id).value = raw[key] ?? fallback;
  for (const [id, key] of fades) $(id).value = raw[key] ?? raw.fade ?? 1;
  $("cut-second").value = format(raw.cutSecond ?? 60);
  $("background-enabled").checked =
    raw.backgroundEnabled == null
      ? !!raw.bgPath
      : raw.backgroundEnabled !== false;
  $("also-mp3").checked = raw.alsoMp3 !== false;
  setTheme(raw.theme || theme);
  const legacy = {
    speechMode: raw.speechMode === "file" ? "file" : "text",
    speechPath: raw.speechPath || "",
    text: raw.text || "",
    voice: raw.voice || "tr-TR-EmelNeural",
    rate: raw.rate || 0,
    pitch: raw.pitch || 0,
  };
  if (raw.entries?.length) entries = raw.entries.map((e) => newEntry(e));
  else if (raw.songPaths?.length || raw.songPath) {
    entries = (raw.songPaths?.length ? raw.songPaths : [raw.songPath]).map(
      (p) =>
        newEntry({
          ...legacy,
          sourceMode: "local",
          songPath: p,
          outputName:
            (raw.songPaths?.length || 1) < 2 ? raw.outputName || "" : "",
        }),
    );
  } else {
    const mode = raw.sourceMode === "link" ? "link" : "search",
      values = String(raw.sourceText || raw.queries || raw.urls || "")
        .trim()
        .split(/[\r\n]+/)
        .filter(Boolean);
    entries = (values.length ? values : [""]).map((value) =>
      newEntry({
        ...legacy,
        sourceMode: mode,
        sourceText: value,
        outputName: values.length < 2 ? raw.outputName || "" : "",
      }),
    );
  }
  for (const e of entries) {
    if (e.songPath)
      e.media = { path: e.songPath, name: e.songPath.split(/[\\/]/).at(-1) };
    if (e.speechPath)
      e.speechMedia = {
        path: e.speechPath,
        name: e.speechPath.split(/[\\/]/).at(-1),
      };
  }
  activeEntryId = entries[0].id;
  activateNarration(activeEntryId, false);
  renderSongRows();
  renderOutputNames();
  for (const field of ["song", "speech", "bg", "transition", "output"])
    paintError(field, "");
  setStep(1, { focus: false });
}
async function hydrateSelected() {
  const generation = hydrateToken,
    tasks = [],
    unique = new Map();
  for (const e of entries)
    for (const [kind, media] of [
      ["song", e.media],
      ["speech", e.speechMedia],
    ])
      if (media) tasks.push({ entry: e, kind, media });
  if (selected.bg) tasks.push({ kind: "bg", media: selected.bg });
  await eachLimited(
    tasks,
    async ({ entry, kind, media }) => {
      try {
        let p = unique.get(media.path);
        if (!p) {
          p = call(api.inspect(media.path));
          unique.set(media.path, p);
        }
        const value = await p;
        if (generation === hydrateToken && (!entry || entries.includes(entry)))
          Object.assign(media, value);
      } catch {
        if (generation === hydrateToken) {
          media.error = true;
          if (entry)
            entry.error =
              kind === "song"
                ? "Dosya bulunamadı; yeniden seçin."
                : entry.error;
        }
      }
    },
    4,
  );
  if (generation !== hydrateToken) return;
  const e = activeEntry();
  selected.song = e.media;
  selected.speech = e.speechMedia;
  searchResult = e.resolvedSource;
  renderSongRows();
  sourceUI();
}
async function findSong() {
  return resolveEntry(activeEntry());
}
async function prepareSpeech(play = false) {
  captureNarration();
  const e = activeEntry(),
    problem = narrationProblem(e);
  if (problem) throw new Error(problem);
  const revision = e.revision,
    raw = settings(),
    audio = await call(
      api.speech({ ...raw, entries: undefined, outputName: "" }),
    );
  if (!entries.includes(e) || revision !== e.revision) return false;
  if (e.speechMode === "text") e.speechInfo = audio.info;
  else e.speechMedia = audio;
  e.ready = true;
  if (activeEntryId === e.id) {
    textSpeechInfo = e.speechMode === "text" ? audio.info : null;
    if (e.speechMode === "file") selected.speech = audio;
    $("speech-duration").textContent =
      format(audio.info.duration) + " · Ses hazır";
    if (play && wizardStep === 2 && view === "editor") showAudio(audio);
  }
  updateTimeline();
  renderNarrationNavigation();
  updateReadiness();
  scheduleSave();
  return true;
}
async function nextStep() {
  if (wizardStep === 4 || wizardBusy) return;
  captureNarration();
  const step = wizardStep,
    e = activeEntry(),
    problem = issues().find(
      (p) => p.step === step && (step !== 2 || p.entryId === e.id),
    );
  if (problem) {
    showIssue(problem);
    return;
  }
  wizardBusy = true;
  const revision = workflowRevision;
  updateReadiness();
  try {
    if (step === 1) {
      await eachLimited(
        [...entries],
        async (e) => {
          if (!(await resolveEntry(e)))
            throw new Error("Şarkı seçimi değişti; yeniden kontrol edin.");
        },
        3,
      );
      if (revision !== workflowRevision) return;
      completedSteps.add(1);
      activateNarration(entries.find((e) => !e.ready)?.id || entries[0].id);
      setStep(2);
    } else if (step === 2) {
      if (!e.ready) {
        if (!(await prepareSpeech())) return;
      }
      if (revision !== workflowRevision) return;
      const pending = entries.find((x) => !x.ready || narrationProblem(x));
      if (pending) {
        activateNarration(pending.id);
        $("main-scroll").scrollTop = 0;
        toast(
          "Şimdi " +
            (entries.indexOf(pending) + 1) +
            ". şarkının jeneriğini hazırlayın.",
        );
      } else {
        completedSteps.add(2);
        setStep(3);
      }
    } else {
      if ($("background-enabled").checked && !selected.bg.info)
        Object.assign(selected.bg, await call(api.inspect(selected.bg.path)));
      if (revision !== workflowRevision) return;
      const issue = issues().find((p) => p.step === 3);
      if (issue) {
        showIssue(issue);
        return;
      }
      completedSteps.add(3);
      setStep(4);
    }
  } catch (error) {
    const field = step === 1 ? "song" : step === 2 ? "speech" : "bg";
    touched.add(field);
    serverErrors.set(field, error.message);
    paintError(field, error.message);
    toast(error.message, true);
  } finally {
    wizardBusy = false;
    renderSongRows();
    renderNarrationNavigation();
    updateReadiness();
  }
}
function showIssue(problem) {
  if (problem.step === 2 && problem.entryId) activateNarration(problem.entryId);
  touched.add(problem.field);
  paintError(problem.field, problem.message);
  if (wizardStep !== problem.step) setStep(problem.step);
  $(problem.focus)?.focus();
  toast(problem.message, true);
}
function switchView(next, resetScroll = true) {
  view = next;
  $("editor-view").classList.toggle("hidden", next !== "editor");
  $("jobs-view").classList.toggle("hidden", next === "editor");
  $("wizard-header").classList.toggle("hidden", next !== "editor");
  $("production-bar").classList.toggle("hidden", next !== "editor");
  $("open-jobs").classList.toggle("selected", next !== "editor");
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("selected", b.dataset.view === next));
  $("job-filter").classList.toggle("hidden", next === "archive");
  $("cancel-all").classList.toggle("hidden", next === "archive");
  if (resetScroll) $("main-scroll").scrollTop = 0;
  renderJobs();
  updateReadiness();
}
function updateSummary() {
  captureNarration();
  const e = activeEntry();
  $("summary-song").textContent =
    entries.length > 1 ? entries.length + " şarkı" : entryTitle(e);
  $("summary-speech").textContent =
    entries.length > 1
      ? "Her şarkının kendi jeneriği"
      : e.speechMode === "file"
        ? e.speechMedia?.name || "Hazır jenerik"
        : "Metinden ses · " + format(e.speechInfo?.duration);
  $("summary-bg").textContent = $("background-enabled").checked
    ? (selected.bg?.name || "Fon seçilmedi") + " · Tüm videolarda ortak"
    : "Fon kullanılmıyor";
  updateTimeline();
}
async function refreshOutputPlan() {
  clearTimeout(planTimer);
  const token = ++planToken;
  outputPlan = null;
  outputPlanSignature = "";
  if (wizardStep !== 4 || currentJob() || issues().some((p) => p.step === 4)) {
    paintOutputNames();
    updateReadiness();
    return;
  }
  const raw = settings(),
    signature = JSON.stringify(raw);
  try {
    const plan = await call(api.outputPlan(raw));
    if (
      token !== planToken ||
      currentJob() ||
      JSON.stringify(settings()) !== signature
    )
      return;
    outputPlan = plan;
    outputPlanSignature = signature;
    $("planned-name").textContent =
      plan.files.length > 1
        ? plan.files.length + " ayrı video"
        : plan.files[0].stem + ".mp4";
    $("planned-extra").textContent =
      "Aşağıdaki adlar kullanılır. Mevcut dosyalar korunur.";
    paintError("output", "");
    paintOutputNames();
  } catch (error) {
    paintError("output", error.message);
  } finally {
    updateReadiness();
  }
}
function schedulePlan() {
  clearTimeout(planTimer);
  planToken++;
  outputPlan = null;
  outputPlanSignature = "";
  planTimer = setTimeout(() => void refreshOutputPlan(), 180);
  updateReadiness();
}
function resetVideo() {
  const video = $("video-preview");
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.classList.add("hidden");
  $("video-placeholder").classList.remove("hidden");
  $("preview-info").classList.add("hidden");
  $("preview-badge").textContent = "Kurgu planı";
  $("jump-to-ad").classList.add("hidden");
  previewMedia = null;
  previewCut = null;
}
function showVideo(media, badge = "Video önizlemesi", timing) {
  const video = $("video-preview"),
    alreadyLoaded = previewMedia?.path === media.path && video.readyState >= 1;
  video.pause();
  if (!alreadyLoaded) video.src = media.url;
  video.classList.remove("hidden");
  $("video-placeholder").classList.add("hidden");
  $("preview-info").classList.remove("hidden");
  $("preview-badge").textContent = badge;
  $("preview-name").textContent = media.name;
  $("preview-meta").textContent =
    format(media.info.duration) +
    " · " +
    media.info.width +
    " × " +
    media.info.height;
  previewMedia = media;
  previewCut = timing?.cut ?? null;
  previewFade = timing?.audioFadeOut ?? timing?.fade ?? 1;
  $("jump-to-ad").classList.toggle("hidden", previewCut === null);
  $("jump-to-ad").disabled = !alreadyLoaded;
  if (!alreadyLoaded) video.load();
  if (timing) updateTimeline(timing);
}
function showAudio(media) {
  $("speech-audio").pause();
  $("speech-audio").src = media.url;
  $("audio-name").textContent = media.name;
  $("audio-player").classList.remove("hidden");
  $("speech-audio").load();
  void $("speech-audio")
    .play()
    .catch(() => {});
}
function renderResult() {
  $("output-dir").textContent = currentJob()?.outputDir || state.outputDir;
  $("output-dir").title = $("output-dir").textContent;
  const displayed = currentJob();
  if (displayed) {
    const s = displayed.settings;
    $("summary-song").textContent = displayed.title;
    $("summary-speech").textContent =
      s.speechMode === "file"
        ? s.speechPath?.split(/[\\/]/).at(-1) || "Hazır jenerik"
        : elevenVoices.concat(voices).find((v) => v.id === s.voice)?.name ||
          "Seslendirme";
    $("summary-bg").textContent = s.backgroundEnabled
      ? s.bgPath?.split(/[\\/]/).at(-1) || "Fon"
      : "Fon kullanılmıyor";
  }
  const job = currentJob(),
    busy = !!job && active(job.status),
    done = job?.status === "completed";
  $("render-status").classList.toggle("hidden", !job);
  $("render-status").className =
    "render-status" + (job ? " " + job.status : " hidden");
  $("export-settings").classList.toggle("hidden", done);
  $("output-result").classList.toggle("hidden", !done);
  $("output-heading").textContent = done
    ? "Dosyalarınız kaydedildi."
    : "Video nasıl kaydedilsin?";
  for (const el of $("export-settings").querySelectorAll("input,button,select"))
    el.disabled = !!job;
  for (const button of document.querySelectorAll("[data-edit-step]"))
    button.disabled = busy || done;
  $("result-heading").textContent = done
    ? "Videonuz hazır."
    : busy
      ? "Videonuz hazırlanıyor."
      : job
        ? "Birlikte düzeltip devam edelim."
        : "Kontrol edin, videonuz hazır olsun.";
  $("result-caption").textContent = done
    ? "TAMAMLANDI"
    : busy
      ? "KUTARYA HAZIRLIYOR"
      : job
        ? "KONTROL GEREKİYOR"
        : "KAYIT BİLGİLERİ";
  $("result-subtitle").textContent = done
    ? "Önizlemeyi izleyin. Dosyalarınız seçtiğiniz klasörde."
    : busy
      ? "Bu işlem bitince video aynı ekranda açılacak."
      : job
        ? "İşlem tamamlanamadı. Aşağıdaki bilgiye göre ayarları düzeltebilirsiniz."
        : "Dosya adını ve kayıt yerini seçin. Gerisini Kutarya hazırlasın.";
  if (job) {
    $("render-icon").innerHTML = icon(done ? "check" : busy ? "film" : "help");
    $("render-title").textContent = done
      ? "Video ve dosyalar hazır"
      : statusName[job.status] || "Hazırlanıyor";
    const completed = currentJobIds
      .map((id) => state.jobs.find((j) => j.id === id))
      .filter((j) => j?.status === "completed").length;
    $("render-detail").textContent =
      (currentJobIds.length > 1
        ? completed + " / " + currentJobIds.length + " tamamlandı · "
        : "") + (job.detail || "");
    $("render-progress").value = job.progress || 0;
    $("render-progress").classList.toggle("hidden", !busy);
    $("cancel-current").classList.toggle("hidden", !busy);
    $("planned-name").textContent = (job.outputStem || job.title) + ".mp4";
    if (done) {
      $("finished-name").textContent = job.file.split(/[\\/]/).at(-1);
      $("finished-path").textContent = job.file;
      $("finished-mp3").classList.toggle("hidden", !job.mp3);
      $("finished-mp3").innerHTML = job.mp3
        ? "<span>MP3 SES DOSYASI</span><strong>" +
          esc(job.mp3.split(/[\\/]/).at(-1)) +
          "</strong>"
        : "";
      $("result-stats").innerHTML =
        "<span>" +
        format(job.outputInfo?.duration || job.timing?.total) +
        "</span><span>" +
        job.outputInfo?.width +
        " × " +
        job.outputInfo?.height +
        "</span>" +
        (job.elapsedSeconds
          ? "<span>" +
            Math.round(job.elapsedSeconds) +
            " saniyede hazırlandı</span>"
          : "");
    }
  }
  renderBatchResults();
  updateReadiness();
}
async function openResult(id) {
  const job = state.jobs.find((j) => j.id === id);
  if (!job) return;
  resultJobId = id;
  currentJobIds = currentJobIds.includes(id) ? currentJobIds : [id];
  for (let i = 1; i <= 3; i++) completedSteps.add(i);
  setStep(4);
  renderResult();
  if (job.status === "completed") {
    const media = await call(api.output(id));
    if (resultJobId === id) {
      showVideo(media, "Video önizlemesi", job.timing);
    }
  }
}
async function create() {
  if (currentJob() || wizardBusy) return;
  if (wizardStep !== 4 || maxStep() < 4) {
    return;
  }
  const problems = issues();
  if (problems.length) {
    showIssue(problems[0]);
    return;
  }
  const raw = settings(),
    signature = JSON.stringify(raw);
  if (
    lastSubmission?.signature === signature &&
    Date.now() - lastSubmission.at < 2500
  )
    return;
  wizardBusy = true;
  updateReadiness();
  try {
    clearTimeout(saveTimer);
    const ids = await call(api.start(raw));
    currentJobIds = ids;
    resultJobId = ids[0];
    lastSubmission = { signature, at: Date.now() };
    state = await call(api.state());
    resetVideo();
    renderJobs();
    renderResult();
    await openResult(ids[0]);
  } finally {
    wizardBusy = false;
    updateReadiness();
  }
}
function newSong() {
  captureNarration();
  const job = currentJob();
  const old = job
    ? entries.find((e) => e.id === job.entryId) || { ...job.settings }
    : activeEntry();
  if (job) {
    $("background-enabled").checked = job.settings.backgroundEnabled;
    if (selected.bg?.path !== job.settings.bgPath)
      selected.bg = job.settings.bgPath
        ? {
            path: job.settings.bgPath,
            name: job.settings.bgPath.split(/[\\/]/).at(-1),
          }
        : null;
  }
  entries = [
    newEntry({
      speechMode: old.speechMode,
      speechPath: old.speechPath,
      speechMedia: old.speechMedia,
      text: old.text,
      voice: old.voice,
      rate: old.rate,
      pitch: old.pitch,
      speechInfo: old.speechInfo,
      ready: old.ready,
    }),
  ];
  activeEntryId = entries[0].id;
  hydrateToken++;
  completedSteps.clear();
  currentJobIds = [];
  resultJobId = null;
  outputPlan = null;
  outputPlanSignature = "";
  resetVideo();
  lastSubmission = null;
  workflowRevision++;
  for (const field of ["song", "speech", "transition", "output"]) {
    touched.delete(field);
    paintError(field, "");
  }
  activateNarration(activeEntryId, false);
  renderSongRows();
  renderOutputNames();
  setStep(1);
  if (job) void hydrateSelected();
  scheduleSave();
}
function jobMarkup(job) {
  const busy = active(job.status),
    failed = ["failed", "interrupted"].includes(job.status),
    duration = job.timing ? " · " + format(job.timing.total) : "";
  const actions =
    job.status === "completed"
      ? '<button class="play-output" data-job-action="play">' +
        icon("play") +
        ' İzle</button><button data-job-action="reveal">Dosyayı göster</button><button data-job-action="reuse">Ayarları kullan</button>'
      : busy
        ? '<button data-job-action="progress">Durumu gör</button><button data-job-action="cancel">Durdur</button>'
        : '<button data-job-action="retry">Yeniden dene</button><button data-job-action="reuse">Ayarları düzelt</button>';
  return (
    '<article class="job-card ' +
    esc(job.status) +
    '" data-id="' +
    esc(job.id) +
    '"><div class="job-icon">' +
    icon(job.status === "completed" ? "check" : failed ? "help" : "music") +
    '</div><div class="job-main"><strong>' +
    esc(job.title) +
    "</strong><p>" +
    esc(job.detail || "Sırada") +
    duration +
    "</p>" +
    (busy
      ? '<progress class="job-progress" max="100" value="' +
        Math.max(0, Math.min(100, Number(job.progress) || 0)) +
        '"></progress>'
      : "") +
    (failed && job.errorDetail
      ? "<details><summary>Hata ayrıntısı</summary><pre>" +
        esc(job.errorDetail) +
        "</pre></details>"
      : "") +
    '</div><div><span class="job-status">' +
    esc(statusName[job.status] || job.status) +
    (busy ? " · %" + Math.round(job.progress || 0) : "") +
    '</span><div class="job-actions">' +
    actions +
    "</div></div></article>"
  );
}
function renderJobs() {
  const jobs = [...state.jobs].reverse(),
    done = jobs.filter((j) => j.status === "completed"),
    busy = jobs.filter((j) => active(j.status));
  $("queue-count").textContent = busy.length;
  $("queue-count").classList.toggle("hidden", !busy.length);
  $("jobs-active-count").textContent = jobs.length - done.length;
  $("done-count").textContent = done.length;
  let filtered =
      view === "archive" ? done : jobs.filter((j) => j.status !== "completed"),
    filter = $("job-filter").value,
    query = $("job-search").value.trim().toLocaleLowerCase("tr-TR");
  if (view !== "archive" && filter === "active")
    filtered = filtered.filter((j) => active(j.status));
  if (view !== "archive" && filter === "failed")
    filtered = filtered.filter((j) =>
      ["failed", "interrupted"].includes(j.status),
    );
  if (query)
    filtered = filtered.filter((j) =>
      String(j.title).toLocaleLowerCase("tr-TR").includes(query),
    );
  const focused = document.activeElement,
    focusedJob = focused?.closest("[data-id]")?.dataset.id,
    focusedAction = focused?.dataset.jobAction,
    openDetails = new Set(
      Array.from($("all-jobs").querySelectorAll("details[open]")).map(
        (el) => el.closest("[data-id]").dataset.id,
      ),
    );
  $("all-jobs").innerHTML = filtered.length
    ? filtered.map(jobMarkup).join("")
    : '<div class="empty-jobs"><span class="empty-icon">' +
      icon("film") +
      "</span><div><strong>" +
      (query
        ? "Bu isimle kurgu bulunamadı."
        : view === "archive"
          ? "Hazırlanan videolar burada görünür."
          : "Kuyrukta iş yok.") +
      "</strong><p>Kurgu adımlarını tamamlayıp videonuzu oluşturun.</p></div></div>";
  for (const d of $("all-jobs").querySelectorAll("details"))
    if (openDetails.has(d.closest("[data-id]").dataset.id)) d.open = true;
  if (focusedJob && focusedAction)
    Array.from($("all-jobs").querySelectorAll("[data-job-action]"))
      .find(
        (b) =>
          b.closest("[data-id]").dataset.id === focusedJob &&
          b.dataset.jobAction === focusedAction,
      )
      ?.focus({ preventScroll: true });
  $("cancel-all").disabled = !busy.length;
  const running = busy.find((j) => j.status !== "queued");
  $("engine-status").textContent = running
    ? running.detail
    : busy.length
      ? busy.length + " kurgu sırada"
      : "Hazır olduğunuzda başlayalım.";
}
async function pick(kind) {
  const e = activeEntry(),
    chosen = await call(api.choose(kind));
  if (!chosen) return;
  if (kind === "speech") {
    if (!entries.includes(e)) return;
    e.speechMedia = chosen;
    e.speechPath = chosen.path;
    e.speechMode = "file";
    e.ready = false;
    e.revision++;
    if (e.id === activeEntryId) {
      selected.speech = chosen;
      invalidateSpeech();
      setSpeechMode("file");
    } else invalidateFrom(2);
  } else if (kind === "bg") {
    selected.bg = chosen;
    $("background-enabled").checked = true;
    invalidateFrom(3);
  }
  touched.delete(kind);
  paintError(kind, "");
  sourceUI();
  scheduleSave();
}
function rebuildVoices(preferred = $("voice-select").value || pendingVoice) {
  const provider = $("voice-provider").value,
    query = $("actor-search").value.trim().toLocaleLowerCase("tr-TR"),
    gender = $("actor-gender").value;
  let list =
    provider === "elevenlabs"
      ? elevenVoices.filter(
          (v) =>
            (gender === "all" || v.gender === gender) &&
            (!query ||
              (v.name + " " + v.description)
                .toLocaleLowerCase("tr-TR")
                .includes(query)),
        )
      : provider === "natural"
        ? voices.filter((v) => v.locale === "tr-TR" && !v.offline)
        : voices.filter((v) => v.locale !== "tr-TR" || v.offline);
  if (provider === "natural" && !list.length) list = naturalVoices;
  list = [...list].sort(
    (a, b) =>
      Number(b.turkish || b.offline) - Number(a.turkish || a.offline) ||
      a.name.localeCompare(b.name, "tr"),
  );
  $("voice-select").replaceChildren();
  for (const voice of list) {
    const name = voice.id.match(/-(\w+)Neural$/)?.[1] || voice.name,
      genderLabel =
        voice.gender === "Female"
          ? "Kadın"
          : voice.gender === "Male"
            ? "Erkek"
            : "Aktör";
    $("voice-select").add(
      new Option(
        name +
          " · " +
          genderLabel +
          " · " +
          (voice.offline ? "Windows" : voice.locale),
        voice.id,
      ),
    );
  }
  if (
    preferred &&
    providerOf(preferred) === provider &&
    !list.some((v) => v.id === preferred)
  ) {
    const known = (provider === "elevenlabs" ? elevenVoices : voices).find(
      (v) => v.id === preferred,
    );
    if (known || preferred === pendingVoice)
      $("voice-select").add(
        new Option(
          known
            ? known.name + " · Seçili ses"
            : preferred.startsWith("eleven:")
              ? "Kayıtlı ElevenLabs aktörü"
              : preferred,
          preferred,
        ),
      );
  }
  if (!$("voice-select").options.length) {
    const option = new Option(
      provider === "elevenlabs"
        ? "Hesabı bağlayıp sesleri yükleyin"
        : "Bu filtrede ses bulunamadı",
      "",
    );
    option.disabled = true;
    $("voice-select").add(option);
  }
  if (Array.from($("voice-select").options).some((o) => o.value === preferred))
    $("voice-select").value = preferred;
  pendingVoice = $("voice-select").value || pendingVoice;
  if ($("voice-select").value) voiceMemory[provider] = $("voice-select").value;
  const cardVoices =
    provider === "natural"
      ? naturalVoices
      : provider === "elevenlabs"
        ? [
            elevenVoices.find((v) => v.gender === "Female"),
            elevenVoices.find((v) => v.gender === "Male"),
          ].filter(Boolean)
        : [];
  $("voice-cards").innerHTML = cardVoices
    .map(
      (v) =>
        '<button class="voice-card" data-voice="' +
        esc(v.id) +
        '"><span class="voice-avatar">' +
        esc(v.name.charAt(0)) +
        "</span><span><strong>" +
        esc(v.name) +
        "</strong><small>" +
        (v.gender === "Female" ? "Kadın" : "Erkek") +
        " · " +
        (provider === "natural" ? "Türkçe" : esc(v.locale)) +
        '</small></span><span class="voice-check">✓</span></button>',
    )
    .join("");
}
async function loadVoices(refresh = false) {
  const generation = ++voiceLoadToken,
    provider = $("voice-provider").value;
  if (provider === "elevenlabs") {
    if (!elevenStatus.connected) {
      rebuildVoices();
      updateControls();
      return;
    }
    const result = await call(api.elevenVoices(refresh));
    if (generation !== voiceLoadToken || provider !== $("voice-provider").value)
      return;
    elevenVoices = result;
  } else {
    const result = await call(api.voices(refresh));
    if (generation !== voiceLoadToken || provider !== $("voice-provider").value)
      return;
    if (result.length) voices = result;
  }
  const previous = $("voice-select").value;
  rebuildVoices(previous || voiceMemory[provider]);
  if (previous && previous !== $("voice-select").value) invalidateSpeech();
  updateControls();
}
async function loadProject(project) {
  if (!project) return;
  fill({
    ...project.settings,
    theme,
    ...(!project.settings.entries
      ? {
          sourceText:
            project.queries ||
            project.urls ||
            project.settings.sourceText ||
            "",
          sourceMode: project.queries
            ? "search"
            : project.urls
              ? "link"
              : project.settings.sourceMode,
        }
      : {}),
  });
  await hydrateSelected();
  await loadVoices();
  scheduleSave();
}

for (const [id, fn] of [
  ["minimize", () => api.minimize()],
  ["maximize", () => api.maximize()],
  ["close", () => api.close()],
])
  $(id).addEventListener("click", fn);
$("theme-toggle").addEventListener("click", () => {
  setTheme(theme === "light" ? "dark" : "light");
  scheduleSave();
});
$("brand-home").addEventListener("click", () => switchView("editor"));
$("open-jobs").addEventListener("click", () => switchView("queue"));
$("back-editor").addEventListener("click", () => switchView("editor"));
document
  .querySelectorAll("[data-view]")
  .forEach((b) =>
    b.addEventListener("click", () => switchView(b.dataset.view)),
  );
for (const [id, kind] of [
  ["choose-speech", "speech"],
  ["choose-bg", "bg"],
])
  $(id).addEventListener("click", () => action(() => pick(kind), $(id), kind));
for (const [id, mode] of [
  ["text-tab", "text"],
  ["file-tab", "file"],
])
  $(id).addEventListener("click", () => {
    if (speechMode !== mode) invalidateSpeech();
    setSpeechMode(mode);
    scheduleSave();
  });
$("voice-cards").addEventListener("click", (event) => {
  const card = event.target.closest("[data-voice]");
  if (!card) return;
  $("actor-search").value = "";
  $("actor-gender").value = "all";
  pendingVoice = card.dataset.voice;
  rebuildVoices(pendingVoice);
  $("voice-select").value = pendingVoice;
  voiceMemory[$("voice-provider").value] = pendingVoice;
  invalidateSpeech();
  updateControls();
  scheduleSave();
});
$("voice-provider").addEventListener("change", () =>
  action(
    async () => {
      voiceLoadToken++;
      pendingVoice = voiceMemory[$("voice-provider").value] || "";
      $("actor-search").value = "";
      $("actor-gender").value = "all";
      if ($("voice-provider").value === "elevenlabs") {
        $("rate").value = Math.max(-30, Math.min(20, Number($("rate").value)));
        $("pitch").value = 0;
      }
      invalidateSpeech();
      rebuildVoices(pendingVoice);
      updateControls();
      await loadVoices();
      scheduleSave();
    },
    null,
    "speech",
  ),
);
for (const id of ["actor-search", "actor-gender"])
  $(id).addEventListener("input", () => {
    rebuildVoices();
    updateControls();
  });
$("preview-speech").addEventListener("click", () =>
  action(
    async () => {
      const html = $("preview-speech").innerHTML;
      $("preview-speech").textContent = "Ses hazırlanıyor…";
      try {
        await prepareSpeech(true);
      } finally {
        $("preview-speech").innerHTML = html;
      }
    },
    $("preview-speech"),
    "speech",
  ),
);
$("export-speech").addEventListener("click", () =>
  action(
    async () => {
      const issue = issues().find((p) => p.step === 2);
      if (issue) throw new Error(issue.message);
      const file = await call(api.exportSpeech(settings()));
      if (file) toast("Jenerik ses dosyanız kaydedildi.");
    },
    $("export-speech"),
    "speech",
  ),
);
$("listen-file").addEventListener("click", () =>
  action(() => prepareSpeech(true), $("listen-file"), "speech"),
);
$("listen-bg").addEventListener("click", () =>
  action(
    async () =>
      showAudio(
        selected.bg.url
          ? selected.bg
          : await call(api.inspect(selected.bg.path)),
      ),
    $("listen-bg"),
    "bg",
  ),
);
$("refresh-voices").addEventListener("click", () =>
  action(() => loadVoices(true), $("refresh-voices"), "speech"),
);
$("close-audio").addEventListener("click", () => {
  $("speech-audio").pause();
  $("audio-player").classList.add("hidden");
});
$("video-preview").addEventListener("error", () => {
  if (previewMedia)
    toast("Önizleme açılamadı. Videoyu kayıt klasöründen açabilirsiniz.", true);
});
$("video-preview").addEventListener("loadedmetadata", () => {
  $("jump-to-ad").disabled =
    previewCut === null || !Number.isFinite($("video-preview").duration);
});
$("jump-to-ad").addEventListener("click", () => {
  const video = $("video-preview");
  if (previewCut === null || video.readyState < 1) return;
  video.currentTime = Math.max(
    0,
    Math.min(video.duration, previewCut - previewFade - 0.5),
  );
  void video.play().catch(() => {});
});
document
  .querySelectorAll("[data-step]")
  .forEach((b) =>
    b.addEventListener("click", () => setStep(Number(b.dataset.step))),
  );
document
  .querySelectorAll("[data-edit-step]")
  .forEach((b) =>
    b.addEventListener("click", () => setStep(Number(b.dataset.editStep))),
  );
$("previous-step").addEventListener("click", () => {
  const job = currentJob();
  if (job && !active(job.status) && job.status !== "completed")
    void action(
      async () => loadProject(await call(api.reuse(job.id))),
      $("previous-step"),
    );
  else setStep(wizardStep - 1);
});
$("next-step").addEventListener("click", () => void nextStep());
$("create").addEventListener("click", () =>
  action(create, $("create"), "output"),
);
for (const id of ["new-song", "new-song-inline"])
  $(id).addEventListener("click", newSong);
$("cancel-current").addEventListener("click", () =>
  action(async () => {
    for (const id of currentJobIds)
      if (active(state.jobs.find((j) => j.id === id)?.status))
        await call(api.cancel(id));
  }, $("cancel-current")),
);
$("retry-current").addEventListener("click", () =>
  action(() => call(api.retry(resultJobId)), $("retry-current")),
);
$("reveal-current").addEventListener("click", () =>
  action(() => call(api.reveal(resultJobId)), $("reveal-current")),
);
$("open-folder").addEventListener("click", () =>
  action(() => call(api.folder()), $("open-folder")),
);
$("change-folder").addEventListener("click", () =>
  action(async () => {
    const folder = await call(api.changeFolder());
    if (folder) {
      state.outputDir = folder;
      $("output-dir").textContent = folder;
      $("output-dir").title = folder;
      await refreshOutputPlan();
    }
  }, $("change-folder")),
);
$("save-project").addEventListener("click", () =>
  action(async () => {
    clearTimeout(saveTimer);
    const file = await call(api.saveProject(settings()));
    if (file) {
      $("wizard-header").querySelector("details").open = false;
      toast("Kurgu ayarları şablon olarak kaydedildi.");
    }
  }, $("save-project")),
);
$("load-project").addEventListener("click", () =>
  action(async () => {
    $("wizard-header").querySelector("details").open = false;
    const project = await call(api.loadProject());
    if (project) {
      await loadProject(project);
      toast("Şablon açıldı. Şarkıyı seçip devam edin.");
    }
  }, $("load-project")),
);
$("cancel-all").addEventListener("click", () =>
  action(() => call(api.cancelAll()), $("cancel-all")),
);
for (const id of ["job-search", "job-filter"])
  $(id).addEventListener("input", renderJobs);
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-job-action]");
  if (!button) return;
  const id = button.closest("[data-id]").dataset.id;
  void action(async () => {
    const operation = button.dataset.jobAction;
    if (operation === "play" || operation === "progress") {
      await openResult(id);
      if (operation === "play")
        void $("video-preview")
          .play()
          .catch(() => {});
    } else if (operation === "reveal") await call(api.reveal(id));
    else if (operation === "cancel") await call(api.cancel(id));
    else if (operation === "reuse") {
      await loadProject(await call(api.reuse(id)));
      toast("Jenerik, fon ve ayarlar alındı. Yeni şarkınızı seçin.");
    } else await call(api.retry(id));
  }, button);
});
for (const id of [
  "jingle-text",
  "voice-select",
  "background-enabled",
  ...fades.map(([id]) => id),
  "voice-gain",
  "bg-gain",
  "song-gain",
  "rate",
  "pitch",
  "cut-mode",
  "cut-second",
  "output-height",
  "also-mp3",
])
  $(id).addEventListener("input", () => {
    if (["jingle-text", "voice-select", "rate", "pitch"].includes(id)) {
      if (id === "voice-select") {
        pendingVoice = $("voice-select").value;
        voiceMemory[$("voice-provider").value] = pendingVoice;
      }
      invalidateSpeech();
    } else if (!["output-height", "also-mp3"].includes(id)) {
      if (
        id === "cut-mode" &&
        $("cut-mode").value === "manual" &&
        !(parseTime($("cut-second").value) > 0.5)
      )
        $("cut-second").value = format(
          (localSongs()[0]?.info?.duration || searchResult?.duration || 120) /
            2,
        );
      invalidateFrom(3);
    }
    updateControls();
    if (wizardStep === 4) {
      updateSummary();
      schedulePlan();
    }
    scheduleSave();
  });

document.querySelectorAll("[data-transition]").forEach((b) =>
  b.addEventListener("click", () => {
    for (const [id] of fades) $(id).value = b.dataset.transition;
    invalidateFrom(3);
    updateControls();
    scheduleSave();
  }),
);
$("reset-settings").addEventListener("click", () => {
  for (const [id] of fades) $(id).value = 1;
  $("voice-gain").value = 3.7;
  $("bg-gain").value = -18;
  $("song-gain").value = 0;
  invalidateFrom(3);
  updateControls();
  scheduleSave();
});
$("open-help").addEventListener("click", () => $("help-dialog").showModal());
document
  .querySelectorAll("[data-close-dialog]")
  .forEach((b) =>
    b.addEventListener("click", () => $(b.dataset.closeDialog).close()),
  );
for (const id of ["eleven-dialog", "help-dialog"])
  $(id).addEventListener("click", (event) => {
    if (event.target !== $(id)) return;
    const box = $(id).getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      $(id).close();
  });
$("eleven-dialog").addEventListener("close", () => {
  $("eleven-key").value = "";
});
$("eleven-connect").addEventListener("click", () =>
  action(async () => {
    elevenStatus = await call(api.elevenStatus());
    $("eleven-key").value = "";
    $("eleven-remember").checked = elevenStatus.remembered;
    $("eleven-remember").disabled = !elevenStatus.canRemember;
    $("eleven-disconnect").classList.toggle("hidden", !elevenStatus.connected);
    $("eleven-error").classList.add("hidden");
    $("eleven-dialog").showModal();
  }, $("eleven-connect")),
);
$("eleven-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void action(async () => {
    const key = $("eleven-key").value.trim();
    $("eleven-error").classList.add("hidden");
    $("eleven-submit").textContent = "Sesler yükleniyor…";
    try {
      const result = await call(
        api.connectEleven({ key, remember: $("eleven-remember").checked }),
      );
      elevenStatus = {
        ...elevenStatus,
        connected: true,
        remembered: result.remembered,
      };
      elevenVoices = result.voices;
      voiceLoadToken++;
      pendingVoice =
        voiceMemory.elevenlabs ||
        elevenVoices.find((v) => v.turkish)?.id ||
        elevenVoices[0]?.id ||
        "";
      rebuildVoices(pendingVoice);
      invalidateSpeech();
      updateControls();
      $("eleven-dialog").close();
      scheduleSave();
      toast("ElevenLabs aktörleri hazır. Sesinizi seçebilirsiniz.");
    } catch (error) {
      $("eleven-error").textContent = error.message;
      $("eleven-error").classList.remove("hidden");
    } finally {
      $("eleven-submit").textContent = "Hesabı bağla";
    }
  }, $("eleven-submit"));
});
$("eleven-disconnect").addEventListener("click", () =>
  action(async () => {
    await call(api.disconnectEleven());
    elevenStatus.connected = false;
    elevenStatus.remembered = false;
    elevenVoices = [];
    $("eleven-dialog").close();
    $("voice-provider").value = "natural";
    pendingVoice = voiceMemory.natural;
    rebuildVoices(pendingVoice);
    invalidateSpeech();
    updateControls();
    scheduleSave();
  }, $("eleven-disconnect")),
);
document.addEventListener("keydown", (event) => {
  if (document.querySelector("dialog[open]") || wizardBusy || view !== "editor")
    return;
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    if (wizardStep < 4) void nextStep();
    else if (!currentJob()) $("create").click();
  }
});
api.onChange((snapshot) => {
  const previous = new Map(state.jobs.map((j) => [j.id, j.status]));
  state = snapshot;
  elevenStatus.connected = !!snapshot.services?.elevenlabs?.connected;
  $("output-dir").textContent = snapshot.outputDir;
  $("output-dir").title = snapshot.outputDir;
  renderJobs();
  if (wizardStep === 4) renderResult();
  for (const job of snapshot.jobs) {
    const key = job.id + ":" + job.status + ":" + job.startedAt;
    if (
      job.status === "completed" &&
      previous.get(job.id) !== "completed" &&
      !notified.has(key)
    ) {
      notified.add(key);
      if (resultJobId === job.id && view === "editor" && wizardStep === 4)
        void call(api.output(job.id))
          .then((media) => {
            if (resultJobId === job.id)
              showVideo(media, "Video önizlemesi", job.timing);
          })
          .catch(() => {});
      else toast(job.title + " hazır. Kurgularım bölümünden açabilirsiniz.");
    } else if (
      job.status === "failed" &&
      previous.get(job.id) !== "failed" &&
      !notified.has(key)
    ) {
      notified.add(key);
      if (resultJobId !== job.id) toast(job.title + ": " + job.detail, true);
    }
  }
  updateReadiness();
});
async function init() {
  bindBatchUI();
  state = await call(api.state());
  elevenStatus = await call(api.elevenStatus());
  fill(state.settings);
  $("output-dir").textContent = state.outputDir;
  $("output-dir").title = state.outputDir;
  $("app-version").textContent = state.version;
  state.jobs
    .filter((j) => ["completed", "failed"].includes(j.status))
    .forEach((j) => notified.add(j.id + ":" + j.status + ":" + j.startedAt));
  renderJobs();
  window.uiReady = true;
  await hydrateSelected();
  void loadVoices().catch((error) => {
    if ($("voice-provider").value === "elevenlabs")
      paintError("speech", error.message);
  });
}
init().catch((error) => toast(error.message, true));
