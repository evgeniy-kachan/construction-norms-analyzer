document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('dropZone');
  const uploadButton = document.getElementById('uploadButton');
  const fileInput = document.getElementById('fileInput');
  const previewSection = document.getElementById('previewSection');
  const previewCanvas = document.getElementById('previewCanvas');
  const resultsSection = document.getElementById('resultsSection');
  const violationsList = document.getElementById('violationsList');

  // Drag and drop handlers
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
    handleFile(file);
  });

  // Button upload handler
  uploadButton.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFile(file);
  });

  async function handleFile(file) {
    if (!file) return;

    if (!['application/pdf', 'image/png'].includes(file.type)) {
      alert('Пожалуйста, загрузите PDF или PNG файл');
      return;
    }

    try {
      // Show loading state
      dropZone.style.opacity = '0.5';
      dropZone.style.pointerEvents = 'none';

      let imageData;
      if (file.type === 'application/pdf') {
        imageData = await processPDF(file);
      } else {
        imageData = await processImage(file);
      }

      // Display preview
      await displayPreview(imageData);

      // Analyze the image
      const violations = await analyzeImage(imageData);

      // Display results
      displayResults(violations);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Произошла ошибка при обработке файла');
    } finally {
      // Reset upload zone
      dropZone.style.opacity = '1';
      dropZone.style.pointerEvents = 'auto';
    }
  }

  async function displayPreview(imageData) {
    previewSection.hidden = false;
    const ctx = previewCanvas.getContext('2d');

    // Set canvas size to match image
    previewCanvas.width = imageData.width;
    previewCanvas.height = imageData.height;

    // Draw image
    ctx.putImageData(imageData, 0, 0);
  }

  function displayResults(violations) {
    resultsSection.hidden = false;
    violationsList.innerHTML = '';

    if (violations.length === 0) {
      violationsList.innerHTML =
        '<div class="violation-item success">Нарушений не обнаружено</div>';
      return;
    }

    violations.forEach((violation) => {
      const violationElement = document.createElement('div');
      violationElement.className = 'violation-item';
      violationElement.innerHTML = `
                <h3>${violation.title}</h3>
                <p>${violation.description}</p>
                <p>Норма: ${violation.norm}</p>
                <p>Фактическое значение: ${violation.actual}</p>
            `;
      violationsList.appendChild(violationElement);
    });
  }
});
