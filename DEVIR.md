# Kutarya Jenerik — devir kaydı

## Güncel teslim: 1.3.1 — 8 Ekim 2026

Taslak ayarları ve çıktı klasörü yalnız disk kaydı başarılı olursa etkinleşir;
hata durumunda son geçerli değerler korunur. Motor sürümü package.json'dan
okunur. Mevcut 1.3 akışı ve kullanıcı verileri korunur.

43/43 birim; final portable EXE 75/75 kabul; sıfır renderer hatası.
Kanitlar/portable-1791492278225/kabul.json ve goruntu-ses-kabul.json;
gerçek Emel/Ahmet, ayrı jeneriklerle MP4/MP3 ve bağımsız geçiş ölçümleri geçti.
ElevenLabs servis taklidi; dosya diyaloğu seçimi taklit, IPC/disk gerçek.
Canlı YouTube araması çalıştı, iki paketli link/üretim kabulü oturum
gereksinimiyle engellendi. Canlı YouTube üretimi geçti diye sunulmaz.

Portable: Kutarya Jenerik.exe, 248093276 bayt;
SHA256 3b427fdca2862613d4956557e48ea09388b5430888f659fda0ca3340c84999e7.
Setup: Kutarya Jenerik Setup 1.3.1.exe, 254533579 bayt;
SHA256 494f592e3ba1e520a3ac7796defc8548142b62517dbb7d29a55eeb38196640c0.
Setup çalıştırılmadı. İçindeki app.asar ve 15 vendor dosyası test edilen
paketle aynı. Teslim kaydı Kanitlar/1.3.1-teslim/kabul.json.

Eski Kutarya Video baseline yolu artık mevcut değil; bu eski koruma kontrolü
doğrulanamadı diye raporlanır. Eski release kaydı bakim-2026-10-08/ içindedir.
npm audit: derleme zincirinde giderilmemiş 8 orta bulgu; yüksek/kritik yok.
kutarya.com/proje/kutarya-jenerik üzerinde 1.3.1 yayımlandı.
Hosting 0413230d431dbb8a; önceki 5998163b5783affb yedeklendi.
Yeni Setup ve altı gerçek ekran buluttan SHA/boyutla doğrulandı.
Site 58/58 + build, dokuz gerçek proje/21 HTML/19 sitemap URL'si.
Sekiz başka ürün, sekiz Functions, kurallar ve admin claim'leri korundu.
Eski Setup korunur; güncel sürüm ilk sırada gösterilir. Geçici IAM kaldırıldı.
Canlı 1280/390 px: altı ekran/iki Setup, güncel dosya ilk sırada, yatay
taşma ve renderer hatası yok; gerçek yeni Setup indirme düğmesi geçti.

Valorant/Riot temizliği kısmen tamamlandı; Vanguard ve bazı Riot kalıntıları
yetki/otomatik güvenlik engelleri nedeniyle kaldı. Roblox hedefi D:\Roblox;
resmî imzalı installer'lar indirildi, SSL hatası nedeniyle kurulamadı.
Ayrıntılar BAKIM-RAPORU-1.3.1.md ve Kanitlar/bakim-2026-10-08/.

## 1.3.0 tarihsel teslim — 8 Ekim 2026

Kullanıcının ayrı şarkı kutuları, ayrı jenerikler, ortak fon ve zorunlu dosya
adları isteği tamamlandı. 1.2 kaynak/EXE/Setup/veri yedeği
Kanitlar/v1-3-oncesi/ içindedir. Bu turda site yayını değiştirilmedi.

- Her şarkı ayrı isim/YouTube bağlantısı/yerel dosya kutusudur. + Şarkı ekle,
  tek satır silme, çoklu yerel dosya seçme ve çok satırlı panoyu ayrı kutulara
  dağıtma vardır. Aynı şarkı farklı jeneriklerle birden fazla kez eklenebilir.
- Bulunan başlık, kanal ve süre korunur. Şarkıyı dinle yalnız ses indirir;
  önbellek video kimliğine bağlıdır. Dinleme çubuğu ayrı alandadır. Ekranda
  doğrulanan video işe sabitlenir; geç gelen sonuç yeni seçimin üstüne yazılmaz.
- Her şarkının ayrı hazır jenerik/metin/aktör/hız/ton kaydı vardır. Üst listeden
  ve oklardan seçilir; hazır sayısı görünür. Sıradaki eksik jeneriğe geçilir;
  hepsi bitmeden fon açılmaz. Yalnız isteğe bağlı açık kopyalama hepsini değiştirir.
