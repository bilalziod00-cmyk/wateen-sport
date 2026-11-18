export interface OcrImageEnhancementOptions {
  grayscale?: boolean;
  contrastFactor?: number;
  sharpen?: boolean;
  maxDimension?: number;
  minWidthForUpscale?: number;
}

export interface OcrImageQualityReport {
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
  upscaled: boolean;
  averageLuminance: number; // 0..255
  contrastSpread: number; // 0..255 (p95 - p5)
  enhancedApplied: boolean;
  qualityGrade: 'high' | 'medium' | 'low';
  notesAr: string[];
}

export interface OcrPreprocessResult {
  enhancedDataUrl: string;
  originalDataUrl: string;
  report: OcrImageQualityReport;
}

function clampByte(v: number): number {
  if (v <= 0) return 0;
  if (v >= 255) return 255;
  return Math.round(v);
}

/**
 * معالجة بكسلات الصورة لرفع وضوح النصوص والأرقام في الجداول قبل OCR:
 * 1) تحويل إلى التدرج الرمادي المعياري (Rec.709 Grayscale)
 * 2) توسيع التباين التكيفي (Adaptive Contrast Stretch + Contrast Boost)
 * 3) زيادة حدة الحواف (3x3 Unsharp/Edge Sharpening) لإبراز الأرقام العربية والإنجليزية الصغيرة
 */
export function enhanceRgbaBufferForOcr(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: OcrImageEnhancementOptions = {}
): {
  processed: Uint8ClampedArray;
  averageLuminance: number;
  contrastSpread: number;
} {
  const { grayscale = true, contrastFactor = 1.42, sharpen = true } = options;
  const pixelCount = Math.max(1, width * height);
  const gray = new Float32Array(pixelCount);
  const histogram = new Uint32Array(256);

  let lumSum = 0;
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const r = rgba[idx] ?? 0;
    const g = rgba[idx + 1] ?? 0;
    const b = rgba[idx + 2] ?? 0;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    gray[i] = lum;
    lumSum += lum;
    histogram[clampByte(lum)] += 1;
  }

  const averageLuminance = Math.round(lumSum / pixelCount);

  // حساب النسبة المئوية الخامسة والـ 95 لتوسيع التباين دون التشوه بالضوضاء
  const lowTarget = Math.floor(pixelCount * 0.05);
  const highTarget = Math.ceil(pixelCount * 0.95);
  let cumulative = 0;
  let p5 = 0;
  let p95 = 255;
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v];
    if (cumulative >= lowTarget) {
      p5 = v;
      break;
    }
  }
  cumulative = 0;
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v];
    if (cumulative >= highTarget) {
      p95 = v;
      break;
    }
  }

  const rawSpread = Math.max(1, p95 - p5);
  const stretched = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    // توسيع التباين + تعزيز التباين حول المنتصف
    let val = rawSpread > 10 ? ((gray[i] - p5) * 255) / rawSpread : gray[i];
    val = (val - 128) * contrastFactor + 128;
    stretched[i] = clampByte(val);
  }

  // مرشح زيادة الحدة 3x3 (Sharpening Kernel) لإبراز حدود الأرقام والحروف
  const finalLum = new Float32Array(stretched);
  if (sharpen && width >= 3 && height >= 3) {
    const strength = 0.45;
    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const c = rowOffset + x;
        const center = stretched[c];
        const neighborsAvg =
          (stretched[c - 1] +
            stretched[c + 1] +
            stretched[c - width] +
            stretched[c + width]) *
          0.25;
        finalLum[c] = clampByte(center + (center - neighborsAvg) * (1 + strength));
      }
    }
  }

  // حساب التباين الفعلي بعد المعالجة
  const postHist = new Uint32Array(256);
  for (let i = 0; i < pixelCount; i++) {
    postHist[clampByte(finalLum[i])] += 1;
  }
  let postLow = 0;
  let postHigh = 255;
  cumulative = 0;
  for (let v = 0; v < 256; v++) {
    cumulative += postHist[v];
    if (cumulative >= lowTarget) {
      postLow = v;
      break;
    }
  }
  cumulative = 0;
  for (let v = 0; v < 256; v++) {
    cumulative += postHist[v];
    if (cumulative >= highTarget) {
      postHigh = v;
      break;
    }
  }
  const postSpread = Math.max(0, postHigh - postLow);

  const processed = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const a = rgba[idx + 3] ?? 255;
    if (grayscale) {
      const v = clampByte(finalLum[i]);
      processed[idx] = v;
      processed[idx + 1] = v;
      processed[idx + 2] = v;
      processed[idx + 3] = a;
    } else {
      const origLum = Math.max(1, gray[i]);
      const ratio = finalLum[i] / origLum;
      processed[idx] = clampByte((rgba[idx] ?? 0) * ratio);
      processed[idx + 1] = clampByte((rgba[idx + 1] ?? 0) * ratio);
      processed[idx + 2] = clampByte((rgba[idx + 2] ?? 0) * ratio);
      processed[idx + 3] = a;
    }
  }

  return {
    processed,
    averageLuminance,
    contrastSpread: postSpread,
  };
}

