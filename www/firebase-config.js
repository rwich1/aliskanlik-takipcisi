/* Telefon ile bilgisayar arasında eşitleme için Firebase ayarları.
 *
 * Boş (null) bırakırsan uygulama çalışır ama veriler yalnızca o cihazda saklanır.
 * Eşitlemeyi açmak için KURULUM.md dosyasındaki "Eşitlemeyi aç" adımlarını izle ve
 * Firebase konsolunun verdiği yapılandırmayı aşağıdaki gibi yapıştır:
 *
 * window.FIREBASE_CONFIG = {
 *   apiKey: "AIza...",
 *   authDomain: "proje-adin.firebaseapp.com",
 *   projectId: "proje-adin",
 *   storageBucket: "proje-adin.appspot.com",
 *   messagingSenderId: "1234567890",
 *   appId: "1:1234567890:web:abc123",
 * };
 *
 * Bu bilgiler gizli değildir; verilerini Firestore kuralları (firestore.rules) korur.
 */
window.FIREBASE_CONFIG = null;
