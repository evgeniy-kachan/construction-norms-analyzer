// Основной модуль приложения
const app = {
  // Состояние приложения
  state: {
    isProcessing: false,
    currentFile: null,
    highlightsVisible: true,
  },

  // Инициализация приложения
  async initialize() {
    try {
      console.log('Initializing application...');

      // Инициализируем модуль анализа геометрии
      await window.geometryAnalysis.initialize();

      // Инициализируем обработчики событий
      this.initializeEventListeners();

      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Error initializing application:', error);
      this.showError('Ошибка инициализации приложения');
    }
  },

  // Инициализация обработчиков событий
  initializeEventListeners() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const toggleHighlights = document.getElementById('toggleHighlights');

    // Обработчики для drag & drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      this.handleFileUpload(file);
    });

    // Обработчики для кнопки загрузки
    uploadButton.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      this.handleFileUpload(file);
    });

    // Обработчик для переключения подсветки нарушений
    toggleHighlights.addEventListener('click', () => {
      this.toggleViolationHighlights();
    });
  },

  // Обработка загрузки файла
  async handleFileUpload(file) {
    if (!file) return;

    try {
      this.state.isProcessing = true;
      this.state.currentFile = file;
      this.updateUI('processing');

      // Обработка файла в зависимости от типа
      let imageData;
      if (file.type === 'application/pdf') {
        imageData = await window.pdfProcessor.processPDF(file);
      } else {
        imageData = await window.imageProcessor.processImage(file);
      }

      // Анализ изображения
      const results = await window.imageAnalysis.analyzeImage(imageData);

      // Отображение результатов
      this.displayResults(results, imageData);

      this.state.isProcessing = false;
      this.updateUI('complete');
    } catch (error) {
      console.error('Error processing file:', error);
      this.showError('Ошибка обработки файла');
      this.state.isProcessing = false;
      this.updateUI('error');
    }
  },

  // Отображение результатов анализа
  displayResults(results, imageData) {
    const previewCanvas = document.getElementById('previewCanvas');
    const textList = document.getElementById('textList');
    const measurementsList = document.getElementById('measurementsList');
    const violationsList = document.getElementById('violationsList');

    // Отображаем изображение
    previewCanvas.width = imageData.width;
    previewCanvas.height = imageData.height;
    const ctx = previewCanvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);

    // Очищаем предыдущие результаты
    textList.innerHTML = '';
    measurementsList.innerHTML = '';
    violationsList.innerHTML = '';

    // Отображаем распознанный текст
    if (results.roomTypes && results.roomTypes.length > 0) {
      results.roomTypes.forEach((room) => {
        const div = document.createElement('div');
        div.className = 'text-item';
        div.innerHTML = `
          <span class="text-value">${room.type}</span>
          <span class="text-confidence">(${Math.round(room.confidence)}%)</span>
        `;
        textList.appendChild(div);
      });
    } else {
      textList.innerHTML = '<div class="no-results">Текст не распознан</div>';
    }

    // Отображаем размеры
    if (results.measurements && results.measurements.length > 0) {
      results.measurements.forEach((measurement) => {
        const div = document.createElement('div');
        div.className = 'measurement-item';
        div.innerHTML = `
          <span class="measurement-value">${measurement.value}${
          measurement.unit
        }</span>
          <span class="measurement-confidence">(${Math.round(
            measurement.confidence
          )}%)</span>
        `;
        measurementsList.appendChild(div);
      });
    } else {
      measurementsList.innerHTML =
        '<div class="no-results">Размеры не найдены</div>';
    }

    // Отображаем нарушения
    if (results.violations && results.violations.length > 0) {
      results.violations.forEach((violation) => {
        const div = document.createElement('div');
        div.className = 'violation-item';
        div.innerHTML = `
          <h3>${violation.title}</h3>
          <p>${violation.description}</p>
          <p>Норма: ${violation.norm}</p>
          <p>Фактическое значение: ${violation.actual}</p>
        `;
        violationsList.appendChild(div);
      });

      // Подсвечиваем нарушения на изображении
      if (this.state.highlightsVisible) {
        window.normChecker.highlightViolations(results.violations);
      }
    } else {
      violationsList.innerHTML =
        '<div class="no-violations">Нарушений не обнаружено</div>';
    }
  },

  // Переключение подсветки нарушений
  toggleViolationHighlights() {
    this.state.highlightsVisible = !this.state.highlightsVisible;
    window.normChecker.toggleHighlights();
  },

  // Обновление UI в зависимости от состояния
  updateUI(state) {
    const dropZone = document.getElementById('dropZone');
    const previewSection = document.getElementById('previewSection');
    const resultsSection = document.getElementById('resultsSection');
    const progressBar = document.getElementById('progressBar');

    switch (state) {
      case 'processing':
        dropZone.style.display = 'none';
        progressBar.hidden = false;
        previewSection.hidden = true;
        resultsSection.hidden = true;
        break;

      case 'complete':
        dropZone.style.display = 'none';
        progressBar.hidden = true;
        previewSection.hidden = false;
        resultsSection.hidden = false;
        break;

      case 'error':
        dropZone.style.display = 'block';
        progressBar.hidden = true;
        previewSection.hidden = true;
        resultsSection.hidden = true;
        break;

      default:
        dropZone.style.display = 'block';
        progressBar.hidden = true;
        previewSection.hidden = true;
        resultsSection.hidden = true;
    }
  },

  // Отображение ошибки
  showError(message) {
    alert(message);
  },
};

// Инициализируем приложение при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  app.initialize();
});
