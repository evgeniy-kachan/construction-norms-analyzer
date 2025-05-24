// Модуль анализа геометрии с использованием TensorFlow.js
const geometryAnalysis = {
  model: null,
  isInitialized: false,

  // Инициализация модели
  async initialize() {
    try {
      console.log('Initializing TensorFlow model...');
      // Загружаем предварительно обученную модель COCO-SSD
      this.model = await cocoSsd.load();
      this.isInitialized = true;
      console.log('TensorFlow model initialized');
    } catch (error) {
      console.error('Error initializing TensorFlow model:', error);
      throw error;
    }
  },

  // Анализ геометрии изображения
  async analyzeGeometry(imageData) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('Starting geometry analysis...');

      // Создаем временный canvas для анализа
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');

      // Преобразуем ImageData в изображение
      const tempImage = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );
      ctx.putImageData(tempImage, 0, 0);

      // Получаем предсказания от модели
      const predictions = await this.model.detect(canvas);
      console.log('Raw predictions:', predictions);

      // Обрабатываем результаты
      const walls = [];
      const rooms = [];

      for (const prediction of predictions) {
        const [x, y, width, height] = prediction.bbox;

        // Определяем тип объекта на основе уверенности модели
        if (prediction.score > 0.5) {
          // Порог уверенности
          if (this.isWall(prediction)) {
            walls.push({
              x: Math.round(x),
              y: Math.round(y),
              width: Math.round(width),
              height: Math.round(height),
              confidence: prediction.score,
            });
          } else if (this.isRoom(prediction)) {
            rooms.push({
              x: Math.round(x),
              y: Math.round(y),
              width: Math.round(width),
              height: Math.round(height),
              area: Math.round((width * height) / 10000), // Примерная площадь в м²
              confidence: prediction.score,
            });
          }
        }
      }

      // Анализируем взаимное расположение стен
      const enhancedWalls = this.analyzeWallConnections(walls);

      // Определяем комнаты на основе замкнутых контуров стен
      const enhancedRooms = this.detectRoomsFromWalls(enhancedWalls);

      console.log('Geometry analysis results:', {
        walls: enhancedWalls.length,
        rooms: enhancedRooms.length,
        details: {
          walls: enhancedWalls,
          rooms: enhancedRooms,
        },
      });

      return {
        walls: enhancedWalls,
        rooms: enhancedRooms,
      };
    } catch (error) {
      console.error('Error in geometry analysis:', error);
      throw error;
    }
  },

  // Определение является ли объект стеной
  isWall(prediction) {
    const wallClasses = ['wall', 'line', 'rectangle'];
    return wallClasses.some((cls) =>
      prediction.class.toLowerCase().includes(cls)
    );
  },

  // Определение является ли объект комнатой
  isRoom(prediction) {
    const roomClasses = ['room', 'area', 'space'];
    return roomClasses.some((cls) =>
      prediction.class.toLowerCase().includes(cls)
    );
  },

  // Анализ соединений стен
  analyzeWallConnections(walls) {
    const connections = [];
    const enhancedWalls = [...walls];

    // Находим соединения между стенами
    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const wall1 = walls[i];
        const wall2 = walls[j];

        // Проверяем пересечение стен
        if (this.doWallsIntersect(wall1, wall2)) {
          connections.push({
            wall1: i,
            wall2: j,
            point: this.findIntersectionPoint(wall1, wall2),
          });
        }
      }
    }

    // Добавляем информацию о соединениях к стенам
    connections.forEach((conn) => {
      enhancedWalls[conn.wall1].connections =
        enhancedWalls[conn.wall1].connections || [];
      enhancedWalls[conn.wall2].connections =
        enhancedWalls[conn.wall2].connections || [];

      enhancedWalls[conn.wall1].connections.push({
        wallIndex: conn.wall2,
        point: conn.point,
      });

      enhancedWalls[conn.wall2].connections.push({
        wallIndex: conn.wall1,
        point: conn.point,
      });
    });

    return enhancedWalls;
  },

  // Определение комнат на основе замкнутых контуров стен
  detectRoomsFromWalls(walls) {
    const rooms = [];
    const visited = new Set();

    // Ищем замкнутые контуры
    walls.forEach((wall, startIndex) => {
      if (visited.has(startIndex)) return;

      const room = this.findClosedLoop(walls, startIndex, visited);
      if (room) {
        // Вычисляем характеристики комнаты
        const bounds = this.calculateRoomBounds(room);
        const area = this.calculateRoomArea(room);

        rooms.push({
          walls: room,
          bounds,
          area,
          points: room.map((wall) => ({
            x: wall.x,
            y: wall.y,
          })),
        });
      }
    });

    return rooms;
  },

  // Проверка пересечения стен
  doWallsIntersect(wall1, wall2) {
    const x1 = wall1.x;
    const y1 = wall1.y;
    const x2 = wall1.x + wall1.width;
    const y2 = wall1.y + wall1.height;

    const x3 = wall2.x;
    const y3 = wall2.y;
    const x4 = wall2.x + wall2.width;
    const y4 = wall2.y + wall2.height;

    // Используем алгоритм проверки пересечения отрезков
    const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denominator === 0) return false;

    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  },

  // Поиск точки пересечения стен
  findIntersectionPoint(wall1, wall2) {
    const x1 = wall1.x;
    const y1 = wall1.y;
    const x2 = wall1.x + wall1.width;
    const y2 = wall1.y + wall1.height;

    const x3 = wall2.x;
    const y3 = wall2.y;
    const x4 = wall2.x + wall2.width;
    const y4 = wall2.y + wall2.height;

    const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;

    return {
      x: Math.round(x1 + ua * (x2 - x1)),
      y: Math.round(y1 + ua * (y2 - y1)),
    };
  },

  // Поиск замкнутого контура стен
  findClosedLoop(walls, startIndex, visited, path = []) {
    visited.add(startIndex);
    path.push(walls[startIndex]);

    const wall = walls[startIndex];
    if (!wall.connections) return null;

    for (const conn of wall.connections) {
      if (path.length > 1 && conn.wallIndex === startIndex) {
        return path; // Нашли замкнутый контур
      }

      if (!visited.has(conn.wallIndex)) {
        const loop = this.findClosedLoop(walls, conn.wallIndex, visited, [
          ...path,
        ]);
        if (loop) return loop;
      }
    }

    return null;
  },

  // Вычисление границ комнаты
  calculateRoomBounds(walls) {
    const points = walls.flatMap((wall) => [
      { x: wall.x, y: wall.y },
      { x: wall.x + wall.width, y: wall.y + wall.height },
    ]);

    const minX = Math.min(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxX = Math.max(...points.map((p) => p.x));
    const maxY = Math.max(...points.map((p) => p.y));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  },

  // Вычисление площади комнаты
  calculateRoomArea(walls) {
    const points = walls.map((wall) => ({
      x: wall.x + wall.width / 2,
      y: wall.y + wall.height / 2,
    }));

    // Используем формулу площади многоугольника
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }

    return Math.abs(area / 2) / 10000; // Переводим в м²
  },
};

// Экспортируем модуль
window.geometryAnalysis = geometryAnalysis;