- Fon ve geçişler ortaktır. Fon her jeneriğin süresine göre tekrar/kesme yapar.
  Ses kısılma/açılma ile görüntü kararma/açılma dört ayrı kontrol olmaya devam eder.
- Her videonun dosya adı zorunludur; otomatik başlatma/adlandırma yoktur.
  Eksik/geçersiz ad UI, Ctrl+Enter ve IPC/engine yollarında üretimi engeller.
  Bütün satırlar doğrulanmadan tek iş bile eklenmez. Tam yol önceden gösterilir;
  MP4 uzantısı çift eklenmez, ad çakışması mevcut dosyayı koruyarak numaralanır.
- İşler kendi jenerik ayarlarını taşır; her işe bütün liste kopyalanmaz.
  150 ayrı kayıt kalıcı kuyruğa alındı (günlük 150 gerçek çıktı ölçümü değildir).
  Taslak/proje sürüm 3 bütün eşleşmeleri saklar; eski projeler açılır.
  Sonuç kartları her videoyu ayrı izletir. Geçmiş, iptal, düzeltme ve yeniden
  deneme korunur. Yeni şarkı görüntülenen sonucun jeneriğini kullanır.

### 1.3 kabul ve teslim

40/40 birim testi; final portable EXE'de 80/80 kontrol:
Kanitlar/portable-1791450753821/kabul.json. İki tema, 900/1280 px,
adım kilitleri, ayrı jenerik/metin/aktör, çoklu seçim, geç arama, proje IPC,
zorunlu adların üç yolu, farklı sürelerle MP4/MP3, sonuç seçme, iptal,
hata sonrası devam, eski dosyayı koruyan yeniden deneme ve ekran değişince
geç gelen dinleme isteğinin gizli kalması geçti.
Renderer hatası 0. Gerçek Emel/Ahmet üretildi. ElevenLabs canlı hesap anahtarı
olmadığı için canlı üretim denenmedi; API/IPC/şifreleme testi servis taklididir.
Dosya/proje pencerelerinin seçimi kabul testinde taklit edildi; IPC ve disk gerçektir.

goruntu-ses-kabul.json: 12 sn kaynak + 3/5 sn ayrı jenerikler, 15,5/17,5 sn
çıktılar ve ortak 1 sn fon; siyah kareler, bağımsız dört geçiş, jenerik boyunca
sabit ses ve taşmayan pikler doğrulandı. Gerçek YouTube ilk sonucu bu tarihte
SCFDruCRcYE (Tayfun - Topic, Hadi Yine İyisin) oldu; arama sırası değişebilir.
312.842449 sn yalnız ses önizlemesi ve şirketin Mustafa Silici jeneriği/
WhatsApp fonuyla 320.6 sn 720×720 H.264/AAC + MP3 üretildi. Tek kurgu
76.337 sn sürdü; bu günlük üretim kapasitesi ölçümü değildir.

Normal 1.3 EXE açılışı Kanitlar/baslangic/ içindedir; 3 geçmiş iş ve mevcut
MP4/MP3 hashleri korunur, TCP dinleme/UDP uç noktası 0. Açık uygulamanın
ayarlar.json dosyası sonrasında yeni boş taslak biçimiyle yeniden kaydedildi;
eski taslak yedeği tutulur. Bunun nedenine ilişkin kullanıcı etkileşimi
gözlemlenmedi. Ayrı eski-taslak başlangıç testi metin/kaynak/jeneriğin
35 saniye boyunca kendiliğinden değişmediğini doğruladı.

Portable: D:\KutaryaJenerik\Kutarya Jenerik.exe; 202469599 bayt.
SHA256: f517592bfc987fb1eccf8a619fb886c6f9abd8e19e3e84eda4f9af8423775088.
Setup: D:\KutaryaJenerik\Kutarya Jenerik Setup 1.3.0.exe; 225340596 bayt.
SHA256: 54598b81f618fe13730ee34e1ca18ccd9c4a4d75da574a4f42de9e3b0746d515.
Setup çalıştırılmadı/kurulmadı. Paket içinden çıkarılan app.asar, test edilen
uygulamayla birebir aynı hashte. 19 uygulama dosyası ve 15 vendor dosyası eşit;
Kutarya Video dosyaları değişmedi. Tam teslim kaydı Kanitlar/1.3-teslim/kabul.json.

