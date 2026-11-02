# Kutarya Jenerik 1.1 geliştirme planı

7 Ekim 2026. Mevcut Electron uygulaması ve FFmpeg kurgu motoru geliştirilir.

1. **Kolay kullanım:** Okunabilir yazılar, belirgin üç adım, geniş tıklama alanları,
   dar pencerede tek sütuna geçen düzen, sürekli erişilebilir üretim düğmesi.
   Eksik şarkı, jenerik veya fon seçimi kendi alanında açıklanır.
2. **Kaynak seçimi:** YouTube'da isimle ilk sonucu bulma ve bağlantı kullanma
   seçenekleri; yerel dosya seçimi korunur. Alt alta isimler/bağlantılar tek
   seferde kuyruğa girer. İlk sonuç başlığı ve süresi kullanıcıya gösterilir.
3. **Ses stüdyosu:** Hazır kayıt ve metinden üretim korunur. Emel/Ahmet Türkçe
   doğal sesleri kullanılır. ElevenLabs hesabındaki kadın/erkek sesleri gerçek
   API listesinden gelir; API anahtarı ayrı bağlantı alanına girilir. İsteğe
   bağlı anahtar saklama Windows şifrelemesiyle yapılır; proje/iş kaydına girmez.
4. **Üretim hızı:** Jenerik/fon/ayarlar hatırlanır, aynı ses yeniden üretilmez.
   Toplu kaynak girişi, işin ayarlarını yeniden kullanma, çıktı arama/filtreleme,
   hata sonrası tekrar deneme ve kısa reklam arası önizlemesi eklenir.
5. **Anlaşılır ayarlar:** Dengeli / jenerik önde / hızlı üretim hazır ayarları;
   ses, görüntü geçişi, okuma ve çıktı seçenekleri ayrı açıklamalı gruplar olur.
6. **Hata düzeltmeleri:** Aynı sesi eşzamanlı üretme çakışması, eski ses süresi,
   boş fonla üretim, kuyruk kaydının yarım kalması ve süre/iptal hataları ele alınır.
7. **Kabul:** Girdi/kuyruk/servis hataları için gerekli testler; gerçek Electron
   arayüzü ve 900/1100/1420 px görüntüler; FFmpeg ile siyah ekran, devam eden
   şarkı, geçişler ve ses seviyeleri; gerçek isim araması ve doğal TTS denemesi;
   son portable EXE üzerinden üretim ve oynatma. ElevenLabs canlı üretimi için
   kullanıcı API anahtarı yoksa bu kabul açıkça ayrı belirtilir.

Teslim: Güncellenmiş portable Windows EXE, kullanım açıklaması ve kabul kanıtları.
Sitede yayımlama, hesap/kurulum değişiklikleri bu aşamada yapılmaz. Günlük 150
içerik hedefi bir tasarım hedefidir; gerçek iş yükü ölçülmeden hız garantisi verilmez.
