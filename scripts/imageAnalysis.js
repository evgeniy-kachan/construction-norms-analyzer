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
      // 0. Убеждаемся, что нормы загружены
      await window.normChecker.loadNorms();
      console.log('Нормы загружены, начинаем анализ');

      // 1. Определяем стены и комнаты
      const walls = await this.detectWalls(imageData);
      results.walls = walls;

      const rooms = this.detectRooms(walls);
      results.rooms = rooms;

      // 2. Распознаем размеры и типы помещений
      const { measurements, roomTypes } = await this.recognizeMeasurements(
        imageData
      );
      results.measurements = measurements;

      // 3. Проверяем нормы для каждой комнаты
      rooms.forEach((room) => {
        // Проверяем размеры комнаты
        console.log('Проверяем комнату:', room);

        const widthCheck = window.normChecker.checkMeasurement(
          room.width,
          room.type || 'комната', // Используем тип из распознавания или по умолчанию
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
          room.type || 'комната',
          'length',
          {
            x: room.bounds.x,
            y: room.bounds.y,
            width: 10,
            height: room.bounds.height,
          }
        );

        const areaCheck = window.normChecker.checkArea(
          room.area,
          room.type || 'комната',
          {
            points: room.points,
          }
        );

        // Собираем нарушения
        if (!widthCheck.isValid) {
          console.log('Найдено нарушение ширины:', widthCheck.violation);
          results.violations.push(widthCheck.violation);
        }
        if (!lengthCheck.isValid) {
          console.log('Найдено нарушение длины:', lengthCheck.violation);
          results.violations.push(lengthCheck.violation);
        }
        if (!areaCheck.isValid) {
          console.log('Найдено нарушение площади:', areaCheck.violation);
          results.violations.push(areaCheck.violation);
        }
      });

      console.log(
        'Анализ завершен, найдено нарушений:',
        results.violations.length
      );
    } catch (error) {
      console.error('Error analyzing image:', error);
      throw error; // Пробрасываем ошибку дальше для обработки в UI
    }

    return results;
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

      // Применяем предобработку для улучшения распознавания
      const processedImageData = this.preprocessForOCR(imageData);
      ctx.putImageData(processedImageData, 0, 0);
      console.log('Image preprocessing completed');

      // Получаем URL изображения для Tesseract
      const imageUrl = canvas.toDataURL('image/png');
      console.log('Image converted to URL');

      // Распознаем текст с получением координат
      console.log('Starting Tesseract recognition...');
      const { data } = await worker.recognize(imageUrl);
      console.log('Recognition completed. Raw result:', data);

      await worker.terminate();
      console.log('Worker terminated');

      // Обрабатываем результаты распознавания
      const measurements = [];
      const roomTypes = [];

      // Функция для нормализации текста
      const normalizeText = (text) => {
        const replacements = {
          KyxHa: 'кухня',
          Kyxня: 'кухня',
          Kopuoop: 'коридор',
          Room: 'комната',
          room: 'комната',
        };

        // Приводим к нижнему регистру и заменяем известные ошибки
        let normalized = text.toLowerCase();
        for (const [wrong, correct] of Object.entries(replacements)) {
          if (normalized.includes(wrong.toLowerCase())) {
            normalized = correct;
            break;
          }
        }
        return normalized;
      };

      // Обрабатываем каждое слово
      if (data.words && data.words.length > 0) {
        console.log('Processing', data.words.length, 'words');
        data.words.forEach((word, index) => {
          const normalizedText = normalizeText(word.text);
          console.log(
            `Processing word ${index + 1}:`,
            word.text,
            '(normalized:',
            normalizedText,
            ')'
          );

          // Проверяем на размеры (число + единица измерения)
          const measurementMatch = normalizedText.match(
            /(\d+(?:[.,]\d+)?)\s*(мм|см|м|m)/i
          );
          if (measurementMatch) {
            console.log('Found measurement:', measurementMatch[0]);
            // Преобразуем все размеры в миллиметры
            let value = parseFloat(measurementMatch[1].replace(',', '.'));
            const unit = measurementMatch[2].toLowerCase();
            if (unit === 'м' || unit === 'm') {
              value *= 1000;
            } else if (unit === 'см') {
              value *= 10;
            }

            measurements.push({
              value: value,
              unit: 'мм', // Храним все размеры в миллиметрах
              originalValue: measurementMatch[1],
              originalUnit: unit,
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

      console.log('Recognition results:', {
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

    // Преобразуем в оттенки серого
    for (let i = 0; i < data.length; i += 4) {
      const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = avg; // R
      data[i + 1] = avg; // G
      data[i + 2] = avg; // B
    }

    // Применяем пороговое значение для улучшения контраста
    const threshold = 128;
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i] > threshold ? 255 : 0;
      data[i] = value; // R
      data[i + 1] = value; // G
      data[i + 2] = value; // B
    }

    return new ImageData(data, width, height);
  },
};

// Экспортируем модуль
window.imageAnalysis = imageAnalysis;