## 1.2.0 tarihsel teslim — 7 Ekim 2026

Kullanıcı 1.1'in bütün bölümleri tek ekranda gösteren tasarımını reddetti.
Arayüz yeni bir ürün akışına dönüştürüldü; mevcut motor ve veriler korunur.
Siteye yayın yapılmadı. Yerel HTTP/debug portu açılmaz.

- Kenar çubuğu ve uzun tek sayfa kaldırıldı. Şarkı, jenerik, fon/geçişler
  ayrı ekranlardır; ardından ayrı kontrol/kayıt/gerçek sonuç ekranı vardır.
- Adımlar sıralı doğrulanır. Şarkı seçilmeden jenerik açılmaz; metin
  seslendirilmeden veya hazır dosya okunmadan fon açılmaz. Sonuç üçüncü
  adım bitince açılır. Geri dönüş seçimleri korur; önceki adım değişince
  sonraki onaylar kaldırılır. Metin değişirse eski ses süresi kullanılmaz.
- Beyaz açık tema varsayılan; koyu tema ve yeşil ana düğmeler. Tercih
  kaydedilir. Küçük pencerede metin ve aktör seçimi yan yanadır.
- Sesin kısılması, görüntünün kararması, sesin geri açılması ve görüntünün
  geri açılması ayrı kontrollerdir. Yumuşak/Hızlı/Doğrudan hazır seçimleri,
  yüzdeli ses seviyeleri ve dakika:saniye kesim alanı vardır. Jeneriğe fade yok.
- Son ekranda özel video adı, tam kayıt klasörü, kalite ve MP3 seçilir;
  dosya adı önceden gösterilir. Diskteki MP4/MP3 ve sıradaki iş adları
  ayrılır; çakışmada numara eklenir, mevcut dosya üzerine yazılmaz.
- Önizlenen ilk YouTube sonucu işe bağlanır; indirme sırasında başka bir
  arama sonucuyla değişmez. İsim, bağlantı, yerel dosya ve toplu üretim sürer.
- İlerleme, gerçek video, reklam arasına gitme, dosya yolu/süre/çözünürlük
  son ekrandadır. Yeni şarkı jenerik ve fonu korur. Kurgularım ayrı alandır.
  Hatalı işte Ayarları düzelt aynı kaynakları açar; geçmişteki iş korunur.

### 1.2 kabul

29/29 birim testi; final portable EXE'den 79/79 kontrol geçti.
Kanitlar/portable-1791402017608/kabul.json: iki tema, dört ekran,
900/1280 px, sıralı kilitler, geri dönüş, dosya adı ve klasör, gerçek Emel
sesinin renderer akışı, MP4/MP3, iptal, hata düzeltme, sonraki işin devamı,
yarım kalmış çıktıyı koruyan yeniden deneme, sıfır renderer hatası.

Kanitlar/portable-1791402017608/goruntu-ses-kabul.json ayrıca kare ve
ses ölçümleridir. Ayrı geçiş denemesinde ses çıkışı 0, görüntü çıkışı 2,
ses dönüşü 1,5, görüntü dönüşü 0 saniyedir; piksel/ses ölçümü bağımsız
uygulandıklarını doğrular. Jenerik baş/orta/son seviyesi korunur.

Şirketteki Mustafa Silici hazır jeneriği ve WhatsApp fonuyla gerçek Tayfun
videosu işlendi; siyah ara, şarkının tamamı ve reklam seek'i doğrulandı.
Çıktı 228,533333 sn, 1280×720 H.264/AAC + MP3. Tek iş süresi aşağıdadır;
günlük 150 içerik kapasitesi ölçülmedi. API anahtarı olmadan ElevenLabs
canlı ses üretimi denenmedi; hesap IPC/şifreleme/MP3 kontrolleri servis
taklididir. Gerçek doğal Emel ve şirketin hazır dosyaları ayrı doğrulandı.

Kanitlar/servis-1-2/kabul.json: gerçek isim araması ve gerçek bağlantı
bilgi alma aynı KUJm6JmYZpU videosunu ve 221 sn metadata süresini buldu.
Anahtarsız ElevenLabs liste isteği yetki hatası verir.

