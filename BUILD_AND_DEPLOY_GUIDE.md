# دليل التشغيل، الربط السحابي، وتصدير ملف APK لتطبيق «وتين سبورت» (Wateen Sport)

هذا الدليل مخصص لمالك ومدير تطبيق **وتين سبورت** (`com.wateensport.app`).

---

## 1. تشغيل التطبيق ومعاينته محلياً على جهازك
افتح PowerShell داخل مجلد `wateen_sport` ونفّذ:
```powershell
npm.cmd install
npm.cmd run dev
```
ثم افتح الرابط الذي يظهر في المتصفح (عادة `http://localhost:5173`).

- **الدخول إلى لوحة التحكم الخاصة بك:** اضغط على تبويب **لوحة التحكم** في الشريط السفلي.
- **الرمز السري الافتراضي:** `2026` (يمكنك تغييره فوراً من داخل تبويب **السحابة والأمان**).

---

## 2. تفعيل المزامنة السحابية الفورية + الإشعارات الفورية (Firebase)
حتى يظهر أي خبر أو نتيجة مباراة تعدّلها فوراً على **جميع هواتف أندرويد** المثبّت عليها التطبيق:

1. أنشئ مشروعاً مجانياً على [Firebase Console](https://console.firebase.google.com) باسم `wateen-sport`.
2. فعّل الخدمات التالية من القائمة الجانبية:
   - **Firestore Database** (اختر Create database -> Production mode، ثم انسخ محتوى `firebase/firestore.rules` في تبويب Rules واضغط Publish).
   - **Storage** (لتخزين صور الأخبار والبنرات).
   - **Cloud Messaging (FCM)** لإرسال الإشعارات الفورية لأجهزة أندرويد.
3. من إعدادات المشروع (**Project Settings**):
   - أضف تطبيق ويب (`</>`) وانسخ قيم `firebaseConfig` ثم إما:
     - أدخلها مباشرة من داخل التطبيق في **لوحة التحكم -> السحابة والأمان** ثم اضغط **حفظ وتفعيل المزامنة السحابية** ثم **رفع ومزامنة البيانات الحالية للسحابة**، أو
     - انسخ `.env.example` إلى `.env` واملأ القيم قبل بناء ملف الـ APK حتى تأتي مدمجة تلقائياً لكل المستخدمين!
   - أضف تطبيق Android بمعرّف الحزمة `com.wateensport.app` وحمّل ملف `google-services.json` وضعه داخل `android/app/google-services.json` لتفعيل استقبال الإشعارات الفورية على أندرويد.
4. (اختياري لبث إشعارات Push تلقائياً): انشر الدالة السحابية الجاهزة في مجلد `firebase/functions/`:
   ```bash
   cd firebase/functions
   npm install
   firebase deploy --only functions
   ```

---

## 3. بناء وتصدير ملف APK وتجهيز رابط تحميل مباشر

لديك طريقتان — **الطريقة الأولى لا تحتاج لتثبيت Android Studio على جهازك أبداً!**

### الطريقة الأولى (الأسرع والأسهل): بناء APK سحابياً والحصول على رابط تحميل مباشر عبر GitHub Actions
الملف `.github/workflows/build-apk.yml` جاهز بالكامل داخل المشروع:
1. أنشئ مستودعاً (Repository) على [GitHub](https://github.com) وارفع مجلد `wateen_sport`:
   ```powershell
   cd wateen_sport
   git init
   git add .
   git commit -m "Launch Wateen Sport v1.0.0"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/wateen-sport.git
   git push -u origin main
   ```
2. (اختياري) أضف مفاتيح Firebase في `Settings -> Secrets and variables -> Actions` بنفس الأسماء الموجودة في `.env.example`.
3. خلال 3 دقائق فقط، سيقوم GitHub ببناء ملف **`WateenSport-v1.0.0.apk`** تلقائياً وإنشاء إصدار في صفحة **Releases** يحتوي على **رابط تحميل مباشر** يمكنك إرساله فوراً عبر واتساب وفيسبوك!

### الطريقة الثانية: بناء ملف APK محلياً على Windows
إذا أردت البناء مباشرة من جهازك:
1. ثبّت **Java JDK 21** (مثل Eclipse Temurin) و **Android Studio** (مع Android SDK).
2. انقر مرتين على ملف **`build-apk.bat`** داخل مجلد `wateen_sport` (أو شغّله من موجه الأوامر):
   ```bat
   build-apk.bat
   ```
3. سينتج ملف `WateenSport-v1.0.0.apk` تلقائياً داخل مجلد `download-page/` جاهزاً للنقل أو النشر!

### إنشاء نسخة Google Play (`AAB`) مستقبلاً
افتح مجلد `android` داخل Android Studio واختر:
`Build -> Generate Signed Bundle / APK -> Android App Bundle (.aab)`

---

## 4. نشر صفحة التحميل المباشر (رابط للجمهور)
مجلد `download-page/index.html` مصمم كصفحة هبوط عربية أنيقة تحتوي على زر التحميل المباشر وخطوات التثبيت لأندرويد:
1. ضع ملف `WateenSport-v1.0.0.apk` داخل مجلد `download-page/` (أو عدّل رابط `href` في `download-page/index.html` ليشير إلى رابط GitHub Release المباشر).
2. ارفع مجلد `download-page` مجاناً عبر **Netlify Drop** (`https://app.netlify.com/drop`) أو **GitHub Pages** أو **Vercel**، وستحصل فوراً على رابط قصير وأنيق لإرساله للمستخدمين وتثبيت التطبيق مباشرة على هواتف أندرويد.
