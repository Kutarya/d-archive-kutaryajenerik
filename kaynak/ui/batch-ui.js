"use strict";
let entries = [],
  activeEntryId = null,
  songPreviewToken = 0,
  outputPlanSignature = "";
const activeEntry = () =>
  entries.find((e) => e.id === activeEntryId) || entries[0];
function newEntry(seed = {}) {
  return {
    id: crypto.randomUUID(),
    sourceMode: "search",
    sourceText: "",
    songPath: "",
    resolvedSource: null,
    speechMode: "text",
    speechPath: "",
    text: "",
    voice: "tr-TR-EmelNeural",
    rate: 0,
    pitch: 0,
    outputName: "",
    media: null,
    speechMedia: null,
    speechInfo: null,
    ready: false,
    revision: 0,
    resolveToken: 0,
    ...seed,
  };
}
function entryTitle(e) {
  return (
    e.media?.name ||
    e.resolvedSource?.title ||
    e.sourceText ||
    "Şarkı seçilmedi"
  );
}
function captureNarration() {
  const e = activeEntry();
  if (!e) return;
  Object.assign(e, {
    text: $("jingle-text").value,
    voice: $("voice-select").value || pendingVoice || "",
    rate: Number($("rate").value),
    pitch: Number($("pitch").value),
    speechMode,
    speechPath: selected.speech?.path || "",
    speechMedia: selected.speech,
    speechInfo: textSpeechInfo,
  });
}
function serializedEntries() {
  return entries.map((e) =>
    Object.fromEntries(
      [
        "id",
        "sourceMode",
        "sourceText",
        "songPath",
        "resolvedSource",
        "speechMode",
        "speechPath",
        "text",
        "voice",
        "rate",
        "pitch",
        "outputName",
      ].map((k) => [k, e[k]]),
    ),
  );
}
function narrationProblem(e) {
  if (e.speechMode === "file")
    return !e.speechPath || e.speechMedia?.error
      ? "Bu şarkının hazır jenerik sesini seçin."
      : null;
  if (!e.text.trim()) return "Bu şarkı için okunacak metni yazın.";
  if (!e.voice) return "Bu şarkı için bir seslendirme kişisi seçin.";
  if (e.voice.startsWith("eleven:") && !elevenStatus.connected)
    return "ElevenLabs hesabını bağlayın veya doğal Türkçe sesi seçin.";
  if (e.voice.startsWith("eleven:") && e.text.trim().length > 10000)
    return "ElevenLabs metni en fazla 10.000 karakter olabilir.";
  return null;
}
function songProblem(e) {
  if (e.sourceMode === "local")
    return !e.songPath ||
      e.media?.error ||
      (e.media?.info && (!e.media.info.hasAudio || e.media.info.duration < 2))
      ? "Bu şarkı için geçerli bir video veya ses dosyası seçin."
      : null;
  if (e.sourceMode === "link")
    return validLink(e.sourceText.trim())
      ? null
      : "Bu alana geçerli bir YouTube video bağlantısı yazın.";
  return e.sourceText.trim().length < 2 ||
    e.sourceText.length > 300 ||
    /^https?:\/\//i.test(e.sourceText.trim()) ||
    /[\u0000-\u001f]/.test(e.sourceText)
    ? "Bu alana şarkı ve sanatçı adı yazın."
    : null;
}
function nameProblem(e) {
  const name = e.outputName.trim().replace(/\.(mp4|mp3)$/i, "");
  return !name
    ? "Dosya adını yazın."
    : name.length > 80 ||
        /[<>:"/\\|?*\u0000-\u001f]/.test(name) ||
        /[. ]$/.test(name) ||
        /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)
      ? "En fazla 80 karakter; / \\ : * ? gibi işaretleri kullanmayın."
      : null;
}
function activateNarration(id, save = true) {
  if (save) captureNarration();
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  activeEntryId = id;
  sourceMode = e.sourceMode;
  selected.song = e.media;
  searchResult = e.resolvedSource;
  speechRevision++;
  textSpeechInfo = e.speechInfo;
  selected.speech =
    e.speechMedia ||
    (e.speechPath
      ? { path: e.speechPath, name: e.speechPath.split(/[\\/]/).at(-1) }
      : null);
  $("jingle-text").value = e.text;
  $("rate").value = e.rate;
  $("pitch").value = e.pitch;
  pendingVoice = e.voice || "tr-TR-EmelNeural";
  $("voice-provider").value = providerOf(pendingVoice);
  voiceMemory[$("voice-provider").value] = pendingVoice;
  $("actor-search").value = "";
  $("actor-gender").value = "all";
  rebuildVoices(pendingVoice);
  speechMode = e.speechMode;
  setSpeechMode(speechMode);
  sourceUI();
  paintError("speech", "");
  serverErrors.delete("speech");
  touched.delete("speech");
  $("speech-duration").textContent = (e.speechMode === "file"
    ? e.speechMedia?.info
    : e.speechInfo
  )?.duration
    ? format(
        (e.speechMode === "file" ? e.speechMedia.info : e.speechInfo).duration,
      ) + " · Ses hazır"
    : "";
  $("speech-audio").pause();
  $("audio-player").classList.add("hidden");
  renderNarrationNavigation();
}
function renderNarrationNavigation() {
  const e = activeEntry();
  if (!e) return;
  $("narration-item").innerHTML = entries
    .map(
      (x, i) =>
        `<option value="${esc(x.id)}" ${x.id === e.id ? "selected" : ""}>${i + 1}. ${esc(entryTitle(x))}${x.ready ? " · Hazır" : ""}</option>`,
    )
    .join("");
  $("narration-progress").textContent =
    entries.filter((x) => x.ready).length +
    " / " +
    entries.length +
    " jenerik hazır";
  $("speech-for").textContent = entries.indexOf(e) + 1 + ". şarkının jeneriği";
  $("narration-previous").disabled = wizardBusy || entries.indexOf(e) === 0;
  $("narration-next").disabled =
    wizardBusy || entries.indexOf(e) === entries.length - 1;
  $("narration-item").disabled = wizardBusy;
  $("copy-narration").classList.toggle("hidden", entries.length < 2);
}
function renderSongRows() {
  $("song-list").innerHTML = entries
    .map((e, i) => {
      const resolved =
        e.sourceMode === "local" ? e.media?.info : e.resolvedSource;
      const title = entryTitle(e),
        meta = e.media?.info
          ? format(e.media.info.duration)
          : [
              e.resolvedSource?.channel,
              e.resolvedSource?.duration
                ? format(e.resolvedSource.duration)
                : "",
            ]
              .filter(Boolean)
              .join(" · ");
      return `<article class="song-entry" data-entry="${esc(e.id)}"><div class="song-entry-heading"><strong><span class="entry-number">${i + 1}</span> Şarkı ${i + 1}</strong><button class="icon-button remove-entry" data-song-action="remove" aria-label="${i + 1}. şarkıyı kaldır" ${entries.length === 1 || wizardBusy ? "disabled" : ""}>${icon("close")}</button></div><div class="song-row-fields"><select data-song-mode aria-label="${i + 1}. şarkının kaynağı" ${wizardBusy ? "disabled" : ""}><option value="search" ${e.sourceMode === "search" ? "selected" : ""}>İsimle ara</option><option value="link" ${e.sourceMode === "link" ? "selected" : ""}>YouTube bağlantısı</option><option value="local" ${e.sourceMode === "local" ? "selected" : ""}>Bilgisayarımdan</option></select><div class="row-search-input"><input data-song-input id="song-input-${esc(e.id)}" aria-label="${i + 1}. şarkı ${e.sourceMode === "link" ? "bağlantısı" : "adı"}" type="text" value="${esc(e.sourceMode === "local" ? e.media?.name || "" : e.sourceText)}" placeholder="${e.sourceMode === "link" ? "https://www.youtube.com/watch?v=…" : e.sourceMode === "local" ? "Video veya ses dosyasını seçin" : "Örn. Tayfun Hadi Yine İyisin"}" ${e.sourceMode === "local" ? "readonly" : ""} ${wizardBusy ? "disabled" : ""}><button class="icon-button" data-song-action="paste" title="Panodan yapıştır" aria-label="${i + 1}. şarkıya panodan yapıştır" ${e.sourceMode === "local" || wizardBusy ? "disabled" : ""}>${icon("clipboard")}</button></div><button class="quiet-button row-find" data-song-action="find" ${e.finding || wizardBusy ? "disabled" : ""}>${icon(e.sourceMode === "local" ? "folder" : e.sourceMode === "search" ? "search" : "check")}<span>${e.finding ? "Bulunuyor…" : e.sourceMode === "local" ? "Dosya seç" : e.sourceMode === "search" ? "Şarkıyı bul" : "Kontrol et"}</span></button></div><p class="row-hint">${e.sourceMode === "search" ? "Aramadaki ilk YouTube videosu seçilir." : e.sourceMode === "link" ? "Bağlantıdaki video kullanılır." : "Orijinal dosyanız korunur."}</p>${resolved ? `<div class="selected-media"><span class="media-icon ${e.sourceMode !== "local" ? "youtube-icon" : ""}">${icon("music")}</span><div><small>${e.sourceMode === "local" ? "SEÇİLEN DOSYA" : "SEÇİLEN YOUTUBE VİDEOSU"}</small><strong>${esc(title)}</strong><span>${esc(meta)}</span></div><button class="quiet-button listen-song" data-song-action="listen" ${e.listening ? "disabled" : ""}>${icon("play")}${e.listening ? "Ses hazırlanıyor…" : "Şarkıyı dinle"}</button><span class="selection-check">${icon("check")}</span></div>` : ""}<p class="field-error ${e.error ? "" : "hidden"}" role="alert" id="song-error-${esc(e.id)}">${esc(e.error || "")}</p></article>`;
    })
    .join("");
  $("source-count").textContent = entries.length + " / 200 şarkı";
  $("add-song").disabled = entries.length >= 200 || wizardBusy;
}
function addSong(seed = {}) {
  if (entries.length >= 200)
    throw new Error("En fazla 200 şarkı ekleyebilirsiniz.");
  captureNarration();
  const e = newEntry({
    sourceMode: entries.at(-1)?.sourceMode || "search",
    ...seed,
  });
  entries.push(e);
  invalidateFrom(1);
  renderSongRows();
  renderNarrationNavigation();
  scheduleSave();
  document.getElementById("song-input-" + e.id)?.focus();
  return e;
}
function editSong(e, value, mode = e.sourceMode) {
  e.sourceMode = mode;
  e.sourceText = value;
  e.resolvedSource = null;
  e.error = "";
  e.resolveToken++;
  if (mode !== "local") {
    e.media = null;
    e.songPath = "";
  }
  songPreviewToken++;
  $("speech-audio").pause();
  if (activeEntryId === e.id) {
    searchResult = null;
    selected.song = e.media;
    sourceMode = mode;
  }
  invalidateFrom(1);
  scheduleSave();
}
async function resolveEntry(e) {
  if (!entries.includes(e)) return false;
  const problem = songProblem(e);
  if (problem) throw new Error(problem);
  if (e.sourceMode === "local") {
    if (!e.media?.info) e.media = await call(api.inspect(e.songPath));
    return !!e.media?.info;
  }
  if (e.resolvedSource) return true;
  const token = ++e.resolveToken,
    mode = e.sourceMode,
    input = e.sourceText.trim();
  e.finding = true;
  renderSongRows();
  try {
    let found = await call(
      mode === "search" ? api.search(input) : api.lookup(input),
    );
    if (!found.duration)
      found = { ...found, ...(await call(api.lookup(found.url))) };
    if (
      !entries.includes(e) ||
      e.resolveToken !== token ||
      e.sourceMode !== mode ||
      e.sourceText.trim() !== input
    )
      return false;
    if (!found.duration || found.duration < 2)
      throw new Error("Süresi belli, en az 2 saniyelik bir şarkı seçin.");
    e.resolvedSource = { ...found, query: mode === "search" ? input : "" };
    e.error = "";
    if (e.id === activeEntryId) searchResult = e.resolvedSource;
    return true;
  } catch (error) {
    if (entries.includes(e) && e.resolveToken === token)
      e.error = error.message;
    throw error;
  } finally {
    e.finding = false;
    renderSongRows();
    updateReadiness();
    scheduleSave();
  }
}
async function listenSong(e) {
  const token = ++songPreviewToken,
    url = e.resolvedSource?.url,
    path = e.songPath;
  $("speech-audio").pause();
  e.listening = true;
  renderSongRows();
  try {
    const audio = await call(
      e.sourceMode === "local" ? api.inspect(path) : api.previewSong(url),
    );
    if (
      token !== songPreviewToken ||
      wizardStep !== 1 ||
      view !== "editor" ||
      !entries.includes(e) ||
      e.songPath !== path ||
      e.resolvedSource?.url !== url
    )
      return;
    showAudio({ ...audio, name: entryTitle(e) + " · Yalnız şarkı sesi" });
  } finally {
    e.listening = false;
    renderSongRows();
  }
}
async function eachLimited(list, fn, limit = 3) {
  let next = 0,
    failure;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (next < list.length && !failure) {
        const item = list[next++];
        try {
          await fn(item);
        } catch (error) {
          failure ||= error;
        }
      }
    }),
  );
  if (failure) throw failure;
}
function renderOutputNames() {
  $("output-names").innerHTML = entries
    .map(
      (e, i) =>
        `<div class="output-entry" data-output-entry="${esc(e.id)}"><strong>${i + 1}. ${esc(entryTitle(e))}</strong><small>${esc(e.speechMode === "file" ? e.speechMedia?.name || "Hazır jenerik" : e.text.slice(0, 75) || "Metin jeneriği")}</small><label class="field-label" for="output-${esc(e.id)}">Dosya adı <span class="required-label">Zorunlu</span></label><div class="name-input"><input id="output-${esc(e.id)}" data-output-name type="text" value="${esc(e.outputName)}" maxlength="84" placeholder="Örn. Depo Marketler - 01" aria-describedby="name-error-${esc(e.id)}"><span>.mp4</span></div><button class="text-button suggest-name" data-use-title>Şarkı adını kullan</button><p class="field-error hidden" id="name-error-${esc(e.id)}"></p><p class="per-file-plan" id="file-plan-${esc(e.id)}">Dosya adını yazdıktan sonra kayıt yolu burada görünür.</p></div>`,
    )
    .join("");
  paintOutputNames();
}
function paintOutputNames() {
  for (const e of entries) {
    const error = $("name-error-" + e.id);
    if (!error) continue;
    const problem = nameProblem(e);
    error.textContent = problem || "";
    error.classList.toggle("hidden", !problem);
    const input = $("output-" + e.id);
    input.setAttribute("aria-invalid", String(!!problem));
    input.disabled = !!currentJob();
    const planned = outputPlan?.files.find((f) => f.entryId === e.id),
      label = $("file-plan-" + e.id);
    label.textContent = planned
      ? planned.mp4 + (planned.mp3 ? " · MP3 de kaydedilir." : "")
      : problem
        ? "Bu video için bir dosya adı gerekli."
        : "Kayıt adı kontrol ediliyor…";
    label.title = planned?.mp4 || "";
  }
}
function renderBatchResults() {
  const list = currentJobIds
    .map((id) => state.jobs.find((j) => j.id === id))
    .filter(Boolean);
  $("batch-results").classList.toggle("hidden", list.length < 2);
  $("batch-results").innerHTML = list
    .map(
      (j, i) =>
        `<button class="batch-result-item ${j.id === resultJobId ? "selected" : ""}" data-result-id="${esc(j.id)}"><span>${i + 1}</span><div><strong>${esc(j.outputStem || j.title)}.mp4</strong><small>${esc(j.title)} · ${esc(statusName[j.status] || j.status)}</small></div>${icon(j.status === "completed" ? "check" : "film")}</button>`,
    )
    .join("");
}
function bindBatchUI() {
  $("add-song").addEventListener("click", () =>
    action(() => addSong(), $("add-song")),
  );
  $("add-local-songs").addEventListener("click", () =>
    action(async () => {
      const files = await call(api.chooseBatch());
      if (!files?.length) return;
      const empty =
        entries.length === 1 && !entries[0].sourceText && !entries[0].songPath;
      if (entries.length + files.length - (empty ? 1 : 0) > 200)
        throw new Error("En fazla 200 şarkı ekleyebilirsiniz.");
      if (empty) {
        const e = entries[0];
        Object.assign(e, {
          sourceMode: "local",
          songPath: files[0].path,
          media: files[0],
        });
        files.shift();
      }
      for (const f of files)
        addSong({ sourceMode: "local", songPath: f.path, media: f });
      invalidateFrom(1);
      renderSongRows();
      scheduleSave();
    }, $("add-local-songs")),
  );
  $("song-list").addEventListener("input", (event) => {
    if (!event.target.matches("[data-song-input]")) return;
    const e = entries.find(
      (e) => e.id === event.target.closest("[data-entry]").dataset.entry,
    );
    const mode = /^https?:\/\//i.test(event.target.value.trim())
      ? "link"
      : e.sourceMode;
    editSong(e, event.target.value, mode);
    if (
      mode !==
      event.target.closest("[data-entry]").querySelector("[data-song-mode]")
        .value
    ) {
      renderSongRows();
      $("song-input-" + e.id).focus();
    } else {
      event.target
        .closest("[data-entry]")
        .querySelector(".selected-media")
        ?.remove();
      $("song-error-" + e.id).classList.add("hidden");
    }
    updateReadiness();
  });
  $("song-list").addEventListener("change", (event) => {
    if (!event.target.matches("[data-song-mode]")) return;
    const e = entries.find(
      (e) => e.id === event.target.closest("[data-entry]").dataset.entry,
    );
    editSong(e, "", event.target.value);
    e.songPath = "";
    e.media = null;
    renderSongRows();
  });
  $("song-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-song-action]");
    if (!button || button.disabled) return;
    const e = entries.find(
        (e) => e.id === button.closest("[data-entry]").dataset.entry,
      ),
      operation = button.dataset.songAction;
    void action(
      async () => {
        if (operation === "remove") {
          if (entries.length < 2) return;
          captureNarration();
          entries = entries.filter((x) => x !== e);
          e.resolveToken++;
          songPreviewToken++;
          if (activeEntryId === e.id) activateNarration(entries[0].id, false);
          invalidateFrom(1);
          renderSongRows();
          renderNarrationNavigation();
          scheduleSave();
        } else if (operation === "paste") {
          const text = await call(api.paste()),
            values = text
              .trim()
              .split(/[\r\n]+/)
              .map((v) => v.trim())
              .filter(Boolean);
          if (entries.length + values.length - 1 > 200)
            throw new Error("En fazla 200 şarkı ekleyebilirsiniz.");
          if (!values.length) return;
          editSong(
            e,
            values[0],
            /^https?:\/\//i.test(values[0]) ? "link" : "search",
          );
          for (const value of values.slice(1))
            addSong({
              sourceText: value,
              sourceMode: /^https?:\/\//i.test(value) ? "link" : "search",
            });
          renderSongRows();
        } else if (operation === "listen") await listenSong(e);
        else if (e.sourceMode === "local") {
          const media = await call(api.choose("song"));
          if (!media || !entries.includes(e)) return;
          editSong(e, "", "local");
          e.songPath = media.path;
          e.media = media;
          if (e.id === activeEntryId) selected.song = media;
          renderSongRows();
          scheduleSave();
        } else await resolveEntry(e);
      },
      button,
      "song",
    );
  });
  $("narration-item").addEventListener("change", () => {
    activateNarration($("narration-item").value);
    scheduleSave();
  });
  for (const [id, offset] of [
    ["narration-previous", -1],
    ["narration-next", 1],
  ])
    $(id).addEventListener("click", () => {
      const e = entries[entries.indexOf(activeEntry()) + offset];
      if (e) activateNarration(e.id);
      scheduleSave();
    });
  $("copy-narration").addEventListener("click", () => {
    captureNarration();
    const from = activeEntry();
    if (narrationProblem(from)) {
      showIssue({
        field: "speech",
        message: narrationProblem(from),
        step: 2,
        entryId: from.id,
        focus: "jingle-text",
      });
      return;
    }
    for (const e of entries)
      if (e !== from) {
        for (const key of [
          "speechMode",
          "speechPath",
          "speechMedia",
          "text",
          "voice",
          "rate",
          "pitch",
          "speechInfo",
          "ready",
        ])
          e[key] = from[key];
        e.revision++;
      }
    invalidateFrom(2);
    renderNarrationNavigation();
    scheduleSave();
    toast(
      "Bu jenerik diğer şarkılara da kopyalandı. Her birini ayrıca değiştirebilirsiniz.",
    );
  });
  $("output-names").addEventListener("input", (event) => {
    if (!event.target.matches("[data-output-name]")) return;
    const e = entries.find(
      (x) =>
        x.id ===
        event.target.closest("[data-output-entry]").dataset.outputEntry,
    );
    e.outputName = event.target.value;
    if (
      $("toast").classList.contains("error") &&
      entries.every((e) => !nameProblem(e))
    ) {
      clearTimeout(toastTimer);
      $("toast").classList.add("hidden");
    }
    serverErrors.delete("output");
    schedulePlan();
    paintOutputNames();
    updateReadiness();
    scheduleSave();
  });
  $("output-names").addEventListener("click", (event) => {
    const button = event.target.closest("[data-use-title]");
    if (!button || button.disabled) return;
    const e = entries.find(
      (x) => x.id === button.closest("[data-output-entry]").dataset.outputEntry,
    );
    e.outputName =
      entryTitle(e)
        .replace(/\.[A-Za-z0-9]{2,5}$/, " ")
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
        .trim()
        .slice(0, 60)
        .replace(/[. ]+$/, "") + " - Jenerik";
    if (/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(e.outputName))
      e.outputName = "Kutarya " + e.outputName;
    $("output-" + e.id).value = e.outputName;
    schedulePlan();
    paintOutputNames();
    updateReadiness();
    scheduleSave();
  });
  $("batch-results").addEventListener("click", (event) => {
    const b = event.target.closest("[data-result-id]");
    if (b) void action(() => openResult(b.dataset.resultId), b);
  });
}