Teslim: D:\KutaryaJenerik\Kutarya Jenerik.exe; 248071998 bayt.
SHA256: 81729bb15f4153d081da0f8814b525f92fd472d9628e970557c3833c2710c061.
Gerçek şirket işi: 82.787 sn (ilk sonucu doğrulama sonrası).
Kanitlar/release.json: 16 kaynak ve 15 vendor dosyası paketle eşittir;
Kutarya Video baseline dosyaları değişmedi. 1.1 kaynak/EXE yedeği
Kanitlar/v1-2-oncesi/ içindedir. KULLANIM.md 1.2 akışına göre günceldir.
Kullanıcının orijinal ayar, jenerik/fon ve iki tamamlanmış işi korunur.

## 1.1.0 tarihsel teslim — 7 Ekim 2026

Bu bölüm aşağıdaki 1.0.0 tarihsel kaydının güncel değişikliklerini belirtir.
Mevcut motor geliştirilmiştir; proje yeniden yazılmamış, siteye yayın yapılmamıştır.

- Grafit/yeşil Kutarya arayüzü, okunabilir metinler, üç tıklanabilir adım,
  tek kaydırma alanı, dar pencerede tek sütun ve sürekli görünen üretim düğmesi.
- YouTube isimle ilk sonucu bulma + bağlantı seçenekleri. Alt alta isim/bağlantı
  veya çoklu yerel dosya; tek istekte en fazla 200 kaynak. 150 kaynaklı kalıcı
  kuyruk test edildi; bu günlük 150 gerçek çıktı performans ölçümü değildir.
- Mevcut hazır jenerik/fon/metin akışı korunur. Emel/Ahmet Türkçe doğal sesleri,
  Windows/diğer diller ve ElevenLabs hesap aktörleri; isim/cinsiyet filtresi.
  Jenerik ayrıca dosyaya kaydedilebilir; aynı metin/aktör/hız tekrar üretilmez.
- ElevenLabs v2 ses listesi ve multilingual v2 TTS gerçek API sözleşmesine
  bağlıdır. Anahtar yalnız başlıktadır; varsayılan oturum belleği, isteğe bağlı
  Electron safeStorage ile Windows şifrelemesi. Proje/işe anahtar yazılmaz.
  Canlı liste anahtarsız 401 döndü. Kullanıcı API anahtarı verilmediğinden
  ElevenLabs canlı üretimi denenmedi. Sözleşme ve paket IPC/şifreleme/MP3
  yolu servis taklidiyle test edildi; bunlar canlı ElevenLabs kanıtı değildir.
- İnce ayarlar Dengeli/Jenerik önde/Hızlı üretim ve açıklamalı gruplardır.
  Hazır ses hız/tonu korunur; ElevenLabs hız aralığı -30..+20%, ton aktöre bağlıdır.
- Dosya eksikleri üretimden önce ilgili alanda açıklanır. Çift tıklama,
  eski ses süresi, eşzamanlı ses dosyası, yüklenmeden reklam arasına seek,
  yarım kalan işte mevcut çıktıyla isim çakışması ve kapanış alt süreçleri düzeltildi.
  İptal/hata geçici iş klasörünü temizler. Dengeleme ölçümü dosya boyutu/mtime
  ile önbelleğe alınır. Hatalı iş sonraki işi engellemez. Önceki ayarları yeniden
  kullanma, çıktı arama, filtre ve kuyruk durdurma eklendi.

### Son kabul

23/23 birim testi; final portable EXE'den 45/45 kabul kontrolü geçti.
Kanitlar/portable-1791397536781/kabul.json. Kontroller 900/1100/1420 px,
üretim/oynatma, gerçek Emel TTS, Windows anahtar şifrelemesi (servis taklidi),
iptal, hatadan sonra kuyruk devamı, mevcut çıktıyı koruyan yeniden deneme,
kalıcı fon/geçmiş ve sıfır renderer hatasını kapsar.

Final EXE'den isimle Tayfun Hadi Yine İyisin araması CapCut görselindeki
KUJm6JmYZpU videosunu buldu. Kullanıcının kayıtlı Mustafa Silici jeneriği ve
WhatsApp fon dosyasıyla gerçek MP4+MP3 üretildi: kaynak 220,794 sn; jenerik
7,235875 sn; ara 7,735875 sn; çıktı 228,533333 sn, 1280×720 H.264/AAC.
Arama sonucu kontrolü sonrası indirme/kurgu/MP3 54,881 sn sürdü. Bu tek iş
ölçümüdür; günlük kapasite veya her kaynak için hız garantisi değildir.

Kanitlar/portable-1791397536781/goruntu-ses-kabul.json: gerçek şirket reklam
arası RGB [0,0,0], peak -1,1 dB; sentetik şarkı -20,3 dB, çıkış/dönüş
-40,7/-39,3 dB; jenerik baş/orta/son -15,3 dB. Jenerikte fade yok.

