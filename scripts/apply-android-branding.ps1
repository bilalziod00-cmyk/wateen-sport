# توليد الهوية البصرية الكاملة لتطبيق وتين سبورت (WATEEN SPORT) - الأيقونة التكيفية وشاشة الافتتاح
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$workspaceRoot = Resolve-Path (Join-Path $root "..")
$resDir = Join-Path $root "android\app\src\main\res"

# مسارات الصور الأصلية المرفقة من المستخدم
$uploadedLogoPath = "C:\Users\BILAL\.gemini\antigravity\brain\c1e72ca4-715d-46fd-8307-d97144c768b0\.user_uploaded\media_1794980067180_209f7e36.jpg"
$uploadedSplashPath = "C:\Users\BILAL\.gemini\antigravity\brain\c1e72ca4-715d-46fd-8307-d97144c768b0\.user_uploaded\media_1794980066892_29f799ef.jpg"

# إنشاء مجلدات assets/branding في المشروع والمجلد الرئيسي
$brandingDirs = @(
  (Join-Path $root "assets\branding"),
  (Join-Path $root "public\branding"),
  (Join-Path $workspaceRoot "assets\branding")
)
foreach ($bDir in $brandingDirs) {
  if (!(Test-Path $bDir)) {
    New-Item -ItemType Directory -Force -Path $bDir | Out-Null
  }
}

$logoImg = [System.Drawing.Image]::FromFile($uploadedLogoPath)
$splashImg = [System.Drawing.Image]::FromFile($uploadedSplashPath)

# دالة حفظ أيقونة مربعة بخلفية سوداء نقية (#000000) مع تحجيم نسبة الشعار
function Save-IconWithBlackBg([System.Drawing.Image]$src, [int]$canvasSize, [double]$scaleRatio, [string]$dest, [bool]$roundClip = $false) {
  $dir = Split-Path $dest -Parent
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

  $bmp = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  if ($roundClip) {
    $g.Clear([System.Drawing.Color]::Transparent)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $canvasSize, $canvasSize)
    $g.SetClip($path)
    $g.Clear([System.Drawing.Color]::Black)
  } else {
    $g.Clear([System.Drawing.Color]::Black)
  }

  $drawSize = [int]([Math]::Round($canvasSize * $scaleRatio))
  $offset = [int]([Math]::Round(($canvasSize - $drawSize) / 2.0))
  $g.DrawImage($src, $offset, $offset, $drawSize, $drawSize)

  $g.Dispose()
  $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# دالة تجهيز شاشة الافتتاح السينمائية بجميع المقاسات مع الحفاظ على كامل التصميم دون قص الأطراف
function Save-FullSplashScreen([System.Drawing.Image]$srcSplash, [int]$w, [int]$h, [string]$dest) {
  $dir = Split-Path $dest -Parent
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  # خلفية ليلية سوداء وملعب داكن متدرج بدون تكرار للشعار أو النصوص
  $g.Clear([System.Drawing.Color]::Black)
  $fullRect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $bgGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $fullRect,
    [System.Drawing.Color]::FromArgb(255, 1, 10, 18),
    [System.Drawing.Color]::FromArgb(255, 0, 5, 2),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
  )
  $g.FillRectangle($bgGrad, $fullRect)
  $bgGrad.Dispose()

  # رسم تصميم شاشة الافتتاح الكامل في المنتصف بحيث يظهر الشعار والإضاءة والعلم والعنوان كاملاً
  if ($h -ge $w) {
    # وضع عمودي (Portrait): ملء العرض بالكامل
    $mainSize = $w
    $mainX = 0
    $mainY = [int](($h - $mainSize) / 2)
    $g.DrawImage($srcSplash, $mainX, $mainY, $mainSize, $mainSize)

    # تدرج ناعم أعلى وأسفل الصورة لدمج الحواف مع الخلفية الليلية
    $fadeH = [int]([Math]::Max(24, $mainSize * 0.08))
    if ($mainY -gt 0) {
      $topY = [int]($mainY - 2)
      $topRect = New-Object System.Drawing.Rectangle(0, $topY, $w, $fadeH)
      $topGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $topRect,
        [System.Drawing.Color]::FromArgb(230, 0, 3, 2),
        [System.Drawing.Color]::FromArgb(0, 0, 3, 2),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
      )
      $g.FillRectangle($topGrad, $topRect)
      $topGrad.Dispose()

      $botY = [int]($mainY + $mainSize - $fadeH + 2)
      $botRect = New-Object System.Drawing.Rectangle(0, $botY, $w, $fadeH)
      $botGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $botRect,
        [System.Drawing.Color]::FromArgb(0, 0, 3, 2),
        [System.Drawing.Color]::FromArgb(230, 0, 3, 2),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
      )
      $g.FillRectangle($botGrad, $botRect)
      $botGrad.Dispose()
    }
  } else {
    # وضع أفقي (Landscape): ملء الارتفاع بالكامل
    $mainSize = $h
    $mainX = [int](($w - $mainSize) / 2)
    $mainY = 0
    $g.DrawImage($srcSplash, $mainX, $mainY, $mainSize, $mainSize)
  }

  $g.Dispose()
  $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# 1) حفظ الملفات القياسية في assets/branding/
