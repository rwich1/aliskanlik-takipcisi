# Alışkanlık Takipçisi — Kurulum rehberi

Merhaba! Bu rehber uygulamayı telefonuna ve bilgisayarına kurmanı, sonra ikisini birbirine bağlamanı (eşitleme) adım adım anlatıyor. Kod bilmene gerek yok.

**Kısa yol haritası**

1. Bu klasörü ücretsiz bir GitHub hesabına yükle. GitHub uygulamayı kendisi hazırlar ve internette yayınlar. → [Bölüm 2](#2-en-hızlı-yol-web-uygulaması-olarak-kur-önerilen)
2. Uygulamayı telefona ve bilgisayara kur (web uygulaması ya da APK/EXE). → [Bölüm 2](#2-en-hızlı-yol-web-uygulaması-olarak-kur-önerilen), [Bölüm 3](#3-apk-android-ve-exe-windows-dosyaları)
3. Ücretsiz Firebase ile telefon ↔ bilgisayar eşitlemesini aç. → [Bölüm 4](#4-eşitlemeyi-aç-telefon--bilgisayar)

İlk kurulum toplam 30–45 dakika sürer. Sonrasında hiçbir şey yapman gerekmez.

> **Düğme adları hakkında:** GitHub ve Firebase ekranları çoğu zaman İngilizcedir. Düğmenin İngilizce adını tırnak içinde, yanında Türkçe anlamını yazdım: **"Create repository"** (depo oluştur) gibi. Bu siteler ekranlarını zaman zaman değiştirir. Bir düğmeyi bulamazsan benzer adlı olanı ara.

---

## 1. Bu klasörde ne var?

| Klasör / dosya | Ne işe yarar |
|---|---|
| `www` | **Uygulamanın kendisi.** Web, Android ve Windows sürümlerinin hepsi bunu kullanır. |
| `www/firebase-config.js` | Eşitleme ayarı. [Bölüm 4](#4-eşitlemeyi-aç-telefon--bilgisayar)'te dolduracaksın. Elle değiştireceğin tek dosya bu. |
| `android` | Android projesi (APK buradan derlenir). |
| `electron` | Windows (bilgisayar) uygulaması (EXE buradan derlenir). |
| `.github` | Otomatik derleme. Her yüklemede GitHub web sitesini, APK'yı ve EXE'yi kendisi hazırlar. **Yüklerken unutma.** |
| `firestore.rules` | Firebase güvenlik kuralları ([Bölüm 4.4](#44-firestore-veritabanını-oluştur)'te kopyalayacaksın). |
| `assets`, `build`, `scripts` | Simgeler (ikonlar) ve yardımcı dosyalar. |
| `package.json`, `package-lock.json` | Proje ayarları ve komutlar. |
| `node_modules`, `dist` | (Varsa) bilgisayarda oluşan geçici araç ve çıktı klasörleri. **GitHub'a yükleme**; gerektiğinde kendiliğinden yeniden oluşurlar. Sana gönderilen zip'te zaten yoklar. |

**Hangi yolu seçmeliyim?**

- **Web uygulaması (önerilen):** En kolayı. Telefonda ve bilgisayarda kendi penceresinde, normal bir uygulama gibi açılır. İnternetsiz de çalışır ve kendini kendisi günceller.
- **APK / EXE:** "Gerçek" uygulama dosyası istersen. İçerik aynıdır, yalnızca kurulma şekli farklıdır.

---

## 2. En hızlı yol: web uygulaması olarak kur (önerilen)

### 2.1 GitHub hesabı aç

1. [github.com](https://github.com) adresine git → **"Sign up"** (kayıt ol).
2. E-posta, şifre ve bir kullanıcı adı seç. Kullanıcı adın uygulamanın adresinde görünecek (ör. `ayse` → `https://ayse.github.io/...`).
3. E-postana gelen kodla hesabını doğrula.

### 2.2 Klasörü GitHub'a yükle

Kodun herkese açık (**Public**) bir depoda (repo) durması gerekiyor. Gizli (Private) depolarda GitHub Pages ücretli plan ister.

> **Endişelenme:** Kodun içinde hiçbir kişisel bilgin yok. Alışkanlık kayıtların koda değil, kendi Firebase hesabına kaydedilir ve yalnızca sen görebilirsin ([Bölüm 4](#4-eşitlemeyi-aç-telefon--bilgisayar)). Kodu başkaları görebilir ama verilerini göremez.

İki yol var. **A yolu daha kolay ve hatasız**, onu öneririm.

#### A yolu: GitHub Desktop ile (önerilen)

1. [desktop.github.com](https://desktop.github.com) adresinden **GitHub Desktop**'ı indir ve kur.
2. Aç → **"Sign in to GitHub.com"** (GitHub'a giriş yap) → tarayıcıda izin ver. "Configure Git" ekranı çıkarsa **"Finish"** (bitir) de.
3. Üst menü **"File"** (Dosya) → **"Add local repository…"** (yerel depo ekle) → **"Choose…"** (seç) → bu klasörü seç → **"Add repository"** (depoyu ekle).
   - *"This directory does not appear to be a Git repository"* yazarsa aynı yazının içindeki **"create a repository"** bağlantısına tıkla, sonra **"Create repository"** de.
4. Solda dosya listesi görürsen sol alttaki **"Summary"** (özet) kutusuna `İlk sürüm` yaz → **"Commit to main"**. (`node_modules` listede görünmez, olması gereken de bu.)
5. Üstte **"Publish repository"** (depoyu yayınla) → istersen adı değiştir (ör. `aliskanlik`) → **"Keep this code private" işaretini KALDIR** → **"Publish repository"**.

Sonradan bir dosyayı değiştirirsen: GitHub Desktop'ta **"Commit to main"** → üstte **"Push origin"** (gönder).

#### B yolu: Tarayıcıdan yükleme

1. GitHub'da sağ üstteki **"+"** → **"New repository"** (yeni depo).
2. **"Repository name"** (depo adı): ör. `aliskanlik` (Türkçe harf ve boşluk kullanma) → **"Public"** seçili olsun → başka hiçbir şeyi işaretleme → **"Create repository"**.
3. Sana gönderilen zip'i açtıysan bu adımı atla. Klasörü başka bir yerden aldıysan önce şu klasörleri **sil** (hepsi gerektiğinde kendiliğinden yeniden oluşur): `node_modules`, `dist`, `android/app/build`, `android/.gradle`, `android/app/src/main/assets`, `android/capacitor-cordova-android-plugins`. Bulamadıkların zaten yok demektir.
4. GitHub'da yeni deponun sayfasındaki **"uploading an existing file"** (var olan dosyayı yükle) bağlantısına tıkla.
5. GitHub tek seferde en fazla 100 dosya kabul ettiği için **iki seferde** yükle:
   - **1. sefer:** `android` klasörü ve (varsa) `.git` klasörü **hariç** her şeyi (`.github` klasörü dahil) seçip sayfaya sürükle → biraz bekle → aşağıda **"Commit changes"** (değişiklikleri kaydet).
   - **Kontrol:** Deponun ana sayfasında `.github` klasörünü görüyor musun? Bazı tarayıcılar noktayla başlayan klasörleri atlar. Görmüyorsan: **"Add file"** → **"Create new file"** → ad kutusuna `.github/workflows/build.yml` yaz → bilgisayarındaki aynı dosyayı Not Defteri ile açıp içeriğini yapıştır → **"Commit changes"**.
   - **2. sefer:** Deponun ana sayfasında **"Add file"** → **"Upload files"** → `android` klasörünün **kendisini** sürükle → **"Commit changes"**.

### 2.3 GitHub Pages'i aç (web sitesi)

1. Deponun sayfasında üstteki **"Settings"** (ayarlar) → soldaki menüde **"Pages"**.
2. **"Build and deployment"** başlığı altında **"Source"** (kaynak) kutusundan **"GitHub Actions"**'ı seç. Ayrıca kaydet düğmesi yok, seçmen yeterli.
3. Üstteki **"Actions"** sekmesi → solda **"Derle ve yayınla"** → sağda **"Run workflow"** (çalıştır) → açılan kutudaki yeşil **"Run workflow"**.
   - Solda **"Derle ve yayınla"** yoksa `.github` klasörü yüklenmemiştir: 2.2'deki **Kontrol** adımını yap.
   - Yükleme yaptığın anda bir çalışma kendiliğinden başlamış olabilir. Pages açılmadan başladığı için içindeki **"Web sitesi (GitHub Pages)"** işi kırmızı ✗ olabilir. Bu normal; yeni başlattığın çalışma düzgün geçer.
4. Bekle. Web sitesi 1–2 dakikada hazır olur. **"Android (APK)"** ve **"Windows (EXE)"** işleri 10–15 dakika sürebilir, onları beklemene gerek yok.
5. Uygulamanın adresi: `https://<kullanıcı-adın>.github.io/<depo-adın>/`
   Örnek: `https://ayse.github.io/aliskanlik/`. Adres **Settings → Pages** sayfasının üstünde de yazar ("Your site is live at…").

### 2.4 Telefona kur (Android)

1. Telefonda **Chrome** ile uygulamanın adresini aç.
2. Sağ üstteki **⋮** menüsü → **"Uygulamayı yükle"** ya da **"Ana ekrana ekle"** → **"Yükle"**.
3. Ana ekranında **Alışkanlık** simgesi belirir. Artık oradan aç.

### 2.5 Bilgisayara kur (Windows / Mac)

1. **Chrome** ya da **Edge** ile uygulamanın adresini aç.
2. Adres çubuğunun sağ ucundaki **yükle simgesine** (küçük ekran ve ok) tıkla → **"Yükle"**.
   - Simgeyi göremezsen tarayıcının **⋮** (Edge'de **…**) menüsünde "yükle" ya da "uygulama olarak yükle" geçen seçeneği seç.
3. Uygulama Başlat menüsüne (ve istersen masaüstüne) eklenir.

**Kurduktan sonra:** Uygulama kendi penceresinde açılır, internet yokken de çalışır ve yeni sürümleri kendisi alır.

> **Önemli:** Eşitlemeyi açana kadar ([Bölüm 4](#4-eşitlemeyi-aç-telefon--bilgisayar)) her cihaz kendi kayıtlarını ayrı tutar. Telefonda işaretlediğin bir şey bilgisayarda görünmez.

---

## 3. APK (Android) ve EXE (Windows) dosyaları

Web uygulaması yerine "gerçek" uygulama dosyası istersen GitHub bunları her yüklemede kendisi derler. İki yerden alabilirsin:

- **Actions → Artifacts:** Her çalışmadan sonra hazır olur. GitHub'a giriş yapmış olman gerekir. Dosyalar zip içinde gelir ve bir süre sonra (genelde 90 gün) silinir.
- **Releases (sürümler) sayfası:** "Sürüm çıkardığında" ([3.4](#34-sürüm-çıkarmak-releases-sayfası)) oluşur. Kalıcıdır, giriş gerektirmez ve dosyalar doğrudan `.apk` / `.exe` olarak iner. **Telefona indirmek için en kolayı budur.**

### 3.1 Dosyaları indir (Artifacts)

1. Depo → **"Actions"** → listedeki en üstteki, yanında yeşil ✓ olan **"Derle ve yayınla"** çalışmasına tıkla.
2. Sayfanın en altındaki **"Artifacts"** bölümünde iki dosya var:
   - **android-apk** → içinde `Aliskanlik-Takipcisi-<sürüm>-debug.apk` (imza anahtarı eklediysen bir de `...-release.apk`, bkz. [3.5](#35-kalıcı-android-imza-anahtarı-isteğe-bağlı))
   - **windows-exe** → içinde `Aliskanlik-Takipcisi-Kurulum-<sürüm>.exe` ve `Aliskanlik-Takipcisi-<sürüm>-portable.exe`
3. İndirdiğin zip'e sağ tıkla → **"Tümünü ayıkla"**.

### 3.2 Android'e APK kur

1. APK dosyasını telefona aktar: USB kablo, Google Drive ya da kendine e-posta. Ya da telefonda doğrudan Releases sayfasından indir.
2. Telefonda **Dosyalar** uygulamasından APK'ya dokun.
3. *"Bilinmeyen uygulamaları yükleme izni yok"* gibi bir uyarı çıkarsa: **"Ayarlar"** → **"Bu kaynağa izin ver"** anahtarını aç → geri dön → **"Yükle"**. Eski telefonlarda bu ayar **Ayarlar → Güvenlik → "Bilinmeyen kaynaklar"** altındadır. (Telefonuna göre adlar biraz farklı olabilir.)
4. **Play Protect** uyarısı çıkarsa: **"Daha fazla ayrıntı"** → **"Yine de yükle"**. Bu uyarı, uygulama Play Store'dan gelmediği için çıkar.

> APK'yı **yalnızca kendi deponun** Actions ya da Releases sayfasından indir. Başka yerden gelen bir APK aynı test anahtarıyla imzalanmış olabilir ve uygulamanın üzerine kurulabilir.

**Güncellemek için:** Yeni APK'yı aynı şekilde kur. Eskisinin üzerine kurulur ve kayıtların kalır. (Projede sabit bir test imza anahtarı var, `android/app/debug.keystore`. Bu sayede her yeni debug APK eskisinin üzerine kurulabilir.)

> Telefonda hem web uygulamasını hem APK'yı kurarsan, eşitleme kapalıyken ikisi ayrı kayıt tutar. Birini seç ya da eşitlemeyi aç.

### 3.3 Windows'a EXE kur

- `Aliskanlik-Takipcisi-Kurulum-<sürüm>.exe` → **Kurulum programı (önerilen).** Başlat menüsüne ve masaüstüne kısayol koyar.
- `Aliskanlik-Takipcisi-<sürüm>-portable.exe` → Kurulum gerektirmez, çift tıklayınca açılır (her açılışta biraz daha yavaş başlar). Kayıtlar yine bu bilgisayarda (AppData) tutulur, USB bellekle taşınmaz; taşımak için eşitlemeyi ya da Yedek'i kullan. Kurulumlu sürümle aynı kayıtları kullanır, ikisi aynı anda açılmaz.

1. Kurulum dosyasına çift tıkla.
2. Mavi bir **"Windows bilgisayarınızı korudu"** penceresi çıkarsa: **"Ek bilgi"** (bazı sürümlerde "Daha fazla bilgi", İngilizcesi "More info") → **"Yine de çalıştır"** ("Run anyway").
   Bu uyarı, dosya ücretli bir kod imzası taşımadığı için çıkar. Zararlı bir şey değil.
3. Kurulum sihirbazında klasörü seç → kur → bitince uygulama açılır.

**Güncellemek için:** Masaüstü uygulaması kendini kendisi güncellemez. Yeni kurulum dosyasını indirip çalıştır; eskisinin üzerine kurulur ve kayıtların kalır. Uygulamayı kaldırsan bile bilgisayardaki kayıtlar silinmez.

### 3.4 Sürüm çıkarmak (Releases sayfası)

1. Deponun ana sayfasında sağdaki **"Releases"** → **"Create a new release"** ya da **"Draft a new release"** (yeni sürüm).
2. **"Choose a tag"** / **"Select tag"** (etiket seç) kutusuna `v1.0.0` yaz → **"Create new tag: v1.0.0 on publish"**.
3. Başlığa istediğini yaz (ör. `Sürüm 1.0.0`) ya da boş bırak → **"Publish release"** (yayınla). Yazdığın başlık ve açıklama korunur; GitHub altına "hangi dosyayı indirmeliyim" notunu ekler.
4. 10–20 dakika içinde GitHub APK ve EXE dosyalarını bu sürümün **"Assets"** bölümüne kendisi ekler. İlerlemeyi **"Actions"** sekmesinden izleyebilirsin.

Sonraki sürümlerde her seferinde bir öncekinden büyük numara ver: `v1.0.1`, `v1.1.0`… (Etiket `v` ile başlamalı; `v1.1` gibi kısa yazarsan `1.1.0` sayılır.)

### 3.5 Kalıcı Android imza anahtarı (isteğe bağlı)

**Çoğu kişi için gerekmez.** Debug APK yeterlidir ve güncellemeler zaten eskisinin üzerine kurulur.

**Ne işe yarar?** Projedeki test (debug) anahtarı depoda herkese açık durur. Kendi anahtarınla imzalanmış "release" APK ise yalnızca senin yapabileceğin bir sürümdür.

**Dikkat:**

- Debug APK'dan release APK'ya geçerken telefondaki eski uygulamayı **bir kez kaldırman** gerekir (imzalar farklı). Eşitleme açıksa verilerin hesabında güvendedir; değilse önce **Yedeği al** ([Bölüm 5](#5-verileri-taşımak--yedeklemek)).
- Anahtar dosyasını ya da şifresini kaybedersen sonraki release APK'lar eskisinin üzerine kurulmaz. Dosyayı güvenli bir yerde sakla ve **GitHub'a yükleme**.

**Adımlar:**

1. Bilgisayarında Java olmalı. Android Studio kuruluysa Java onunla gelir (`C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe`). Değilse [adoptium.net](https://adoptium.net) adresinden Java'yı kur.
2. **Proje klasörünün dışında** bir klasör aç (ör. Belgeler\anahtar). Klasörde boş bir yere Shift + sağ tık → **"PowerShell penceresini burada aç"** / **"Terminalde aç"**. Şunu yaz:

   ```
   keytool -genkeypair -v -keystore aliskanlik-release.jks -alias aliskanlik -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Aliskanlik Takipcisi"
   ```

   Senden iki kez şifre ister (en az 6 karakter; yazarken ekranda görünmez). Bu şifreyi bir yere not et.
   - *"keytool tanınmıyor"* hatası alırsan baştaki `keytool` yerine tam yolunu yaz: `& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"` (Java'yı adoptium'dan kurduysan kendi klasöründeki `bin\keytool.exe`).
3. Dosyayı metne çevirip panoya kopyala. Aynı pencerede:

   ```
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\aliskanlik-release.jks")) | Set-Clipboard
   ```

   (Mac'te: `base64 -i aliskanlik-release.jks | pbcopy`)
4. GitHub'da depo → **"Settings"** → solda **"Secrets and variables"** → **"Actions"** → **"New repository secret"** (yeni gizli bilgi). Şu dördünü tek tek ekle:

   | Name (ad) | Secret (değer) |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | Panodaki uzun metin (Ctrl+V) |
   | `ANDROID_KEYSTORE_PASSWORD` | 2. adımdaki şifre |
   | `ANDROID_KEY_ALIAS` | `aliskanlik` |
   | `ANDROID_KEY_PASSWORD` | Yine 2. adımdaki şifre (aynısı) |

5. **"Actions"** → **"Derle ve yayınla"** → **"Run workflow"**. Artık **android-apk** zip'inde imzalı `...-release.apk` de olur.

---

## 4. Eşitlemeyi aç (telefon ↔ bilgisayar)

Eşitleme için Google'ın ücretsiz servisi **Firebase** kullanılır. Kendine ait bir "proje" açarsın; kayıtların orada, senin hesabında durur. Bir Google (Gmail) hesabı yeterli, kredi kartı gerekmez. Yaklaşık 15 dakika sürer.

### 4.1 Firebase projesi oluştur

1. [console.firebase.google.com](https://console.firebase.google.com) adresine git ve Google hesabınla giriş yap.
2. **"Create a project"** / **"Get started by setting up a Firebase project"** (proje oluştur) → proje adı: ör. `aliskanlik` → **"Continue"** (devam).
3. Yapay zekâ (Gemini) yardımı sorarsa kapalı bırakabilirsin → **"Continue"**.
4. **"Google Analytics"** sayfasında anahtarı **kapat** → **"Create project"** → hazır olunca **"Continue"**.

### 4.2 Web uygulaması ekle ve ayarı kopyala

1. Proje ana sayfasında **"</>"** (Web) simgesine tıkla. ("Add app" (uygulama ekle) düğmesinin altında da olabilir.)
2. **"App nickname"** (takma ad): `Alışkanlık` → **"Also set up Firebase Hosting"** kutusunu **işaretleme** → **"Register app"** (kaydet).
3. Ekranda bir kod çıkar. İçindeki `const firebaseConfig = { ... };` bölümünde **süslü parantezler arasındaki satırları** (`apiKey` ile başlayıp `appId` ile biten) kopyala → **"Continue to console"**.
   - Sonradan tekrar bulmak için: sol üstteki ⚙ → **"Project settings"** (proje ayarları) → **"General"** → aşağıda **"Your apps"** → **"Config"**.
4. `www/firebase-config.js` dosyasını aç:
   - **GitHub'da:** Depo → `www` → `firebase-config.js` → sağ üstteki kalem simgesi ✏ (**"Edit this file"**).
   - **Ya da bilgisayarında:** Dosyaya sağ tık → **"Birlikte aç"** → **Not Defteri**.
5. Dosyanın **en altındaki** `window.FIREBASE_CONFIG = null;` satırını sil ve yerine kopyaladığın değerlerle şunu yaz:

   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "aliskanlik-xxxx.firebaseapp.com",
     projectId: "aliskanlik-xxxx",
     storageBucket: "aliskanlik-xxxx.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   };
   ```

   - Tırnakları, virgülleri ve sondaki `};` işaretini olduğu gibi bırak. Üstteki açıklama satırlarına (`/*` ile `*/` arası) dokunma.
   - Bu bilgiler gizli değildir; GitHub'da görünmesi sorun olmaz. Verilerini 4.4'teki güvenlik kuralları korur.
6. Kaydet:
   - **GitHub'da:** **"Commit changes…"** → tekrar **"Commit changes"**.
   - **Bilgisayarda düzenlediysen:** GitHub Desktop → **"Commit to main"** → **"Push origin"**.

   GitHub uygulamayı birkaç dakika içinde yeniden derler. Web uygulaması bu ayarı kendisi alır. **APK/EXE kullanıyorsan** bu değişiklikten sonra derlenen yeni dosyaları indirip kur ([Bölüm 3](#3-apk-android-ve-exe-windows-dosyaları)); eski APK/EXE eşitlemesiz kalır.

### 4.3 E-posta/Şifre girişini aç (Authentication)

1. Firebase'de sol menüden **"Build"** (oluştur) → **"Authentication"** (kimlik doğrulama).
   - Menüde göremezsen üstteki arama kutusuna `Authentication` yaz.
2. **"Get started"** (başla).
3. **"Sign-in method"** (giriş yöntemi) sekmesi → **"Email/Password"** (e-posta/şifre).
4. İlk anahtarı (**"Enable"**, etkinleştir) aç. Altındaki "Email link (passwordless sign-in)" kapalı kalsın → **"Save"** (kaydet).

### 4.4 Firestore veritabanını oluştur

1. Sol menüden **"Build"** → **"Firestore Database"**.
2. **"Create database"** (veritabanı oluştur).
3. Sürüm sorarsa **"Standard edition"**'ı seç. **"Database ID"** `(default)` olarak kalsın.
4. **"Location"** (konum): Avrupa'dan birini seç, ör. **`eur3 (europe)`** ya da **`europe-west3 (Frankfurt)`**. Bu sonradan değiştirilemez → **"Next"**.
5. **"Start in production mode"** (üretim modu) → **"Create"**.
6. Veritabanı açılınca üstteki **"Rules"** (kurallar) sekmesine geç. Kutudaki her şeyi sil ve bu klasördeki **`firestore.rules`** dosyasının içeriğini yapıştır. (Dosyayı Not Defteri ile açıp Ctrl+A, Ctrl+C yapabilir ya da aşağıdakini kopyalayabilirsin.) → **"Publish"** (yayınla).

   ```
   rules_version = '2';

   // Alışkanlık Takipçisi: a signed-in user may read and write only their own documents,
   // and only the ones the app uses: users/<uid>/data/settings and users/<uid>/data/m-YYYY-MM.
   // Everything else is denied.
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/data/{key} {
         allow read: if request.auth != null && request.auth.uid == userId;
         allow write: if request.auth != null && request.auth.uid == userId
           && (key == 'settings' || key.matches('m-[0-9]{4}-[0-9]{2}'));
       }
     }
   }
   ```

   Bu kural "herkes yalnızca kendi kayıtlarını görebilir ve değiştirebilir" demektir.

### 4.5 Uygulamada hesap aç

1. Uygulamayı kapatıp yeniden aç. (Web uygulamasında yeni ayarın gelmesi için bir kez daha kapatıp açman gerekebilir.)
2. Üstteki **"Alışkanlıklarımı düzenle"** düğmesinin yanındaki **⚙** (**Ayarlar**) düğmesine bas → **"Hesap ve eşitleme"** bölümü.
   - Hâlâ *"Eşitleme henüz kurulmadı"* yazıyorsa → [Sık sorunlar](#7-sık-sorunlar).
3. **İlk cihazda** (kayıtların çok olduğu cihaz, ör. bilgisayar): **E-posta** ve **Şifre (en az 6 karakter)** yaz → **"Hesap oluştur"**.
4. **Diğer cihazda:** Aynı e-posta ve şifreyi yaz → **"Giriş yap"**.
5. Üstteki küçük durum etiketinde *"Hesabına kayıtlı · cihazlar eşit"* ya da *"Kaydedildi · tüm cihazlarda güncel"* görürsen tamamdır.
6. **Önerilir — yeni hesap açmayı kapat:** Deponun herkese açık olması, başkasının senin Firebase projende hesap açabileceği anlamına gelir. Kimse senin kayıtlarını göremez ama ücretsiz kotanı harcayabilir. İki cihazında da giriş yaptıktan sonra Firebase → **"Authentication"** → **"Settings"** (ayarlar) sekmesi → **"User actions"** (kullanıcı işlemleri) → **"Enable create (sign-up)"** kutusunun işaretini kaldır → **"Save"**. Var olan hesabınla giriş yapmaya devam edebilirsin; yeni bir cihazda da aynı hesapla **"Giriş yap"** demen yeterli.

**Bilmen gerekenler:**

- Hesaba ilk kez giriş yapıldığında **hesap boşsa**, o cihazdaki kayıtlar hesaba kopyalanır (*"Bu cihazdaki kayıtlar hesabına aktarıldı"*). Hesap zaten doluysa (ör. ikinci cihaz) o cihazın eski kayıtları aktarılmaz. Onları da istiyorsan önce [Yedek](#5-verileri-taşımak--yedeklemek) ile taşı.
- İnternet yokken de kullanmaya devam edebilirsin. Etiket *"Çevrimdışı · bağlanınca eşitlenecek"* der ve bağlanınca kendisi gönderir.
- Şifreni unutursan: **"Şifremi unuttum"** → e-postana sıfırlama bağlantısı gelir (spam klasörüne de bak).
- **"Çıkış yap"** dersen o cihaz yalnızca kendi yerel kayıtlarını gösterir; hesabındaki kayıtlar silinmez.
- **Ücretsiz plan (Spark) yeterli:** Günde 50.000 okuma, 20.000 yazma ve 1 GB yer. Kişisel kullanım bunun çok altında kalır. Firebase "Upgrade" (yükselt) önerirse gerek yok.

---

## 5. Verileri taşımak / yedeklemek

**⚙ Ayarlar → "Yedek"** bölümünde:

- **"Yedeği al":** Tüm alışkanlıklarını ve aylık kayıtlarını tek bir dosyaya kaydeder (`aliskanlik-yedek-YYYY-AA-GG.json`). Tarayıcıda dosya **İndirilenler** klasörüne iner; Windows uygulamasında nereye kaydedeceğini sorar.
  - **Android uygulamasında (APK)** dosya yerine bir metin kutusu çıkar → **"Panoya kopyala"** → metni güvenli bir yere yapıştır (kendine e-posta, Notlar, Google Keep…).
- **"Yedekten geri yükle":** Yedek dosyasını (`.json`) seç.
- **"Metni yapıştırarak yükle":** Kopyaladığın yedek metnini kutuya yapıştır → **"Kontrol et"**.
- Ardından *"Yedekte … aylık kayıt var"* onayı çıkar:
  - **"Birleştir":** Yedektekileri mevcut kayıtlara **ekler**. İki cihazın kayıtlarını bir araya getirmek için bunu seç.
  - **"Üzerine yaz":** Yedekteki ayların kayıtları, aynı ayların mevcut kayıtlarının **yerine geçer** (yedeği geri yüklemek için). Yedekte olmayan aylara dokunulmaz.
  - **"Vazgeç":** Hiçbir şey değişmez.

Giriş yapmışsan yedek hesabına yüklenir ve tüm cihazlarında görünür.

**Örnek, eşitleme olmadan telefondan bilgisayara taşıma:** Telefonda **"Yedeği al"** → metni kopyala → kendine e-postayla gönder → bilgisayarda **"Metni yapıştırarak yükle"** → **"Kontrol et"** → **"Birleştir"**.

**Örnek, ikinci cihazın eski kayıtlarını hesaba katmak:** Hesaba ilk girdiğinde o cihazın eski kayıtları aktarılmadıysa: **"Çıkış yap"** → **"Yedeği al"** → tekrar **"Giriş yap"** → **"Yedekten geri yükle"** → **"Birleştir"**.

---

## 6. Bilgisayarında kendin çalıştırmak (isteğe bağlı)

Bu bölüm yalnızca meraklılar için. Normal kullanım için gerekmez.

1. [nodejs.org](https://nodejs.org) adresinden **Node.js**'in güncel **LTS** sürümünü (22.12 ya da üstü) kur.
2. Proje klasöründe bir terminal aç: Windows'ta klasörün adres çubuğuna `cmd` yazıp Enter'a bas.
3. İlk seferde `npm install` yaz (birkaç dakika sürer, `node_modules` klasörü oluşur).
4. Sonra ihtiyacına göre:

| Komut | Ne yapar |
|---|---|
| `npm start` | Web sürümünü başlatır. Tarayıcıda **http://localhost:8080** adresini aç. |
| `npm run electron` | Windows uygulamasını kurmadan bir pencerede açar. |
| `npm run build:win` | (Windows'ta) kurulum ve taşınabilir EXE dosyalarını `dist` klasörüne derler. |
| `npm run android:sync` | `www` içindeki dosyaları Android projesine kopyalar (her değişiklikten sonra). |
| `npm run android:open` | Projeyi **Android Studio**'da açar. Orada ▶ **"Run"** ile telefona ya da emülatöre kurabilirsin. |
| `npm run android:apk:win` | (Windows'ta, Android Studio kuruluysa) debug APK derler → `android/app/build/outputs/apk/debug/app-debug.apk`. Mac/Linux'ta: `npm run android:apk`. |

Android için önce [Android Studio](https://developer.android.com/studio)'yu kur ve bir kez açıp ilk kurulumunu tamamla, sonra `npm run android:sync` ve `npm run android:open` komutlarını çalıştır.

- Proje **Java 17** ister. Android Studio "Gradle JVM" ya da "incompatible Java" hatası verirse: **Settings** → **Build, Execution, Deployment** → **Build Tools** → **Gradle** → **Gradle JDK** → **17** seç (listede yoksa **"Download JDK…"** → sürüm 17).
- `npm run android:apk:win` komutu için `JAVA_HOME` ortam değişkeni bir Java 17 klasörünü göstermelidir.
- Bilgisayarında derlediğin APK, GitHub'ın derlediğinin **üzerine kurulmaz** (sürüm numarası daha küçüktür). Denemek için önce telefondaki uygulamayı kaldır.

**İleri düzey:** Firestore kurallarını konsola yapıştırmak yerine komutla da yükleyebilirsin (klasördeki `firebase.json` bunun içindir):

```
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project <firebase-proje-kimliğin>
```

---

## 7. Sık sorunlar

Belirtiyi bul, altındaki adımı uygula.

#### Üstteki etiket "Kaydedilemedi" ya da "Firestore kuralları erişime izin vermiyor" diyor

[4.4](#44-firestore-veritabanını-oluştur)'ün 6. adımını kontrol et: kurallar yapıştırılıp **"Publish"**'e basıldı mı? Kuralların etkinleşmesi bir dakika kadar sürebilir. Etikete dokunursan kaydetmeyi yeniden dener. Yanında `(not-found)` gibi bir kod varsa Firestore veritabanı henüz oluşturulmamış olabilir ([4.4](#44-firestore-veritabanını-oluştur)).

#### "Firebase'de E-posta/Şifre girişi açık değil" ya da "Firebase'de Authentication açılmamış"

[4.3](#43-e-postaşifre-girişini-aç-authentication) adımını yap.

#### "firebase-config.js içindeki apiKey hatalı."

[4.2](#42-web-uygulaması-ekle-ve-ayarı-kopyala)'deki ayarı Firebase'den yeniden kopyala.

#### "Eşitleme servisi yüklenemedi…"

İnternet bağlantını kontrol et ve **"Tekrar dene"**'ye bas. Düzelmezse `firebase-config.js` içinde eksik bir tırnak, virgül ya da parantez olabilir.

#### Ayarlar'da hâlâ "Eşitleme henüz kurulmadı" yazıyor

`firebase-config.js`'in en alt satırında hâlâ `null` mı yazıyor, ya da bir yazım hatası mı var? Kontrol et. Dosya doğruysa uygulama eski dosyayı kullanıyordur:
- **Web uygulaması:** Birkaç dakika bekle, uygulamayı tamamen kapatıp aç, gerekirse bir kez daha.
- **APK/EXE:** Değişiklikten sonra derlenen **yeni** APK/EXE'yi indirip kur.

#### "Firebase ücretsiz kotası doldu"

Günlük sınır aşılmış. Ertesi gün kendiliğinden düzelir. Kişisel kullanımda neredeyse hiç olmaz.

#### "Alışkanlık listen yükleniyor, birazdan tekrar dene" diyor

Hesabına giriş yaptığın bir cihaz, alışkanlık listeni ilk kez sunucudan almadan önce listeyi değiştirmene izin vermez. Böylece eski ya da boş bir liste hesabındakinin üzerine yazılmaz. İnternete bağlan ve birkaç saniye bekle. Kutucukları işaretlemek bu sırada da çalışır.

#### Bir cihazdaki değişiklik diğerinde görünmüyor

İki cihazda da **aynı e-postayla** giriş yapıldığından emin ol (⚙ Ayarlar → *"Giriş yapıldı: …"*). Etiket *"Çevrimdışı"* diyorsa internet gelince gönderilir.

#### Web uygulaması güncellenmiyor

Uygulamayı kapatıp yeniden aç. İnternet varken uygulama her açılışta en yeni dosyaları alır; altta *"Yeni sürüm hazır"* bildirimi çıkarsa **"Güncelle"**'ye bas. GitHub'ın yeni dosyaları yayması 10 dakikayı bulabilir.

#### Windows uygulaması güncellenmiyor

Masaüstü uygulaması kendini güncellemez. Yeni kurulum dosyasını indirip kur ([3.3](#33-windowsa-exe-kur)).

#### APK kurarken "Uygulama yüklenmedi"

Telefondaki eski sürüm farklı bir anahtarla imzalanmış (ör. debug'dan release'e geçiş ya da başka bir bilgisayarda derlenmiş bir APK). Eşitleme kapalıysa önce **"Yedeği al"**. Sonra eski uygulamayı kaldır, yeni APK'yı kur ve giriş yap ya da yedeği geri yükle.

#### Windows "Windows bilgisayarınızı korudu" diyor

**"Ek bilgi"** → **"Yine de çalıştır"** ([3.3](#33-windowsa-exe-kur)).

#### Tarayıcı indirdiğim dosyayı engelledi ("yaygın olarak indirilmiyor")

İndirilenler listesinde dosyanın yanındaki menüden **"Sakla"** / **"Keep"** seç.

#### Actions'ta kırmızı ✗ var

Çalışmaya tıkla ve hangi işin kırmızı olduğuna bak.
- **"Web sitesi (GitHub Pages)"** kırmızıysa genelde Pages açık değildir: [2.3](#23-github-pagesi-aç-web-sitesi)'ü yap, sonra sağ üstteki **"Re-run jobs"** → **"Re-run all jobs"** (tümünü yeniden çalıştır).
- Diğerleri için bir kez **"Re-run failed jobs"** (başarısızları yeniden çalıştır) dene. Düzelmezse yardım isterken o sayfanın bağlantısını paylaş.

#### claude.ai'deki önceki sürümde girdiğim kayıtlar burada yok

claude.ai'de denediğin sürüm verilerini claude.ai'nin kendi deposunda tutar. Bu uygulama o kayıtlara ulaşamaz ve otomatik aktarmaz. İki seçeneğin var: eski sürümü yan yana açıp bu ayın kayıtlarını buraya elle işaretle, ya da temiz bir başlangıç yap.
