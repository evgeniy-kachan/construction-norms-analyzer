// Using PDF.js library for PDF processing
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

async function processPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // For now, we'll only process the first page
    const page = await pdf.getPage(1);

    // Get page dimensions
    const viewport = page.getViewport({ scale: 1.0 });

    // Calculate scale to fit within 800x600 while maintaining aspect ratio
    const maxWidth = 800;
    const maxHeight = 600;
    const scale = Math.min(
      maxWidth / viewport.width,
      maxHeight / viewport.height
    );

    // Create scaled viewport
    const scaledViewport = page.getViewport({ scale });

    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    // Render PDF page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport,
    };

    await page.render(renderContext).promise;

    // Get image data from canvas
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error('Failed to process PDF file');
  }
}

// Экспортируем функцию
window.pdfProcessor = { processPDF };
