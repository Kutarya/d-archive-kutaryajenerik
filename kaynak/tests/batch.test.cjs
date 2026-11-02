const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { Engine } = require("../electron/engine.cjs");
const { validateSettings } = require("../electron/media.cjs");
const { batchEntries } = require("../electron/batch.cjs");
function make(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kutarya-batch-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const e = new Engine({
    vendorDir: root,
    dataDir: path.join(root, "Veriler"),
    outputDir: path.join(root, "Ciktilar"),
  });
  e.pump = () => {};
  return e;
}
const entry = (id, patch = {}) => ({
  id,
  sourceMode: "search",
  sourceText: "Şarkı " + id,
  text: "Reklam " + id,
  voice: "tr-TR-EmelNeural",
  outputName: "Video " + id,
  ...patch,
});
const raw = (entries) => ({ entries, backgroundEnabled: false });

test("Aynı şarkı ayrı satırlarda farklı jenerik, aktör ve dosya adıyla kalıcı iş olur", (t) => {
  const e = make(t),
    first = entry("bir", { sourceText: "Aynı şarkı", outputName: "Bir.mp4" }),
    second = entry("iki", {
      sourceText: "Aynı şarkı",
      outputName: "İki",
      voice: "tr-TR-AhmetNeural",
      rate: 10,
    });
  const ids = e.enqueue(raw([first, second]));
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
  assert.deepEqual(
    e.jobs.map((j) => [
      j.entryId,
      j.settings.text,
      j.settings.voice,
      j.outputStem,
    ]),
    [
      ["bir", "Reklam bir", "tr-TR-EmelNeural", "Bir"],
      ["iki", "Reklam iki", "tr-TR-AhmetNeural", "İki"],
    ],
  );
  first.text = "Sonradan değişti";
  assert.equal(e.jobs[0].settings.text, "Reklam bir");
  assert(e.jobs.every((j) => j.settings.entries === undefined));
  const reload = new Engine(e);
  assert.deepEqual(
    reload.jobs.map((j) => j.settings.text),
    ["Reklam bir", "Reklam iki"],
  );
  assert.equal(reload.settings.entries.length, 2);
});
test("Boş veya geçersiz tek bir dosya adı bütün toplu isteği durdurur; eski IPC de ad ister", (t) => {
  const e = make(t),
    previous = e.settings;
  for (const name of [
    "",
    "   ",
    ".mp4",
    "../hata",
    "CON",
    "NUL.mp4",
    "hata?",
    "x".repeat(81),
  ]) {
    assert.throws(() =>
      e.enqueue(raw([entry("bir"), entry("iki", { outputName: name })])),
    );
    assert.equal(e.jobs.length, 0);
    assert.deepEqual(e.settings, previous);
  }
  assert.throws(
    () =>
      e.enqueue({
        urls: "https://youtu.be/KUJm6JmYZpU",
        text: "Reklam",
        backgroundEnabled: false,
      }),
    /dosya adı/,
  );
  assert.equal(e.jobs.length, 0);
});
test("Son satırın kaynak veya jenerik hatası önceki geçerli satırı da kuyruğa almaz", (t) => {
  const e = make(t);
  for (const patch of [
    { sourceText: "x" },
    { sourceText: "Bir\nİki" },
    {
      sourceMode: "link",
      sourceText: "https://evil.example/watch?v=KUJm6JmYZpU",
    },
    { text: "" },
    { speechMode: "file", speechPath: path.join(e.dataDir, "yok.wav") },
  ]) {
    assert.throws(() => e.enqueue(raw([entry("bir"), entry("iki", patch)])));
    assert.equal(e.jobs.length, 0);
    assert(!fs.existsSync(path.join(e.dataDir, "isler.json")));
  }
});
test("Her satır kendi dosya adını ve jeneriğini belirtir; üst ayarlardan doldurulmaz", (t) => {
  const e = make(t),
    missingName = entry("iki"),
    missingText = entry("iki");
  delete missingName.outputName;
  delete missingText.text;
  for (const second of [missingName, missingText]) {
    assert.throws(() =>
      e.enqueue({
        entries: [entry("bir"), second],
        text: "Üst jenerik",
        outputName: "Üst ad",
        backgroundEnabled: false,
      }),
    );
    assert.equal(e.jobs.length, 0);
  }
});
test("Hazır jenerikler ayrı, fon bütün satırlarda ortak tutulur", (t) => {
  const e = make(t),
    speech1 = path.join(e.dataDir, "bir.wav"),
    speech2 = path.join(e.dataDir, "iki.wav"),
    bg = path.join(e.dataDir, "fon.wav");
  [speech1, speech2, bg].forEach((p) => fs.writeFileSync(p, "medya"));
  e.enqueue({
    entries: [
      entry("bir", {
        speechMode: "file",
        speechPath: speech1,
        bgPath: "yanlış",
      }),
      entry("iki", {
        speechMode: "file",
        speechPath: speech2,
        backgroundEnabled: false,
      }),
    ],
    bgPath: bg,
    backgroundEnabled: true,
  });
  assert.deepEqual(
    e.jobs.map((j) => j.settings.speechPath),
    [speech1, speech2],
  );
  assert(
    e.jobs.every(
      (j) => j.settings.backgroundEnabled && j.settings.bgPath === bg,
    ),
  );
});
test("Her satırın önizlenen YouTube videosu kendi işine bağlanır", () => {
  const first = entry("bir", {
      sourceText: "  Şarkı   bir  ",
      resolvedSource: {
        query: "  Şarkı   bir  ",
        url: "https://youtu.be/KUJm6JmYZpU",
        title: "Tayfun",
      },
    }),
    second = entry("iki", {
      sourceMode: "link",
      sourceText: "https://youtu.be/YE7VzlLtp-4",
      resolvedSource: {
        url: "https://youtu.be/YE7VzlLtp-4",
        title: "Diğer video",
      },
    });
  const b = batchEntries(raw([first, second]));
  assert.deepEqual(
    b.map((e) => [e.song.url, e.song.title]),
    [
      ["https://www.youtube.com/watch?v=KUJm6JmYZpU", "Tayfun"],
      ["https://www.youtube.com/watch?v=YE7VzlLtp-4", "Diğer video"],
    ],
  );
  first.sourceText = "Değişen şarkı";
  assert.equal(batchEntries(raw([first]))[0].song.url, undefined);
});
test("Aynı dosya adları ve mevcut MP3 numaralanır; plan ile kuyruk tutarlıdır", (t) => {
  const e = make(t),
    input = raw([
      entry("bir", { outputName: "Video" }),
      entry("iki", { outputName: "video" }),
    ]);
  fs.writeFileSync(path.join(e.outputDir, "VIDEO.mp3"), "koru");
  const plan = e.outputPlan(input);
  assert.deepEqual(
    plan.files.map((f) => f.stem),
    ["Video (2)", "video (3)"],
  );
  e.enqueue(input);
  assert.deepEqual(
    e.jobs.map((j) => j.outputStem),
    plan.files.map((f) => f.stem),
  );
  assert.equal(
    fs.readFileSync(path.join(e.outputDir, "VIDEO.mp3"), "utf8"),
    "koru",
  );
});
test("Taslak boş veya henüz geçersiz adı saklar; bağımsız metinler ve bulunan videolar yüklenir", (t) => {
  const e = make(t),
    draft = raw([
      entry("bir", { outputName: "", text: "Kadın metni" }),
      entry("iki", {
        outputName: "Henüz?",
        text: "Erkek metni",
        voice: "tr-TR-AhmetNeural",
        resolvedSource: {
          url: "https://youtu.be/KUJm6JmYZpU",
          query: "Şarkı iki",
          title: "Bulunan video",
          duration: 221,
        },
        apiKey: "secret",
      }),
    ]);
  e.updateSettings(draft);
  const reload = new Engine(e);
  assert.deepEqual(
    reload.settings.entries.map((x) => [x.outputName, x.text]),
    [
      ["", "Kadın metni"],
      ["Henüz?", "Erkek metni"],
    ],
  );
  assert.equal(reload.settings.entries[1].resolvedSource.duration, 221);
  assert(!JSON.stringify(reload.settings).includes("secret"));
  assert.throws(() => reload.enqueue(reload.settings));
  assert.equal(reload.jobs.length, 0);
});
test("150 satır kendi jeneriğiyle kaydolur; tek iş ayarına bütün liste kopyalanmaz", (t) => {
  const e = make(t),
    list = Array.from({ length: 150 }, (_, i) => entry("sarki-" + i));
  const ids = e.enqueue(raw(list));
  assert.equal(new Set(ids).size, 150);
  assert(
    e.jobs.every(
      (j, i) => j.settings.text === "Reklam sarki-" + i && !j.settings.entries,
    ),
  );
  assert(fs.statSync(path.join(e.dataDir, "isler.json")).size < 600000);
  assert.equal(new Engine(e).settings.entries.length, 150);
});
test("Şarkı kimlikleri ve 200 sınırı taslak ile üretimde aynı doğrulanır", () => {
  for (const list of [
    [],
    Array.from({ length: 201 }, (_, i) => entry("s-" + i)),
    [entry("bir"), entry("bir")],
    [entry("../bad")],
    [entry(4)],
  ]) {
    assert.throws(() => validateSettings(raw(list)));
    assert.throws(() => batchEntries(raw(list)));
  }
});
test("Toplu disk hatası önceki ayarları ve kuyruğu geri yükler", (t) => {
  const e = make(t),
    previous = e.settings;
  e.save = () => {
    throw new Error("Disk yazımı");
  };
  assert.throws(() => e.enqueue(raw([entry("bir"), entry("iki")])), /Disk/);
  assert.equal(e.jobs.length, 0);
  assert.deepEqual(new Engine(e).settings, previous);
});
