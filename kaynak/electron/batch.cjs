const { validateSettings, sources } = require("./media.cjs");
const { occupied, allocate } = require("./outputs.cjs");
const path = require("node:path");

function batchEntries(raw) {
  if (
    !Array.isArray(raw.entries) ||
    !raw.entries.length ||
    raw.entries.length > 200
  )
    throw new Error("Bir seferde 1 ile 200 arasında şarkı ekleyin.");
  const base = validateSettings({ ...raw, entries: undefined }),
    ids = new Set();
  return raw.entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error(`${index + 1}. şarkı kaydı geçersiz.`);
    if (
      typeof entry.id !== "string" ||
      !/^[A-Za-z0-9-]{1,80}$/.test(entry.id) ||
      ids.has(entry.id)
    )
      throw new Error(
        "Şarkı kayıtlarının kimlikleri birbirinden farklı olmalı.",
      );
    ids.add(entry.id);
    const mode = entry.sourceMode,
      sourceText = String(entry.sourceText || "").trim();
    if (!["search", "link", "local"].includes(mode))
      throw new Error(`${index + 1}. şarkının kaynağını seçin.`);
    if (mode !== "local" && /[\r\n]/.test(sourceText))
      throw new Error(
        `${index + 1}. alana yalnız bir şarkı ekleyin. Başka şarkı için + düğmesini kullanın.`,
      );
    const settings = validateSettings({
      ...base,
      text: entry.text || "",
      voice: entry.voice || "tr-TR-EmelNeural",
      speechMode: entry.speechMode,
      speechPath: entry.speechPath || "",
      rate: entry.rate ?? 0,
      pitch: entry.pitch ?? 0,
      outputName: entry.outputName || "",
      sourceMode: mode,
      entries: undefined,
      songPaths: [],
      songPath: mode === "local" ? entry.songPath : "",
      sourceText,
      queries: mode === "search" ? sourceText : "",
      urls: mode === "link" ? sourceText : "",
      bgPath: base.bgPath,
      backgroundEnabled: base.backgroundEnabled,
    });
    if (!settings.outputName)
      throw new Error(`${index + 1}. video için bir dosya adı yazın.`);
    const songs = sources(
      {
        ...settings,
        sourceMode: mode,
        queries: mode === "search" ? sourceText : "",
        urls: mode === "link" ? sourceText : "",
        resolvedSource: entry.resolvedSource,
      },
      settings,
    );
    if (songs.length !== 1)
      throw new Error(`${index + 1}. alanda yalnız bir şarkı bulunmalı.`);
    return { entryId: entry.id, song: songs[0], settings };
  });
}
function batchOutputPlan(entries, folder, jobs = []) {
  const used = occupied(folder, jobs);
  return entries.map(({ entryId, song, settings }) => {
    const stem = allocate(settings.outputName, used);
    return {
      entryId,
      title: song.title,
      stem,
      mp4: path.join(folder, stem + ".mp4"),
      mp3: settings.alsoMp3 ? path.join(folder, stem + ".mp3") : null,
    };
  });
}
module.exports = { batchEntries, batchOutputPlan };
