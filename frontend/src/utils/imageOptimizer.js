/**
 * imageOptimizer.js
 * High-performance client-side image compression & format normalization.
 * Automatically resizes large camera photos (e.g. 5MB-15MB) to crisp ~40-90KB images
 * using HTML5 Canvas, eliminating false "file size too large" errors and network lag.
 */

export const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const optimizeImage = async (file, options = {}) => {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.82,
    maxOutputSizeKB = 300
  } = options;

  if (!file) {
    throw new Error('No image file provided');
  }

  const originalSize = file.size || 0;
  const isSvg = file.type === 'image/svg+xml' || (file.name && file.name.endsWith('.svg'));

  // SVGs are vector graphics; read directly without raster canvas conversion
  if (isSvg) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          dataUrl: reader.result,
          originalSize,
          optimizedSize: originalSize,
          originalSizeText: formatFileSize(originalSize),
          optimizedSizeText: formatFileSize(originalSize),
          width: 800,
          height: 800,
          format: 'svg'
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Handle standard raster images (JPEG, PNG, WebP, etc.)
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Calculate constrained dimensions preserving aspect ratio
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context could not be initialized'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const isPng = file.type === 'image/png';
      // Fill transparent canvas with white background if converting to JPEG
      if (!isPng) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Determine output format: JPEG is optimal for photo compression
      const outputFormat = isPng ? 'image/png' : 'image/jpeg';
      let dataUrl = canvas.toDataURL(outputFormat, quality);

      // If PNG is still huge (> 300KB), convert to JPEG to ensure fast sync & 0 latency
      const approxBytes = Math.round((dataUrl.length * 3) / 4);
      if (isPng && approxBytes > maxOutputSizeKB * 1024) {
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = width;
        fallbackCanvas.height = height;
        const fbCtx = fallbackCanvas.getContext('2d');
        fbCtx.fillStyle = '#FFFFFF';
        fbCtx.fillRect(0, 0, width, height);
        fbCtx.drawImage(img, 0, 0, width, height);
        dataUrl = fallbackCanvas.toDataURL('image/jpeg', quality);
      }

      const optimizedSize = Math.round((dataUrl.length * 3) / 4);

      resolve({
        dataUrl,
        originalSize,
        optimizedSize,
        originalSizeText: formatFileSize(originalSize),
        optimizedSizeText: formatFileSize(optimizedSize),
        width,
        height,
        format: dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg'
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image. The file may be corrupt or an unsupported format.'));
    };

    img.src = objectUrl;
  });
};