Teslim D:\KutaryaJenerik\Kutarya Jenerik.exe; 248.066.725 bayt, SHA256:
ae948815059c2f58937d6fa2bb700b46c048d7a195e2410738fdfd889bd8ce0f.
Kanitlar/release.json 14 kaynak ve 15 vendor dosyasının paketle eşitliğini,
Kutarya Video'nun mevcut baseline SHA'larının korunmasını doğrular.
Önceki kaynak ve 1.0.0 EXE Kanitlar/v1-1-oncesi/ içinde korunur.
KULLANIM.md günceldir. Testler uygulama verisini kendi kabul klasöründe tutar;
kullanıcının kayıtlı jenerik/fon ve mevcut iş geçmişi korunmuştur.

## 1.0.0 tarihsel kayıt

7 Ekim 2026. Kullanıcının istediği yeni Windows masaüstü uygulaması.
D:\KutaryaJenerik; mevcut Kutarya Video, Jenerik ve tamamlanmış işler korunur.
Yerel HTTP/emülatör/debug portu açılmaz. Şifre isteyen işlem iptal edilir.

Akış: YouTube bağlantısı veya yerel video → sürenin yarısında kes → siyah ekran
ve jenerik sesi + kısık fon → şarkı kaldığı yerden devam eder. Şarkı ses/görüntü
geçişlerinde fade; jenerik sesinde fade yok. Duyulur ses düzeyi ve peak limiter.
Hazır jenerik dosyası veya metin + seçilebilir ses. Fon bir kez seçilip kaydedilir.
Çıktı MP4 + isteğe bağlı MP3. Kuyruk, iptal, tekrar deneme ve çıktı önizlemesi.

Uygulama Electron, FFmpeg/ffprobe, yt-dlp+Deno; ağ TTS edge-tts.
Ses metni yalnız seçilen internet seslendirmesine gider; yerel medya işlemesi
ve hazır ses dosyası için hesap/anahtar gerekmez. Sırlar/şifreler kaydedilmez.
Genel site/Firebase yayını bu uygulama talebinin kapsamına alınmadı.

## Uygulama ve paket

Teslim D:\KutaryaJenerik\Kutarya Jenerik.exe; portable Windows x64, 1.0.0.
Python/Node/CapCut kullanıcının bilgisayarında kurulu olmak zorunda değil.
Kaynak kaynak/; medya motorları vendor/, ses köprüsü PyInstaller tek EXE.
Electron 44.6.0, electron-builder 26.15.3, edge-tts 7.2.8, Python 3.12.10.
Türkçe Emel/Ahmet gerçek servisten listelendi ve ikisiyle ses üretildi.
322 doğal ses ve makinede kurulu Windows sesleri listelenir. Bu PC'de çevrimdışı
sesler Zira en-US / Hedda de-DE; çevrimdışı Türkçe var diye sunulmaz.

Çıktı Ciktilar/; veri Veriler/; cache Veriler/Onbellek. Kaynak medya değiştirilmez.
Özel kty-media protokolü dosyayı token + Range ile verir; HTTP portu açılmaz.
Sandbox/contextIsolation açık, Node renderer'a verilmez; dosya yolları picker,
mevcut yerel ayar veya kullanıcı seçimiyle açılan kurgu dosyasıyla yetkilendirilir.
Süreçler shell:false / windowsHide:true; iptal yalnız kendi child PID ağacıdır.

## Yeniden üretme

```powershell
cd D:\KutaryaJenerik\kaynak
npm ci
npm run vendor
# venv: ../AracDerleme; tools/requirements-lock.txt tam sürümler
& '..\AracDerleme\Scripts\python.exe' -m PyInstaller --noconfirm --clean --onefile --name KutaryaSes --distpath vendor --workpath ..\Kanitlar\ses-derleme --specpath tools tools\speech.py
& '..\AracDerleme\Scripts\python.exe' tools\licenses.py
node scripts/prepare-tts.cjs
node scripts/assets.mjs
npm test
$env:ELECTRON_BUILDER_COMPRESSION_LEVEL = '3'
npm run build
```

