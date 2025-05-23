// Модуль для визуализации нарушений норм на плане

class ViolationHighlighter {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.highlights = [];
    this.isVisible = true;
  }

  // Добавить выделение нарушения
  addViolation(violation) {
    const highlight = {
      region: violation.region, // {x, y, width, height} или {points: [{x,y}, ...]}
      type: violation.type,
      message: violation.message,
      color: this._getViolationColor(violation.type),
    };
    this.highlights.push(highlight);
    if (this.isVisible) {
      this.render();
    }
  }

  // Очистить все выделения
  clearHighlights() {
    this.highlights = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Показать/скрыть выделения
  toggleVisibility() {
    this.isVisible = !this.isVisible;
    if (this.isVisible) {
      this.render();
    } else {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  // Отрисовка всех выделений
  render() {
    if (!this.isVisible) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.highlights.forEach((highlight) => {
      this._drawHighlight(highlight);
    });
  }

  // Получить цвет для типа нарушения
  _getViolationColor(type) {
    const colors = {
      размер: 'rgba(255, 0, 0, 0.3)', // Красный для нарушений размеров
      площадь: 'rgba(255, 165, 0, 0.3)', // Оранжевый для нарушений площади
      высота: 'rgba(255, 0, 255, 0.3)', // Пурпурный для нарушений высоты
      default: 'rgba(255, 0, 0, 0.3)', // Красный по умолчанию
    };
    return colors[type] || colors.default;
  }

  // Отрисовка одного выделения
  _drawHighlight(highlight) {
    this.ctx.save();

    // Настройка стиля
    this.ctx.fillStyle = highlight.color;
    this.ctx.strokeStyle = highlight.color.replace('0.3', '0.8');
    this.ctx.lineWidth = 2;

    // Отрисовка региона
    if (highlight.region.points) {
      // Многоугольник
      this.ctx.beginPath();
      this.ctx.moveTo(
        highlight.region.points[0].x,
        highlight.region.points[0].y
      );
      highlight.region.points.slice(1).forEach((point) => {
        this.ctx.lineTo(point.x, point.y);
      });
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    } else {
      // Прямоугольник
      this.ctx.fillRect(
        highlight.region.x,
        highlight.region.y,
        highlight.region.width,
        highlight.region.height
      );
      this.ctx.strokeRect(
        highlight.region.x,
        highlight.region.y,
        highlight.region.width,
        highlight.region.height
      );
    }

    // Добавление текста с описанием нарушения
    this.ctx.font = '14px Arial';
    this.ctx.fillStyle = 'black';
    this.ctx.textBaseline = 'top';

    const x = highlight.region.x || highlight.region.points[0].x;
    const y = highlight.region.y || highlight.region.points[0].y;

    // Белый фон под текстом
    const textMetrics = this.ctx.measureText(highlight.message);
    const textHeight = 20;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.fillRect(x, y - textHeight, textMetrics.width + 10, textHeight);

    // Текст
    this.ctx.fillStyle = 'black';
    this.ctx.fillText(highlight.message, x + 5, y - textHeight + 4);

    this.ctx.restore();
  }
}

// Экспортируем класс
window.ViolationHighlighter = ViolationHighlighter;
