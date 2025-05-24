// Модуль анализа изображений

const imageAnalysis = {
  // Анализ изображения и поиск нарушений
  async analyzeImage(imageData) {
    const results = {
      walls: [],
      rooms: [],
      measurements: [],
      violations: [],
    };

    try {
      // 1. Анализируем геометрию с помощью TensorFlow
      console.log('Starting TensorFlow analysis...');
      const geometryResults = await window.geometryAnalysis.analyzeGeometry(
        imageData
      );
      results.walls = geometryResults.walls;
      results.rooms = geometryResults.rooms;

      // 2. Распознаем текст и размеры с помощью Tesseract
      console.log('Starting Tesseract analysis...');
      const textResults = await this.recognizeMeasurements(imageData);
      results.measurements = textResults.measurements;

      // 3. Сопоставляем распознанный текст с геометрией
      console.log('Matching text with geometry...');
      this.matchTextWithGeometry(results);

      // 4. Проверяем нормы для каждой комнаты
      console.log('Checking building norms...');
      results.rooms.forEach((room) => {
        if (!room.type) {
          console.log('Room without type, skipping norm check:', room);
          return;
        }

        console.log('Checking room:', room);

        // Проверяем размеры комнаты
        const widthCheck = window.normChecker.checkMeasurement(
          room.width,
          room.type,
          'width',
          {
            x: room.bounds.x,
            y: room.bounds.y,
            width: room.bounds.width,
            height: 10,
          }
        );

        const lengthCheck = window.normChecker.checkMeasurement(
          room.length,
          room.type,
          'length',
          {
            x: room.bounds.x,
            y: room.bounds.y,
            width: 10,
            height: room.bounds.height,
          }
        );

        const areaCheck = window.normChecker.checkArea(room.area, room.type, {
          points: room.points,
        });

        // Собираем нарушения
        if (!widthCheck.isValid) {
          console.log('Width violation found:', widthCheck.violation);
          results.violations.push(widthCheck.violation);
        }
        if (!lengthCheck.isValid) {
          console.log('Length violation found:', lengthCheck.violation);
          results.violations.push(lengthCheck.violation);
        }
        if (!areaCheck.isValid) {
          console.log('Area violation found:', areaCheck.violation);
          results.violations.push(areaCheck.violation);
        }
      });

      console.log('Analysis completed:', results);
    } catch (error) {
      console.error('Error in image analysis:', error);
      throw error;
    }

    return results;
  },

  // Сопоставление текста с геометрией
  matchTextWithGeometry(results) {
    console.log('Starting text-geometry matching...');

    // Для каждой найденной комнаты
    results.rooms.forEach((room) => {
      // Ищем ближайший текст с типом помещения
      const nearestRoomType = this.findNearestText(
        room.bounds,
        results.measurements,
        'roomType'
      );
      if (nearestRoomType) {
        room.type = nearestRoomType.type;
        room.confidence = nearestRoomType.confidence;
      }

      // Ищем ближайшие размеры
      const nearestMeasurements = this.findNearbyMeasurements(
        room.bounds,
        results.measurements
      );

      // Определяем размеры на основе ориентации размеров
      nearestMeasurements.forEach((measurement) => {
        const isHorizontal = this.isHorizontalMeasurement(measurement);
        if (isHorizontal) {
          room.width = measurement.value;
        } else {
          room.length = measurement.value;
        }
      });

      console.log('Matched room:', room);
    });
  },

  // Поиск ближайшего текста
  findNearestText(bounds, measurements, type) {
    const center = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };

    let nearest = null;
    let minDistance = Infinity;

    measurements.forEach((measurement) => {
      if (measurement.type !== type) return;

      const measurementCenter = {
        x: measurement.x + measurement.width / 2,
        y: measurement.y + measurement.height / 2,
      };

      const distance = Math.sqrt(
        Math.pow(center.x - measurementCenter.x, 2) +
          Math.pow(center.y - measurementCenter.y, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = measurement;
      }
    });

    return nearest;
  },

  // Поиск ближайших размеров
  findNearbyMeasurements(bounds, measurements) {
    const maxDistance = Math.max(bounds.width, bounds.height) / 2;
    return measurements.filter((measurement) => {
      const distance = this.getDistanceToBounds(measurement, bounds);
      return distance <= maxDistance;
    });
  },

  // Определение ориентации размера
  isHorizontalMeasurement(measurement) {
    return measurement.width > measurement.height;
  },

  // Расчет расстояния от точки до границ
  getDistanceToBounds(point, bounds) {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const pointCenterX = point.x + point.width / 2;
    const pointCenterY = point.y + point.height / 2;

    return Math.sqrt(
      Math.pow(centerX - pointCenterX, 2) + Math.pow(centerY - pointCenterY, 2)
    );
  },

  // Определение стен на изображении
  async detectWalls(imageData) {
    const edges = this.detectEdges(imageData);
    const lines = this.detectLines(edges);
    return this.processWalls(lines);
  },

  // Определение границ на изображении
  detectEdges(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const edges = new Uint8ClampedArray(width * height * 4);

    // Применяем оператор Собеля
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        // Вычисляем градиенты по X и Y
        const gx =
          -data[((y - 1) * width + (x - 1)) * 4] +
          data[((y - 1) * width + (x + 1)) * 4] +
          -2 * data[(y * width + (x - 1)) * 4] +
          2 * data[(y * width + (x + 1)) * 4] +
          -data[((y + 1) * width + (x - 1)) * 4] +
          data[((y + 1) * width + (x + 1)) * 4];

        const gy =
          -data[((y - 1) * width + (x - 1)) * 4] +
          -2 * data[((y - 1) * width + x) * 4] +
          -data[((y - 1) * width + (x + 1)) * 4] +
          data[((y + 1) * width + (x - 1)) * 4] +
          2 * data[((y + 1) * width + x) * 4] +
          data[((y + 1) * width + (x + 1)) * 4];

        const magnitude = Math.sqrt(gx * gx + gy * gy);

        edges[idx] = magnitude > 128 ? 255 : 0;
        edges[idx + 1] = edges[idx];
        edges[idx + 2] = edges[idx];
        edges[idx + 3] = 255;
      }
    }

    return new ImageData(edges, width, height);
  },

  // Определение линий методом Хафа
  detectLines(edgeData) {
    const width = edgeData.width;
    const height = edgeData.height;
    const data = edgeData.data;
    const lines = [];
    const threshold = 100; // Минимальное количество точек для линии

    // Создаем аккумулятор Хафа
    const rhoMax = Math.sqrt(width * width + height * height);
    const accum = new Array(Math.ceil(rhoMax))
      .fill(0)
      .map(() => new Array(180).fill(0));

    // Заполняем аккумулятор
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4] > 128) {
          for (let theta = 0; theta < 180; theta++) {
            const radian = (theta * Math.PI) / 180;
            const rho = x * Math.cos(radian) + y * Math.sin(radian);
            if (rho >= 0 && rho < rhoMax) {
              accum[Math.floor(rho)][theta]++;
            }
          }
        }
      }
    }

    // Находим максимумы в аккумуляторе
    for (let rho = 0; rho < rhoMax; rho++) {
      for (let theta = 0; theta < 180; theta++) {
        if (accum[rho][theta] > threshold) {
          const radian = (theta * Math.PI) / 180;
          const a = Math.cos(radian);
          const b = Math.sin(radian);
          const x0 = a * rho;
          const y0 = b * rho;

          // Вычисляем точки линии
          const x1 = Math.round(x0 + 1000 * -b);
          const y1 = Math.round(y0 + 1000 * a);
          const x2 = Math.round(x0 - 1000 * -b);
          const y2 = Math.round(y0 - 1000 * a);

          lines.push({ x1, y1, x2, y2 });
        }
      }
    }

    return lines;
  },

  // Обработка найденных линий и преобразование их в стены
  processWalls(lines) {
    const walls = [];
    const threshold = 20; // Порог для объединения близких линий

    // Объединяем близкие параллельные линии
    for (let i = 0; i < lines.length; i++) {
      let merged = false;
      const line1 = lines[i];

      for (let j = 0; j < walls.length; j++) {
        const line2 = walls[j];

        // Проверяем параллельность и близость линий
        if (
          this.areLinesParallel(line1, line2) &&
          this.areLinesClose(line1, line2, threshold)
        ) {
          // Объединяем линии
          walls[j] = this.mergeLines(line1, line2);
          merged = true;
          break;
        }
      }

      if (!merged) {
        walls.push(line1);
      }
    }

    // Добавляем длину к каждой стене
    return walls.map((wall) => ({
      ...wall,
      length: Math.sqrt(
        Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2)
      ),
    }));
  },

  // Определение комнат на основе стен
  detectRooms(walls) {
    // Здесь должен быть код определения комнат
    // Пока возвращаем тестовые данные
    return [
      {
        type: 'комната',
        width: 2000,
        length: 3000,
        area: 6,
        bounds: {
          x: 0,
          y: 0,
          width: 100,
          height: 80,
        },
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 80 },
          { x: 0, y: 80 },
        ],
      },
    ];
  },

  // Вспомогательные функции для обработки линий
  areLinesParallel(line1, line2) {
    const angle1 = Math.atan2(line1.y2 - line1.y1, line1.x2 - line1.x1);
    const angle2 = Math.atan2(line2.y2 - line2.y1, line2.x2 - line2.x1);
    return Math.abs(angle1 - angle2) < 0.1; // ~5 градусов
  },

  areLinesClose(line1, line2, threshold) {
    const dist1 = this.pointToLineDistance(line1.x1, line1.y1, line2);
    const dist2 = this.pointToLineDistance(line1.x2, line1.y2, line2);
    return dist1 < threshold && dist2 < threshold;
  },

  pointToLineDistance(x, y, line) {
    const numerator = Math.abs(
      (line.y2 - line.y1) * x -
        (line.x2 - line.x1) * y +
        line.x2 * line.y1 -
        line.y2 * line.x1
    );
    const denominator = Math.sqrt(
      Math.pow(line.y2 - line.y1, 2) + Math.pow(line.x2 - line.x1, 2)
    );
    return numerator / denominator;
  },

  mergeLines(line1, line2) {
    return {
      x1: Math.min(line1.x1, line2.x1),
      y1: Math.min(line1.y1, line2.y1),
      x2: Math.max(line1.x2, line2.x2),
      y2: Math.max(line1.y2, line2.y2),
    };
  },

  // Распознавание размеров на изображении
  async recognizeMeasurements(imageData) {
    try {
      console.log('Starting text recognition...');

      const worker = await Tesseract.createWorker();
      console.log('Worker created');

      // Создаем canvas для предобработки изображения
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      console.log('Canvas created:', canvas.width, 'x', canvas.height);

      // Применяем улучшенную предобработку для улучшения распознавания
      const processedImageData = this.preprocessForOCR(imageData);
      ctx.putImageData(processedImageData, 0, 0);
      console.log('Enhanced image preprocessing completed');

      // Получаем URL изображения для Tesseract
      const imageUrl = canvas.toDataURL('image/png');
      console.log('Image converted to URL');

      // Настраиваем Tesseract для лучшего распознавания
      await worker.loadLanguage('rus+eng');
      await worker.initialize('rus+eng');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789.,xXхХ мМmMсС', // Разрешенные символы
        tessedit_pageseg_mode: '1', // Автоматическая сегментация
        tessedit_ocr_engine_mode: '2', // Нейронная сеть LSTM
      });

      // Распознаем текст с получением координат
      console.log('Starting enhanced Tesseract recognition...');
      const { data } = await worker.recognize(imageUrl);
      console.log('Recognition completed. Raw result:', data);

      await worker.terminate();
      console.log('Worker terminated');

      // Обрабатываем результаты распознавания
      const measurements = [];
      const roomTypes = [];

      // Собираем контекст для каждого слова
      const words = data.words || [];
      const wordContexts = words.map((word, index) => {
        const nearbyWords = words
          .filter((w, i) => {
            if (i === index) return false;
            const distance = Math.sqrt(
              Math.pow(w.bbox.x0 - word.bbox.x0, 2) +
                Math.pow(w.bbox.y0 - word.bbox.y0, 2)
            );
            return distance < 100; // Ищем слова в радиусе 100 пикселей
          })
          .map((w) => w.text)
          .join(' ');

        return {
          word,
          nearbyText: nearbyWords,
        };
      });

      // Обрабатываем каждое слово с учетом контекста
      if (words.length > 0) {
        console.log('Processing', words.length, 'words with context');
        wordContexts.forEach(({ word, nearbyText }) => {
          const normalizedText = this.normalizeText(word.text, { nearbyText });
          console.log(
            'Processing word:',
            word.text,
            '(normalized:',
            normalizedText,
            'context:',
            nearbyText,
            ')'
          );

          // Проверяем на размеры
          const measurement = this.parseMeasurement(word.text);
          if (measurement) {
            console.log('Found measurement:', measurement);
            measurements.push({
              ...measurement,
              x: word.bbox.x0,
              y: word.bbox.y0,
              width: word.bbox.x1 - word.bbox.x0,
              height: word.bbox.y1 - word.bbox.y0,
              confidence: word.confidence,
            });
          }

          // Проверяем на типы помещений
          const validRoomTypes = [
            'кухня',
            'комната',
            'санузел',
            'ванная',
            'туалет',
            'коридор',
            'прихожая',
            'жилая комната',
          ];

          if (validRoomTypes.includes(normalizedText)) {
            console.log('Found room type:', normalizedText);
            roomTypes.push({
              type: normalizedText,
              x: word.bbox.x0,
              y: word.bbox.y0,
              width: word.bbox.x1 - word.bbox.x0,
              height: word.bbox.y1 - word.bbox.y0,
              confidence: word.confidence,
            });
          }
        });
      } else {
        console.log('No words found in recognition result');
      }

      console.log('Enhanced recognition results:', {
        measurements: measurements.length,
        roomTypes: roomTypes.length,
        measurements_details: measurements,
        roomTypes_details: roomTypes,
      });

      return {
        measurements,
        roomTypes,
      };
    } catch (error) {
      console.error('Error in text recognition:', error);
      throw error;
    }
  },

  // Предобработка изображения для улучшения распознавания текста
  preprocessForOCR(imageData) {
    // Создаем копию изображения
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;

    // 1. Преобразуем в оттенки серого с учетом особенностей восприятия
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Используем формулу для лучшего восприятия контраста
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      data[i] = gray; // R
      data[i + 1] = gray; // G
      data[i + 2] = gray; // B
    }

    // 2. Применяем размытие по Гауссу для уменьшения шума
    const blurred = this.gaussianBlur(data, width, height);

    // 3. Применяем адаптивное пороговое значение
    const threshold = this.adaptiveThreshold(blurred, width, height);

    // 4. Увеличиваем контраст
    for (let i = 0; i < data.length; i += 4) {
      const value = threshold[i / 4] ? 255 : 0;
      data[i] = value; // R
      data[i + 1] = value; // G
      data[i + 2] = value; // B
      data[i + 3] = 255; // A
    }

    return new ImageData(data, width, height);
  },

  // Размытие по Гауссу
  gaussianBlur(data, width, height) {
    const kernel = [
      [1, 2, 1],
      [2, 4, 2],
      [1, 2, 1],
    ];
    const kernelSum = 16;
    const result = new Uint8Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            sum += data[idx] * kernel[ky + 1][kx + 1];
          }
        }
        result[y * width + x] = sum / kernelSum;
      }
    }
    return result;
  },

  // Адаптивное пороговое значение
  adaptiveThreshold(data, width, height) {
    const result = new Uint8Array(width * height);
    const blockSize = 11; // Размер блока для адаптации
    const c = 2; // Константа для корректировки порога

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;

        // Вычисляем среднее значение в окне
        for (let wy = -blockSize; wy <= blockSize; wy++) {
          for (let wx = -blockSize; wx <= blockSize; wx++) {
            const ny = y + wy;
            const nx = x + wx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              sum += data[ny * width + nx];
              count++;
            }
          }
        }

        const threshold = sum / count - c;
        const idx = y * width + x;
        result[idx] = data[idx] > threshold ? 1 : 0;
      }
    }
    return result;
  },

  // Нормализация текста с учетом контекста
  normalizeText(text, context = {}) {
    // Базовые замены для известных ошибок
    const replacements = {
      KyxHa: 'кухня',
      Kyxня: 'кухня',
      Kopuoop: 'коридор',
      Room: 'комната',
      room: 'комната',
      Kitchen: 'кухня',
      Bathroom: 'ванная',
      Bath: 'ванная',
      Toilet: 'туалет',
      WC: 'туалет',
      Hall: 'коридор',
      Corridor: 'коридор',
      Living: 'комната',
      Bedroom: 'комната',
    };

    // Приводим к нижнему регистру и удаляем лишние пробелы
    let normalized = text.toLowerCase().trim();

    // Заменяем известные ошибки
    for (const [wrong, correct] of Object.entries(replacements)) {
      if (normalized.includes(wrong.toLowerCase())) {
        normalized = correct;
        break;
      }
    }

    // Если есть контекст положения текста, используем его
    if (context.nearbyText) {
      // Можно использовать соседний текст для уточнения
      if (context.nearbyText.includes('жилая') && normalized === 'комната') {
        normalized = 'жилая комната';
      }
    }

    return normalized;
  },

  // Распознавание размеров с учетом контекста
  parseMeasurement(text) {
    // Расширенный шаблон для поиска размеров
    const patterns = [
      // Стандартный формат с единицами измерения
      /(\d+(?:[.,]\d+)?)\s*(мм|см|м|m)/i,
      // Размеры в формате ШхВ или ШxВ
      /(\d+(?:[.,]\d+)?)\s*[xх]\s*(\d+(?:[.,]\d+)?)/i,
      // Просто числа рядом с элементами чертежа
      /(\d+(?:[.,]\d+)?)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Преобразуем все размеры в миллиметры
        let value = parseFloat(match[1].replace(',', '.'));
        const unit = match[2]?.toLowerCase() || 'м'; // По умолчанию считаем метрами

        if (unit === 'м' || unit === 'm') {
          value *= 1000;
        } else if (unit === 'см') {
          value *= 10;
        }

        return {
          value,
          unit: 'мм',
          originalValue: match[1],
          originalUnit: unit,
        };
      }
    }

    return null;
  },
};

// Экспортируем модуль
window.imageAnalysis = imageAnalysis;