/**
 * تحسين صورة جدول أو لقطة شاشة عبر Canvas قبل إرسالها لمحرك OCR أو الذكاء الاصطناعي
 */
export async function preprocessImageDataUrlForOcr(
  dataUrl: string,
  options: OcrImageEnhancementOptions = {}
): Promise<OcrPreprocessResult> {
  const { maxDimension = 2200, minWidthForUpscale = 1100 } = options;

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return {
      enhancedDataUrl: dataUrl,
      originalDataUrl: dataUrl,
      report: {
        originalWidth: 0,
        originalHeight: 0,
        processedWidth: 0,
        processedHeight: 0,
        upscaled: false,
        averageLuminance: 128,
        contrastSpread: 128,
        enhancedApplied: false,
        qualityGrade: 'medium',
        notesAr: ['بيئة تشغيل بدون Canvas — تم تمرير الصورة الأصلية مباشرة'],
      },
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        let scale = 1;
        let upscaled = false;
        if (origW > 0 && origW < minWidthForUpscale) {
          scale = Math.min(2, minWidthForUpscale / origW);
          upscaled = true;
        }
        const maxSide = Math.max(origW * scale, origH * scale);
        if (maxSide > maxDimension) {
          scale = (scale * maxDimension) / maxSide;
        }

        const procW = Math.max(1, Math.round(origW * scale));
        const procH = Math.max(1, Math.round(origH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = procW;
        canvas.height = procH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            enhancedDataUrl: dataUrl,
            originalDataUrl: dataUrl,
            report: {
              originalWidth: origW,
              originalHeight: origH,
              processedWidth: origW,
              processedHeight: origH,
              upscaled: false,
              averageLuminance: 128,
              contrastSpread: 128,
              enhancedApplied: false,
              qualityGrade: 'medium',
              notesAr: ['تعذر تهيئة سياق الرسم 2D — تم استخدام الصورة الأصلية'],
            },
          });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, procW, procH);

        const imgData = ctx.getImageData(0, 0, procW, procH);
        const enhanced = enhanceRgbaBufferForOcr(imgData.data, procW, procH, options);
        const outImgData = new ImageData(
          new Uint8ClampedArray(enhanced.processed),
          procW,
          procH
        );
        ctx.putImageData(outImgData, 0, 0);

        const enhancedDataUrl = canvas.toDataURL('image/png');
        const notesAr: string[] = [];
        if (upscaled) {
          notesAr.push(`تم رفع دقة الصورة من ${origW}×${origH} إلى ${procW}×${procH} لإيضاح الأرقام`);
        }
        notesAr.push('تم تطبيق التدرج الرمادي وتعزيز التباين وحدّة الحواف قبل القراءة');

        let qualityGrade: 'high' | 'medium' | 'low' = 'high';
        if (origW < 420 || enhanced.contrastSpread < 45) {
          qualityGrade = 'low';
          notesAr.push('تنبيه: دقة أو تباين الصورة الأصلية منخفض — يُنصح بمراجعة الأرقام بدقة');
        } else if (origW < 800 || enhanced.contrastSpread < 90) {
          qualityGrade = 'medium';
        }

        resolve({
          enhancedDataUrl,
          originalDataUrl: dataUrl,
          report: {
            originalWidth: origW,
            originalHeight: origH,
            processedWidth: procW,
            processedHeight: procH,
            upscaled,
            averageLuminance: enhanced.averageLuminance,
            contrastSpread: enhanced.contrastSpread,
            enhancedApplied: true,
            qualityGrade,
            notesAr,
          },
        });
      } catch {
        resolve({
          enhancedDataUrl: dataUrl,
          originalDataUrl: dataUrl,
          report: {
            originalWidth: 0,
            originalHeight: 0,
            processedWidth: 0,
            processedHeight: 0,
            upscaled: false,
            averageLuminance: 128,
            contrastSpread: 128,
            enhancedApplied: false,
            qualityGrade: 'medium',
            notesAr: ['تعذرت المعالجة المسبقة — تم استخدام الصورة الأصلية بأمان'],
          },
        });
      }
    };
    img.onerror = () => {
      resolve({
        enhancedDataUrl: dataUrl,
        originalDataUrl: dataUrl,
        report: {
          originalWidth: 0,
          originalHeight: 0,
          processedWidth: 0,
          processedHeight: 0,
          upscaled: false,
          averageLuminance: 128,
          contrastSpread: 128,
          enhancedApplied: false,
          qualityGrade: 'low',
          notesAr: ['تعذر تحميل الصورة للتحسين المسبق'],
        },
      });
    };
    img.src = dataUrl;
  });
}
