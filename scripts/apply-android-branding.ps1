# توليد أيقونات أندرويد وشاشة البداية وتكوين اللغة العربية RTL لتطبيق وتين سبورت
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$resDir = Join-Path $root "android\app\src\main\res"
$iconSrc = Join-Path $root "public\images\app-icon.png"

if (!(Test-Path $resDir)) {
  Write-Error "مجلد android غير موجود بعد. شغّل npx cap add android أولاً."
  exit 1
}

function Save-ResizedPng([System.Drawing.Image]$src, [int]$w, [int]$h, [string]$dest) {
  $dir = Split-Path $dest -Parent
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.DrawImage($src, 0, 0, $w, $h)
  $g.Dispose()
  $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Save-SplashPng([System.Drawing.Image]$src, [int]$w, [int]$h, [string]$dest) {
  $dir = Split-Path $dest -Parent
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml("#070B10"))
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $logoSize = [int]([Math]::Min($w, $h) * 0.42)
  $x = [int](($w - $logoSize) / 2)
  $y = [int](($h - $logoSize) / 2)
  $g.DrawImage($src, $x, $y, $logoSize, $logoSize)
  $g.Dispose()
  $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$img = [System.Drawing.Image]::FromFile($iconSrc)

# 1) أيقونات Launcher لجميع الكثافات
$densities = @{
  "mipmap-mdpi"    = 48
  "mipmap-hdpi"    = 72
  "mipmap-xhdpi"   = 96
  "mipmap-xxhdpi"  = 144
  "mipmap-xxxhdpi" = 192
}

foreach ($d in $densities.Keys) {
  $px = $densities[$d]
  $folder = Join-Path $resDir $d
  Save-ResizedPng $img $px $px (Join-Path $folder "ic_launcher.png")
  Save-ResizedPng $img $px $px (Join-Path $folder "ic_launcher_round.png")
  Save-ResizedPng $img ([int]($px * 1.5)) ([int]($px * 1.5)) (Join-Path $folder "ic_launcher_foreground.png")
}

# 2) شاشة البداية (Splash Screen) بجميع المقاسات
$splashes = @(
  @{ path = "drawable\splash.png"; w = 1080; h = 1920 },
  @{ path = "drawable-port-mdpi\splash.png"; w = 320; h = 480 },
  @{ path = "drawable-port-hdpi\splash.png"; w = 480; h = 800 },
  @{ path = "drawable-port-xhdpi\splash.png"; w = 720; h = 1280 },
  @{ path = "drawable-port-xxhdpi\splash.png"; w = 960; h = 1600 },
  @{ path = "drawable-port-xxxhdpi\splash.png"; w = 1280; h = 1920 },
  @{ path = "drawable-land-mdpi\splash.png"; w = 480; h = 320 },
  @{ path = "drawable-land-hdpi\splash.png"; w = 800; h = 480 },
  @{ path = "drawable-land-xhdpi\splash.png"; w = 1280; h = 720 },
  @{ path = "drawable-land-xxhdpi\splash.png"; w = 1600; h = 960 },
  @{ path = "drawable-land-xxxhdpi\splash.png"; w = 1920; h = 1280 }
)

foreach ($sp in $splashes) {
  Save-SplashPng $img $sp.w $sp.h (Join-Path $resDir $sp.path)
}

$img.Dispose()

# 3) لون خلفية الأيقونة التكيفية
$bgColorXml = Join-Path $resDir "values\ic_launcher_background.xml"
@"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#070B10</color>
</resources>
"@ | Set-Content -Path $bgColorXml -Encoding UTF8

# 4) اسم التطبيق العربي في strings.xml
$stringsXml = Join-Path $resDir "values\strings.xml"
if (Test-Path $stringsXml) {
  @"
<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">وتين سبورت</string>
    <string name="title_activity_main">وتين سبورت</string>
    <string name="package_name">com.wateensport.app</string>
    <string name="custom_url_scheme">com.wateensport.app</string>
</resources>
"@ | Set-Content -Path $stringsXml -Encoding UTF8
}

# 5) تفعيل صلاحية الإشعارات POST_NOTIFICATIONS و RTL في AndroidManifest.xml
$manifestPath = Join-Path $root "android\app\src\main\AndroidManifest.xml"
if (Test-Path $manifestPath) {
  $manifest = Get-Content $manifestPath -Raw -Encoding UTF8
  if ($manifest -notmatch "POST_NOTIFICATIONS") {
    $manifest = $manifest -replace '(<uses-permission android:name="android.permission.INTERNET" />)', "`$1`n    <uses-permission android:name=`"android.permission.POST_NOTIFICATIONS`" />"
  }
  if ($manifest -notmatch "android:supportsRtl") {
    $manifest = $manifest -replace '<application', '<application android:supportsRtl="true"'
  }
  $manifest | Set-Content -Path $manifestPath -Encoding UTF8
}

Write-Host "تم تطبيق هوية وتين سبورت (الأيقونة + شاشة البداية + الاسم العربي + RTL + صلاحية الإشعارات) بنجاح!" -ForegroundColor Green
