const imageProcessor = {
  async processImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate dimensions while maintaining aspect ratio
        const maxWidth = 800;
        const maxHeight = 600;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        // Set canvas size
        canvas.width = width;
        canvas.height = height;

        // Draw image to canvas with proper scaling
        ctx.drawImage(img, 0, 0, width, height);

        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, width, height);

        // Clean up
        URL.revokeObjectURL(url);

        resolve(imageData);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  },

  async analyzeImage(imageData) {
    const violations = [];

    try {
      // Convert image to grayscale for better analysis
      const grayscaleData = convertToGrayscale(imageData);

      // Apply Gaussian blur to reduce noise
      const blurredData = applyGaussianBlur(grayscaleData);

      // Detect edges to find walls
      const edges = window.imageAnalysis.detectEdges(blurredData);

      // Find lines using Hough transform
      const lines = window.imageAnalysis.detectLines(edges);

      // Group lines into walls
      const walls = window.imageAnalysis.detectWalls(lines);

      // Detect text regions and recognize measurements
      const textRegions = await window.imageAnalysis.detectTextRegions(
        grayscaleData
      );
      const measurements = await window.measurements.recognizeMeasurements(
        textRegions
      );

      // Analyze room geometry
      const rooms = window.imageAnalysis.analyzeRoomGeometry(walls);

      // Calculate dimensions
      const dimensions = window.measurements.calculateDimensions(
        rooms,
        measurements
      );

      // Check measurements against norms
      violations.push(...window.normChecker.checkNormViolations(dimensions));

      // Highlight violations on the preview
      highlightViolations(violations, walls);
    } catch (error) {
      console.error('Error analyzing image:', error);
      throw error;
    }

    return violations;
  },

  highlightViolations(violations, walls) {
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');

    // Сохраняем текущее состояние canvas
    ctx.save();

    // Настраиваем стиль для отображения нарушений
    ctx.strokeStyle = '#F44336';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);

    violations.forEach((violation) => {
      // Находим соответствующую стену или область
      const relatedWall = findRelatedWall(violation, walls);
      if (relatedWall) {
        // Рисуем выделение
        ctx.beginPath();
        ctx.moveTo(relatedWall.start.x, relatedWall.start.y);
        ctx.lineTo(relatedWall.end.x, relatedWall.end.y);
        ctx.stroke();

        // Добавляем текст с описанием нарушения
        ctx.font = '14px Arial';
        ctx.fillStyle = '#F44336';
        ctx.fillText(
          `${violation.title}: ${violation.actual} (норма: ${violation.norm})`,
          relatedWall.start.x,
          relatedWall.start.y - 10
        );
      }
    });

    // Восстанавливаем состояние canvas
    ctx.restore();
  },

  findRelatedWall(violation, walls) {
    // Находим стену, связанную с нарушением
    // Это заглушка, реальная реализация будет зависеть от типа нарушения
    return walls.find((wall) => {
      // Здесь должна быть логика поиска соответствующей стены
      return true;
    });
  },
};

// Экспортируем модуль
window.imageProcessor = imageProcessor;

function convertToGrayscale(imageData) {
  const data = new Uint8ClampedArray(imageData.data);
  for (let i = 0; i < data.length; i += 4) {
    // Using luminance weights for better grayscale conversion
    const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = avg; // R
    data[i + 1] = avg; // G
    data[i + 2] = avg; // B
  }
  return new ImageData(data, imageData.width, imageData.height);
}

function applyGaussianBlur(imageData, sigma = 1) {
  const kernel = createGaussianKernel(sigma);
  return applyConvolution(imageData, kernel);
}

function createGaussianKernel(sigma) {
  const size = Math.ceil(sigma * 6);
  const kernel = new Array(size);
  const center = Math.floor(size / 2);
  let sum = 0;

  for (let y = 0; y < size; y++) {
    kernel[y] = new Array(size);
    for (let x = 0; x < size; x++) {
      const value = Math.exp(
        -(
          (Math.pow(x - center, 2) + Math.pow(y - center, 2)) /
          (2 * Math.pow(sigma, 2))
        )
      );
      kernel[y][x] = value;
      sum += value;
    }
  }

  // Normalize kernel
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      kernel[y][x] /= sum;
    }
  }

  return kernel;
}

function applyConvolution(imageData, kernel) {
  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8ClampedArray(imageData.data);
  const result = new Uint8ClampedArray(data);
  const kSize = kernel.length;
  const kCenter = Math.floor(kSize / 2);

  for (let y = kCenter; y < height - kCenter; y++) {
    for (let x = kCenter; x < width - kCenter; x++) {
      let sum = 0;

      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const px = x + kx - kCenter;
          const py = y + ky - kCenter;
          const idx = (py * width + px) * 4;
          sum += data[idx] * kernel[ky][kx];
        }
      }

      const idx = (y * width + x) * 4;
      result[idx] = sum;
      result[idx + 1] = sum;
      result[idx + 2] = sum;
      result[idx + 3] = 255;
    }
  }

  return new ImageData(result, width, height);
}