vendor.mjs mevcut Kutarya Video araçlarını salt okunur kopyalar. Windows
tts-windows.ps1 vendor'a UTF-8 BOM ile kopyalanmalıdır; mevcut vendor kopyası öyle.
assets.mjs özgün SVG ikon → PNG/ICO ve yerel Inter fontu hazırlar. Bu makinenin
npm install Electron dist oluşturmadı; aynı 44.6.0 runtime ayrı kopyalandı.
Normal kurulumda npm rebuild electron / resmi aynı sürüm runtime gerekir.

## Yaşanan tuzaklar ve kabul

- Güncel FFmpeg build filter_complex_script seçeneğini kabul etmedi. Grafik
  shell kullanılmadan -filter_complex argümanı olarak verilir; metin ayrıca
  işe özel kurgu.ffscript dosyasında kalır.
- YouTube parse id'si job UUID'sini spread sırası yüzünden eziyordu; gerçek
  indirme/ihracat geçse de tekrar kullanım ve geçmiş bozulacaktı. Job id artık
  sonradan UUID atanır; videoId ayrıdır. 8/8 birim testi tekrar kullanım ve
  yeniden yüklenen iki kaydın kalıcılığını içerir.
- @electron/asar extractFile Windows'ta nested path için path.normalize ister.
  package.json builder tarafından dev/build alanlarından temizlenir; byte aynı
  diye zorlanmaz. Kod/UI/font/fixture 12 dosya ve vendor 15 dosya SHA ile aynıdır.
- Başarısız/iptal edilmiş ihracatta yalnız o denemede oluşturulan yeni final
  dosyaları kaldırılır; COPYFILE_EXCL eski/kullanıcı dosyası üzerine yazmaz.
- İlk ekranda root + main çift kaydırma vardı; root sabit, main tek scroll.
  Dar pencerede nav sayaçları ve ana üret düğmesi de görünür.

İlk motor kabulü 12 sn sentetik şarkı + 3 sn ses + 0,5 sn pay = 15,5 sn.
Önce mavi / arada tamamen siyah / sonra turuncu gerçek kareler. Seslerde
jenerik baş/orta/son RMS yaklaşık −15,34 dB; fade yok. Şarkı normal −20,27,
çıkışta −37,11, dönüşte −32,09 ve devamında −20,31 dB. Peak −12,20 dB.
Sentetik medya kabulü gerçek YouTube kabulüyle aynı sayılmaz.

Gerçek paket ilk YouTube kabulü: Big Buck Bunny 596,494 sn, Ahmet 6,192 sn,
ara 6,692 sn; toplam 603,186 sn, 1920×1080 H.264/AAC MP4 + 192 kbps MP3.
Tam indirme/seslendirme/ihracat 172,5 sn ölçüldü; genel performans iddiası değil.
İş kimliği düzeltmesinden sonraki son portable kabulü 24/24 geçti:
Kanitlar/portable-1791376225853/kabul.json. Teslim EXE'sinden gerçek YouTube
indirme → Ahmet seslendirmesi → 603,186 sn MP4/MP3 üretme ve geçmişten yeniden
yükleme doğrulandı. Emel ses önizlemesi, yerel kayıt+fon, iptal, video oynatma/
seek, kalıcı fon, 1000 px pencere ve renderer hatasızlığı da kabul kapsamındadır.
8/8 birim testi geçti. Bu kullanıcının kendi şarkı/jenerik/fon dosyalarıyla
bir ölçüm değildir; dosyaları uygulamadan kendileri seçecektir.

Teslim EXE 248.050.931 bayt; SHA256:
84493bcc1d03bd5fec54cb908ad16647ecfd2e126c95b3e3f9d13ef0d190efe3.
Normal uygulama 7 Ekim 15:37'de açıldı; sıfır iş, varsayılan Ciktilar klasörü,
gerçek ekran Kanitlar/baslangic/arayuz.png ve durum.json. 15:40 kontrolünde
launcher ve dört Electron alt süreci çalışıyordu; TCP listen ve UDP endpoint
yoktu (Kanitlar/baslangic/port-kabul.json). Uygulama açık bırakıldı.
Kanitlar/release.json final EXE hash/boyut, 12 kaynak ve 15 vendor doğrulaması,
Kutarya Video kaynak/EXE'nin sekiz baseline SHA'sının aynı olduğunun kanıtıdır.
Kanitlar/motor-1/akustik.json, youtube-sonuc/, portable-*/kabul.json kanıtlar.

Setup/registry kurulumu ve kaldırma bu görevde istenmedi/denenmedi; portable
EXE teslim edilir. Genel site/Firebase/Auth/admin/Google deploy yapılmadı.
