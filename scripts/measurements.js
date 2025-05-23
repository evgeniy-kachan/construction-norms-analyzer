// Модуль для работы с измерениями

const measurements = {
  // Конвертация единиц измерения
  convertUnits(value, fromUnit, toUnit) {
    const units = {
      mm: 1,
      cm: 10,
      m: 1000,
    };

    // Конвертируем в миллиметры
    const mmValue = value * (units[fromUnit] || 1);

    // Конвертируем в целевую единицу
    return mmValue / (units[toUnit] || 1);
  },

  // Форматирование значения с единицей измерения
  formatMeasurement(value, unit) {
    // Округляем до 2 знаков после запятой
    const roundedValue = Math.round(value * 100) / 100;
    return `${roundedValue} ${unit}`;
  },

  // Вычисление площади по точкам (метод трапеций)
  calculateArea(points) {
    let area = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }

    return Math.abs(area) / 2;
  },

  // Вычисление длины между двумя точками
  calculateDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  },
};

// Экспортируем модуль
window.measurements = measurements;
