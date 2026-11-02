# Kutarya Jenerik 1.3.1 — 8 Ekim 2026

Yayın tamamlandı: https://kutarya.com/proje/kutarya-jenerik.
Hosting 0413230d431dbb8a; önceki 5998163b5783affb yedeklendi.
58/58 site testi + build; 1280/390 px canlı sayfa, altı ekran, iki Setup
dosyası, yeni sürümün ilk sırada olması, sıfır taşma/hata ve gerçek indirme
düğmesi doğrulandı. Yeni Setup'ın tamamı buluttan SHA/boyutla ölçüldü.
Sekiz diğer ürün, sekiz Functions, kurallar ve admin claim'leri korundu.

## Düzeltilen eksikler

- Taslak kayıt hatasında bellekteki ayarlar diskteki son başarılı kayıttan ayrılıyordu. Yeni ayarlar yalnız disk yazımı başarılı olursa etkinleşir.
- Kayıt klasörü oluşturulamaz veya konum kaydedilemezse motor geçersiz yeni klasörü kullanıyordu. Önceki konum artık korunur.
- Motorun sürümü sabit 1.3.0 idi. Artık package.json sürümü kullanılır.
- Site 1.2.0 paketini sunuyordu. Yeni yayın hazırlığı 1.3.1 teslim kaydını, gerçek paket SHA'sını ve altı güncel ekranı kullanır.
- Yayın kontrolünde eski Kutarya Video baseline yolu mevcut değildi. Bu kontrol artık doğrulanamayan korumayı başarılı diye sunmaz.

## Güncel kabul

43/43 birim testi; final portable uygulamada 75/75 kontrol. Gerçek Emel ve Ahmet sesleri üretildi. İki ayrı jenerikle MP4/MP3, kuyruk, iptal, yeniden deneme, taslak/proje IPC, zorunlu adlar ve kayıt hatası korumaları doğrulandı. Renderer hata sayısı sıfır. Siyah ekran, 15,5/17,5 saniye çıktı, bağımsız dört geçiş ve ses pikleri FFmpeg ile ölçüldü.

Paketli kabul: Kanitlar/portable-1791492278225/kabul.json.
Görüntü/ses kabulü: aynı klasörde goruntu-ses-kabul.json.
Setup içindeki app.asar ve 15 vendor dosyası test edilen paketle eşit. Installer çalıştırılmadı. Dosya seçim pencereleri testte taklit edildi; IPC ve disk gerçektir. ElevenLabs API sözleşmesi taklit servisle test edildi, canlı hesap üretimi denenmedi.

Gerçek YouTube isim araması çalıştı. Ayrı link doğrulaması zaman zaman başarılı olsa da iki paketli YouTube denemesinde oturum gereksinimiyle engellendi; canlı YouTube üretimi bu sürümde kabul edilmiş sayılmaz. Yerel video/hazır ses yolu geçti.

npm audit derleme araçları bağımlılıklarında 8 orta seviye bulgu verdi; yüksek/kritik bulgu yok. Rapor Kanitlar/bakim-2026-10-08/npm-audit.json. Bunlar giderilmiş sayılmaz; audit'in önerdiği electron-builder 26.5.0, kullanılan 26.15.3'ten eski olduğu için körlemesine sürüm değiştirilmedi.

## Bilgisayar temizliği

D:\RiotGames, ProgramData Riot verileri, LocalAppData Riot/Valorant verileri ve tespit edilen Başlat menüsü kısayolları silindi. VALORANT ve Riot Client kaldırma kayıtları silindi.

Tam temizlik tamamlanmadı: C:\Program Files\Riot Vanguard, vgc servisi, çalışan vgk sürücüsü ve Vanguard kaldırma kaydı yönetici yetkisi gerektiriyor. Yöneticiyle çalıştırma isteği Windows tarafından iptal edildi. Ek Public Desktop kısayolları ve Roaming Riot önbelleklerini kaldırma komutu otomatik güvenlik incelemesince reddedildi; gerekçe ayrıntısı sağlanmadı.

## Roblox

Hedef D:\Roblox. Resmî ve geçerli Roblox Corporation imzalı Player/Studio installer dosyaları D:\Roblox\Kurulum'da. LocalAppData\Roblox dizin bağlantısının hedefi D:\Roblox; kurulum/güncelleme dosyaları bu diske yönlendirilir.

Kurulum tamamlanmadı. Her iki installer resmî clientsettingscdn.roblox.com ayar servisine SslConnectFail verdi. Alternatif resmî clientsettings.roblox.com bağlantısı da SSL hatası aldı. Installer süreçleri durduruldu; kurulum dosyaları ve tanı logları korunur. Player/Studio kurulu veya çalışır diye sunulmaz.
