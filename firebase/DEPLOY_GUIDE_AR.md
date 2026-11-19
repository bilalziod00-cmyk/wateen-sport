# دليل نشر الخادم الخلفي وقواعد الأمان لمنصة وتين سبورت (`wateen-sport-app`)

تم تجهيز ملفات الربط الكاملة في جذر المشروع:
- `firebase.json` (يربط `firestore.rules` و`firestore.indexes.json` و`storage.rules` و`firebase/functions`)
- `.firebaserc` (موجّه افتراضياً إلى المشروع `wateen-sport-app`)

---

## تنبيه مالي قبل النشر (الباقة المطلوبة)
- **على باقة `Spark` المجانية:** يمكنك نشر قواعد الأمان (`firestore` و`storage`) فوراً دون أي تكلفة.
- **على باقة `Blaze` (الدفع حسب الاستهلاك):** مطلوبة لتشغيل **Cloud Functions** والمجدول التلقائي `runScheduledWateenAutomation` (تتضمن حصة مجانية شهرية عالية، وتكلفة التشغيل الاقتصادي في نطاق `$0–$5` شهرياً بالإضافة لتكلفة مفتاح AI المحمية بسقف ميزانية في لوحة التحكم).

---

## الخطوة 1: تثبيت أداة Firebase CLI وتسجيل الدخول
```powershell
npm install -g firebase-tools
firebase login
```

---

## الخطوة 2: إعداد مفاتيح الذكاء الاصطناعي على الخادم فقط
1. انسخ الملف `firebase/functions/.env.example` إلى `firebase/functions/.env`.
2. ضع مفتاحك الحقيقي حسب المزوّد المختار في لوحة التحكم (OpenAI أو Gemini):
   ```env
   OPENAI_API_KEY=sk-...
   GEMINI_API_KEY=AIza...
   ```
   *(ملاحظة أمنية: ملف `firebase/functions/.env` مستثنى في `.gitignore` ولن يُرفع إلى Git أو يُدمج داخل APK أبداً).*

---

## الخطوة 3: تثبيت مكتبات الدوال السحابية
```powershell
Set-Location firebase/functions
npm install
Set-Location ../..
```

---

## الخطوة 4: نشر القواعد والدوال السحابية
- **لنشر القواعد فقط (مجاني على Spark):**
  ```powershell
  firebase deploy --only firestore,storage
  ```
- **لنشر المنظومة الكاملة (القواعد + Cloud Functions + المجدول كل 30 دقيقة):**
  ```powershell
  firebase deploy --only firestore,storage,functions
  ```

---

## الخطوة 5: منح أول حساب مدير صلاحية التحكم (`admin: true`)
لأن قواعد [firestore.rules](firestore.rules) تقصر الكتابة على المستخدمين الذين يحملون `admin: true`:
1. أنشئ حساب المدير في **Firebase Authentication** بالبريد وكلمة المرور.
2. نفّذ الأمر التالي بعد ربط بيانات اعتماد الخدمة `GOOGLE_APPLICATION_CREDENTIALS`:
   ```powershell
   node firebase/functions/scripts/grant-admin.js admin@example.com
   ```
3. سجّل الخروج ثم أعد تسجيل الدخول من شاشة **السحابة والأمان** داخل التطبيق.

---

## البديل السحابي: النشر عبر GitHub Actions
يوجد مسار يدوي جاهز في `.github/workflows/deploy-firebase.yml` باسم **Deploy Wateen Firebase Backend** يمكنك تشغيله من تبويب **Actions** في GitHub بعد إضافة `FIREBASE_SERVICE_ACCOUNT_WATEEN_SPORT` ومفاتيح `OPENAI_API_KEY` / `GEMINI_API_KEY` في **Repository Secrets**.
