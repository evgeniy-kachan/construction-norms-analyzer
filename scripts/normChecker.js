// Модуль проверки строительных норм
const normChecker = {
  norms: null,
  highlighter: null,
  highlights: [],
  showHighlights: true,

  // Загрузка норм
  async loadNorms() {
    try {
      const response = await fetch('building_norms_sp54_combined.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.norms = await response.json();
      console.log('Нормы успешно загружены');
    } catch (error) {
      console.error('Ошибка при загрузке норм:', error);
      // Загружаем резервные нормы
      this.norms = {
        rooms: {
          комната: {
            width: {
              min: 2400,
              description: 'Минимальная ширина комнаты',
            },
            length: {
              min: 3000,
              description: 'Минимальная длина комнаты от окна',
            },
            area: {
              min: 8,
              description: 'Минимальная площадь комнаты',
            },
          },
          кухня: {
            width: {
              min: 1700,
              description: 'Минимальная ширина кухни',
            },
            area: {
              min: 5,
              description: 'Минимальная площадь кухни',
            },
          },
          санузел: {
            width: {
              min: 1200,
              description: 'Минимальная ширина санузла',
            },
            area: {
              min: 1.5,
              description: 'Минимальная площадь санузла',
            },
          },
        },
      };
      console.log('Загружены резервные нормы');
    }
  },

  // Проверка размера
  checkMeasurement(value, roomType, dimension, bounds) {
    if (!this.norms) {
      throw new Error('Нормы еще не загружены');
    }

    const roomNorms = this.norms.rooms[roomType.toLowerCase()];
    if (!roomNorms) {
      return {
        isValid: true, // Если нет норм для типа помещения, считаем допустимым
        violation: null,
      };
    }

    const dimensionNorms = roomNorms[dimension];
    if (!dimensionNorms) {
      return {
        isValid: true, // Если нет норм для измерения, считаем допустимым
        violation: null,
      };
    }

    const isValid = value >= dimensionNorms.min;
    if (!isValid) {
      const violation = {
        title: `Нарушение размера ${dimension} в помещении "${roomType}"`,
        description: dimensionNorms.description,
        norm: `${dimensionNorms.min} мм`,
        actual: `${value} мм`,
        bounds: bounds,
      };

      // Добавляем подсветку нарушения
      if (bounds) {
        this.addHighlight(bounds);
      }

      return { isValid, violation };
    }

    return { isValid: true, violation: null };
  },

  // Проверка площади
  checkArea(value, roomType, bounds) {
    if (!this.norms) {
      throw new Error('Нормы еще не загружены');
    }

    const roomNorms = this.norms.rooms[roomType.toLowerCase()];
    if (!roomNorms || !roomNorms.area) {
      return {
        isValid: true,
        violation: null,
      };
    }

    const isValid = value >= roomNorms.area.min;
    if (!isValid) {
      const violation = {
        title: `Нарушение площади в помещении "${roomType}"`,
        description: roomNorms.area.description,
        norm: `${roomNorms.area.min} м²`,
        actual: `${value} м²`,
        bounds: bounds,
      };

      // Добавляем подсветку нарушения
      if (bounds && bounds.points) {
        this.addPolygonHighlight(bounds.points);
      }

      return { isValid, violation };
    }

    return { isValid: true, violation: null };
  },

  // Инициализация подсветки нарушений
  initHighlighter(canvas) {
    this.highlighter = {
      canvas: canvas,
      ctx: canvas.getContext('2d'),
    };
    this.loadNorms(); // Загружаем нормы при инициализации
  },

  // Добавление подсветки нарушения
  addHighlight(bounds) {
    this.highlights.push({
      type: 'rect',
      bounds: bounds,
    });
    this.drawHighlights();
  },

  // Добавление подсветки многоугольника
  addPolygonHighlight(points) {
    this.highlights.push({
      type: 'polygon',
      points: points,
    });
    this.drawHighlights();
  },

  // Отрисовка всех подсветок
  drawHighlights() {
    if (!this.highlighter || !this.showHighlights) return;

    const ctx = this.highlighter.ctx;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';

    this.highlights.forEach((highlight) => {
      if (highlight.type === 'rect') {
        ctx.strokeRect(
          highlight.bounds.x,
          highlight.bounds.y,
          highlight.bounds.width,
          highlight.bounds.height
        );
        ctx.fillRect(
          highlight.bounds.x,
          highlight.bounds.y,
          highlight.bounds.width,
          highlight.bounds.height
        );
      } else if (highlight.type === 'polygon') {
        ctx.beginPath();
        ctx.moveTo(highlight.points[0].x, highlight.points[0].y);
        highlight.points.slice(1).forEach((point) => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      }
    });
  },

  // Переключение видимости подсветки
  toggleHighlights() {
    this.showHighlights = !this.showHighlights;
    if (this.showHighlights) {
      this.drawHighlights();
    } else {
      // Очищаем canvas от подсветки
      const imageData = this.highlighter.ctx.getImageData(
        0,
        0,
        this.highlighter.canvas.width,
        this.highlighter.canvas.height
      );
      this.highlighter.ctx.putImageData(imageData, 0, 0);
    }
  },

  // Очистка подсветки
  clearHighlights() {
    this.highlights = [];
    if (this.highlighter) {
      const imageData = this.highlighter.ctx.getImageData(
        0,
        0,
        this.highlighter.canvas.width,
        this.highlighter.canvas.height
      );
      this.highlighter.ctx.putImageData(imageData, 0, 0);
    }
  },
};

// Экспортируем модуль
window.normChecker = normChecker;
