# Alışkanlık Takipçisi

Aylık alışkanlık tablosu: her alışkanlık için ayın her gününe bir onay kutusu. Ayrıca:

- günlük ve haftalık ilerleme grafikleri, hedef / tamamlanan / kalan sayıları
- her gün için 1–10 arası **ruh hali** ve **motivasyon** puanı ve grafiği
- bu ayın en istikrarlı alışkanlıkları sıralaması
- açık / koyu tema, internetsiz çalışma, JSON yedek alma ve geri yükleme

> Durum: **taslak (v1.0.0)**.

## Platformlar

| Platform | Nasıl |
|---|---|
| Web (PWA) | GitHub Pages'te yayınlanır. Android'de Chrome'dan, bilgisayarda Chrome/Edge'den "Yükle" ile uygulama gibi kurulur. |
| Android | APK (Capacitor). GitHub Actions derler. |
| Windows | Kurulum programı ve taşınabilir EXE (Electron). GitHub Actions derler. |

**Eşitleme (telefon ↔ bilgisayar):** Firebase (e-posta/şifre girişi + Firestore, ücretsiz plan). Ayar yapılmazsa uygulama yine çalışır, ama kayıtlar yalnızca o cihazda durur.

## Kurulum

Adım adım anlatım için **[KURULUM.md](KURULUM.md)** dosyasına bak. Kod bilgisi gerekmez.

## Klasörler

| Klasör | İçerik |
|---|---|
| `www/` | Uygulamanın kendisi (statik web sitesi). Firebase ayarı: `www/firebase-config.js`. |
| `android/` | Capacitor Android projesi. |
| `electron/` | Windows / masaüstü uygulamasının ana dosyası. |
| `.github/workflows/build.yml` | "Derle ve yayınla": web sitesi + APK + EXE; `v*` etiketinde GitHub Release. |
| `firestore.rules`, `firebase.json` | Firestore güvenlik kuralları (her kullanıcı yalnızca `users/<uid>/` altını görür). |
| `assets/`, `build/`, `scripts/` | Simge kaynakları ve yardımcı betikler. |

## Komutlar

Önce `npm install` (Node.js 22.12+).

| Komut | Ne yapar |
|---|---|
| `npm start` | Web sürümünü http://localhost:8080 adresinde açar. |
| `npm run electron` | Masaüstü uygulamasını geliştirme modunda açar. |
| `npm run build:win` | Windows kurulum ve taşınabilir EXE dosyalarını `dist/` klasörüne derler (Windows'ta çalıştır). |
| `npm run build:linux` | Linux AppImage derler. |
| `npm run android:sync` | `www/` içeriğini Android projesine kopyalar. |
| `npm run android:open` | Android projesini Android Studio'da açar. |
| `npm run android:apk` / `android:apk:win` | Debug APK derler (Android SDK gerekir). |
| `npm run android:release` | Release APK derler (imza için `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` ortam değişkenleri). |
| `npm run android:icons` | Android simge ve açılış ekranlarını `assets/` klasöründen üretir. |
| `npm run icons` | Web ve Windows simgelerini, ayrıca `assets/` içindeki Android kaynak görsellerini yeniden çizer (Python 3 + Pillow). |
| `npm run build:firebase` | `www/vendor/firebase.js` paketini yeniden oluşturur. |