foreach ($bDir in $brandingDirs) {
  Save-IconWithBlackBg $logoImg 1024 0.96 (Join-Path $bDir "app_icon.png") $false
  Save-IconWithBlackBg $logoImg 1024 0.96 (Join-Path $bDir "splash_logo.png") $true
  Save-FullSplashScreen $splashImg 1080 1920 (Join-Path $bDir "splash_background.png")
}

# حفظ نسخة مربعة أصلية عالية الدقة لاستخدامها في شاشة الافتتاح التفاعلية داخل التطبيق
Save-IconWithBlackBg $splashImg 1024 1.0 (Join-Path $root "public\branding\splash_artwork.png") $false

# 2) تحديث الأيقونات العامة في المشروع (Header + PWA + Download Page + Capacitor Assets)
Save-IconWithBlackBg $logoImg 512 0.96 (Join-Path $root "public\images\app-icon.png") $false
Save-IconWithBlackBg $logoImg 512 0.96 (Join-Path $root "download-page\app-icon.png") $false
Save-IconWithBlackBg $logoImg 1024 0.96 (Join-Path $root "assets\icon-only.png") $false
Save-IconWithBlackBg $logoImg 1024 0.67 (Join-Path $root "assets\icon-foreground.png") $false
Save-FullSplashScreen $splashImg 1080 1920 (Join-Path $root "assets\splash.png")
Save-FullSplashScreen $splashImg 1080 1920 (Join-Path $root "assets\splash-dark.png")

# 3) توليد أيقونات Android Launcher لجميع الكثافات مع دعم Android Adaptive Icon Safe-Zone (67%)
$densities = @{
  "mipmap-mdpi"    = @{ legacy = 48;  adaptive = 108 }
  "mipmap-hdpi"    = @{ legacy = 72;  adaptive = 162 }
  "mipmap-xhdpi"   = @{ legacy = 96;  adaptive = 216 }
  "mipmap-xxhdpi"  = @{ legacy = 144; adaptive = 324 }
  "mipmap-xxxhdpi" = @{ legacy = 192; adaptive = 432 }
}

foreach ($d in $densities.Keys) {
  $legacyPx = $densities[$d].legacy
  $adaptivePx = $densities[$d].adaptive
  $folder = Join-Path $resDir $d

  # أيقونة التطبيق الكلاسيكية (خلفية سوداء، دائرة خضراء واضحة بنسبة 94%)
  Save-IconWithBlackBg $logoImg $legacyPx 0.94 (Join-Path $folder "ic_launcher.png") $false
  # أيقونة التطبيق الدائرية
  Save-IconWithBlackBg $logoImg $legacyPx 0.96 (Join-Path $folder "ic_launcher_round.png") $true
  # طبقة المقدمة للأيقونة التكيفية (Adaptive Icon Foreground - Safe Zone 67% حتى لا يقص النظام الدائرة الخضراء)
  Save-IconWithBlackBg $logoImg $adaptivePx 0.67 (Join-Path $folder "ic_launcher_foreground.png") $false
}

