// Загрузка норм из JSON файла
let BUILDING_NORMS = null;
let highlighter = null;

async function loadNorms() {
  try {
    const response = await fetch('/building_norms_sp54_combined.json');
    BUILDING_NORMS = await response.json();
    console.log('Нормы успешно загружены');
  } catch (error) {
    console.error('Ошибка при загрузке норм:', error);
  }
}

// Инициализация подсветки нарушений
function initHighlighter(canvas) {
  highlighter = new ViolationHighlighter(canvas);
}

function checkMeasurement(value, category, parameter, region) {
  if (!BUILDING_NORMS) {
    throw new Error('Нормы еще не загружены');
  }

  const categoryNorms = BUILDING_NORMS[category];
  if (!categoryNorms) {
    throw new Error(`Неизвестная категория: ${category}`);
  }

  const parameterNorms = categoryNorms[parameter];
  if (!parameterNorms) {
    throw new Error(`Неизвестный параметр: ${parameter}`);
  }

  // Проверяем минимальное значение в миллиметрах
  if (parameterNorms.min_mm && value < parameterNorms.min_mm) {
    const violation = {
      isValid: false,
      violation: {
        title: `Нарушение: ${parameterNorms.message}`,
        description: `Значение меньше допустимого минимума`,
        norm: `${parameterNorms.min_mm} мм`,
        actual: `${value} мм`,
      },
    };

    // Добавляем подсветку, если указан регион и есть highlighter
    if (highlighter && region) {
      highlighter.addViolation({
        region: region,
        type: 'размер',
        message: parameterNorms.message,
      });
    }

    return violation;
  }

  // Проверяем минимальное значение в метрах
  if (parameterNorms.min_m && value < parameterNorms.min_m * 1000) {
    const violation = {
      isValid: false,
      violation: {
        title: `Нарушение: ${parameterNorms.message}`,
        description: `Значение меньше допустимого минимума`,
        norm: `${parameterNorms.min_m} м`,
        actual: `${value / 1000} м`,
      },
    };

    // Добавляем подсветку, если указан регион и есть highlighter
    if (highlighter && region) {
      highlighter.addViolation({
        region: region,
        type: 'размер',
        message: parameterNorms.message,
      });
    }

    return violation;
  }

  // Проверяем максимальное значение в метрах
  if (parameterNorms.max_m && value > parameterNorms.max_m * 1000) {
    const violation = {
      isValid: false,
      violation: {
        title: `Нарушение: ${parameterNorms.message}`,
        description: `Значение больше допустимого максимума`,
        norm: `${parameterNorms.max_m} м`,
        actual: `${value / 1000} м`,
      },
    };

    // Добавляем подсветку, если указан регион и есть highlighter
    if (highlighter && region) {
      highlighter.addViolation({
        region: region,
        type: 'размер',
        message: parameterNorms.message,
      });
    }

    return violation;
  }

  return {
    isValid: true,
  };
}

function checkArea(area, category, region) {
  if (!BUILDING_NORMS) {
    throw new Error('Нормы еще не загружены');
  }

  const categoryNorms = BUILDING_NORMS[category];
  if (!categoryNorms) {
    throw new Error(`Неизвестная категория: ${category}`);
  }

  const areaNorms = categoryNorms.площадь;
  if (!areaNorms) {
    throw new Error(`Для категории ${category} не заданы нормы площади`);
  }

  if (area < areaNorms.min_m2) {
    const violation = {
      isValid: false,
      violation: {
        title: `Нарушение: ${areaNorms.message}`,
        description: `Площадь меньше допустимого минимума`,
        norm: `${areaNorms.min_m2} м²`,
        actual: `${area} м²`,
      },
    };

    // Добавляем подсветку, если указан регион и есть highlighter
    if (highlighter && region) {
      highlighter.addViolation({
        region: region,
        type: 'площадь',
        message: areaNorms.message,
      });
    }

    return violation;
  }

  return {
    isValid: true,
  };
}

// Очистка всех выделений
function clearHighlights() {
  if (highlighter) {
    highlighter.clearHighlights();
  }
}

// Переключение видимости выделений
function toggleHighlights() {
  if (highlighter) {
    highlighter.toggleVisibility();
  }
}

// Экспортируем функции
window.normChecker = {
  loadNorms,
  initHighlighter,
  checkMeasurement,
  checkArea,
  clearHighlights,
  toggleHighlights,
};

// Загружаем нормы при инициализации
loadNorms();