# 4) توليد شاشات الافتتاح الأصلية لنظام أندرويد بجميع المقاسات
$splashes = @(
  @{ path = "drawable\splash.png"; w = 1080; h = 1920 },
  @{ path = "drawable-port-mdpi\splash.png"; w = 320; h = 480 },
  @{ path = "drawable-port-hdpi\splash.png"; w = 480; h = 800 },
  @{ path = "drawable-port-xhdpi\splash.png"; w = 720; h = 1280 },
  @{ path = "drawable-port-xxhdpi\splash.png"; w = 960; h = 1600 },
  @{ path = "drawable-port-xxxhdpi\splash.png"; w = 1080; h = 1920 },
  @{ path = "drawable-land-mdpi\splash.png"; w = 480; h = 320 },
  @{ path = "drawable-land-hdpi\splash.png"; w = 800; h = 480 },
  @{ path = "drawable-land-xhdpi\splash.png"; w = 1280; h = 720 },
  @{ path = "drawable-land-xxhdpi\splash.png"; w = 1600; h = 960 },
  @{ path = "drawable-land-xxxhdpi\splash.png"; w = 1920; h = 1080 }
)

foreach ($sp in $splashes) {
  Save-FullSplashScreen $splashImg $sp.w $sp.h (Join-Path $resDir $sp.path)
}

$logoImg.Dispose()
$splashImg.Dispose()

# 5) ضبط خلفية الأيقونة التكيفية باللون الأسود النقي #000000
$bgColorXml = Join-Path $resDir "values\ic_launcher_background.xml"
@"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#000000</color>
</resources>
"@ | Set-Content -Path $bgColorXml -Encoding UTF8

$bgDrawableXml = Join-Path $resDir "drawable\ic_launcher_background.xml"
if (Test-Path $bgDrawableXml) {
@"
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#000000"
        android:pathData="M0,0h108v108h-108z" />
</vector>
"@ | Set-Content -Path $bgDrawableXml -Encoding UTF8
}

# 6) ضبط ملفات Adaptive Icon XML في mipmap-anydpi-v26
$adaptiveXml = @"
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"@
$adaptiveXml | Set-Content -Path (Join-Path $resDir "mipmap-anydpi-v26\ic_launcher.xml") -Encoding UTF8
$adaptiveXml | Set-Content -Path (Join-Path $resDir "mipmap-anydpi-v26\ic_launcher_round.xml") -Encoding UTF8

# 7) تحديث styles.xml لدعم شاشة افتتاح أندرويد 12+ وأندرويد الكلاسيكي بسلاسة وخلفية سوداء
$stylesXml = Join-Path $resDir "values\styles.xml"
@"
<?xml version="1.0" encoding="utf-8"?>
<resources>

    <!-- Base application theme. -->
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="colorPrimary">#000000</item>
        <item name="colorPrimaryDark">#000000</item>
        <item name="colorAccent">#00E640</item>
        <item name="android:windowBackground">#000000</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:windowBackground">#000000</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="android:windowBackground">@drawable/splash</item>
        <item name="windowSplashScreenBackground">#000000</item>
        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
"@ | Set-Content -Path $stylesXml -Encoding UTF8

# 8) تحديث اسم التطبيق في strings.xml
$stringsXml = Join-Path $resDir "values\strings.xml"
@"
<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">وتين سبورت</string>
    <string name="title_activity_main">وتين سبورت</string>
    <string name="package_name">com.wateensport.app</string>
    <string name="custom_url_scheme">com.wateensport.app</string>
</resources>
"@ | Set-Content -Path $stringsXml -Encoding UTF8

Write-Host "تم تجهيز assets/branding وتوليد جميع أيقونات أندرويد التكيفية وشاشات الافتتاح بنجاح!" -ForegroundColor Green
