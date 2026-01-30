/* script.js
   Client-side JPG -> PNG converter.
   - Validates JPG/JPEG only
   - Drag & drop support
   - Canvas conversion with safe downscaling
   - Instant download and cleanup
*/

/* Configuration */
const MAX_DIMENSION = 4096; // safe max canvas dimension to avoid OOM in many browsers
const LOAD_TIMEOUT_MS = 15000; // fail image loads after 15s to avoid hanging loader

/* Utilities */
const $ = (sel) => document.querySelector(sel);
const formatBytes = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

/* UI elements */
const fileInput = $('#file-input');
const dropzone = document.querySelector('.dropzone');
const errorMsg = $('#error-msg');
const fileInfo = $('#file-info');
const previewWrap = $('#preview-wrap');
const previewImg = $('#preview-img');
const detailName = $('#detail-name');
const detailSize = $('#detail-size');
const convertBtn = $('#convert-btn');
const resetBtn = $('#reset-btn');
const loader = $('#loader');

let currentObjectUrl = null; // preview URL
let currentFile = null;      // File object

/* Show an error in the UI (accessible) */
function showError(message) {
  errorMsg.textContent = message || '';
  fileInfo.setAttribute('aria-hidden', 'true');
}

/* Clear error message */
function clearError() {
  errorMsg.textContent = '';
  fileInfo.removeAttribute('aria-hidden');
}

/* Validate file (type and extension) */
function validateFile(file) {
  if (!file) return { ok: false, reason: 'No file' };
  const name = file.name || '';
  const ext = name.split('.').pop().toLowerCase();
  const mime = file.type || '';
  const allowedExt = ['jpg', 'jpeg'];
  const allowedMime = ['image/jpeg'];

  if (!allowedExt.includes(ext) || !allowedMime.includes(mime)) {
    return { ok: false, reason: 'Invalid file. Please upload a JPG or JPEG image.' };
  }
  return { ok: true };
}

/* Clean up any previously allocated resources (object URLs, image elements) */
function cleanupPreview() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  previewImg.src = '';
  previewImg.removeAttribute('alt');
  previewWrap.hidden = true;
  detailName.textContent = '';
  detailSize.textContent = '';
}

/* Display image preview and details */
function showPreview(file) {
  cleanupPreview();
  clearError();

  currentObjectUrl = URL.createObjectURL(file);
  previewImg.src = currentObjectUrl;
  previewImg.alt = file.name;
  detailName.textContent = file.name;
  detailSize.textContent = formatBytes(file.size);
  previewWrap.hidden = false;
}

/* Safe image loading: returns a Promise<HTMLImageElement> */
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // create a temporary object URL and revoke it after load/error to avoid leaks
    const tmpUrl = URL.createObjectURL(file);
    let timedOut = false;
    const to = setTimeout(() => {
      timedOut = true;
      try { URL.revokeObjectURL(tmpUrl); } catch (e) { /* ignore */ }
      reject(new Error('Image load timed out.'));
    }, LOAD_TIMEOUT_MS);

    img.onload = () => {
      if (timedOut) return; // already rejected
      clearTimeout(to);
      try { URL.revokeObjectURL(tmpUrl); } catch (e) { /* ignore */ }
      resolve(img);
    };

    img.onerror = () => {
      if (timedOut) return;
      clearTimeout(to);
      try { URL.revokeObjectURL(tmpUrl); } catch (e) { /* ignore */ }
      reject(new Error('Failed to read image data.'));
    };

    // Important: avoid tainting -- we only use local files
    img.crossOrigin = 'anonymous';
    img.src = tmpUrl;
  });
}

/* Downscale preserving aspect ratio to fit within maxDimension */
function calculateTargetSize(width, height, maxDim = MAX_DIMENSION) {
  if (width <= maxDim && height <= maxDim) return { width, height };
  const scale = Math.min(maxDim / width, maxDim / height);
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

/* Convert an image element to PNG Blob using canvas, with safe dimensions */
async function convertImageToPng(imgElement, quality = 0.92) {
  // ensure image is loaded
  if (!imgElement || !imgElement.naturalWidth) {
    throw new Error('Invalid image for conversion.');
  }

  const srcW = imgElement.naturalWidth;
  const srcH = imgElement.naturalHeight;
  const { width: targetW, height: targetH } = calculateTargetSize(srcW, srcH);

  // create canvas and draw (release quickly after)
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  // High-quality downscaling approach: draw in one step (sufficient for most cases)
  ctx.drawImage(imgElement, 0, 0, targetW, targetH);

  // Convert to Blob
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Conversion failed (no output).'));
        } else {
          resolve(blob);
        }
        // Clean up
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = canvas.height = 0;
      }, 'image/png');
    } catch (err) {
      // Clean up and propagate
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = canvas.height = 0;
      reject(err);
    }
  });
}

/* Trigger download of a blob with a filename */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // add to DOM to make click work in some browsers
  document.body.appendChild(a);
  a.click();
  // cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 250);
}

/* Reset UI to initial state and release resources */
function resetUI() {
  cleanupPreview();
  currentFile = null;
  fileInput.value = '';
  clearError();
  fileInfo.textContent = 'No file selected';
  convertBtn.disabled = true;
  resetBtn.setAttribute('aria-disabled', 'true');
  loader.hidden = true;
}

/* Set the UI into loading state */
function setLoading(isLoading) {
  if (isLoading) {
    loader.hidden = false;
    convertBtn.disabled = true;
    resetBtn.disabled = true;
    convertBtn.setAttribute('aria-busy', 'true');
  } else {
    loader.hidden = true;
    convertBtn.removeAttribute('aria-busy');
    if (currentFile) convertBtn.disabled = false;
    resetBtn.disabled = false;
  }
}

/* Main handler for selected file(s) */
async function handleFiles(files) {
  if (!files || !files.length) return;
  const file = files[0];

  // Ignore if the same file was already selected to avoid duplicate previews
  if (currentFile && file.name === currentFile.name && file.size === currentFile.size) return;

  const valid = validateFile(file);
  if (!valid.ok) {
    showError(valid.reason);
    return;
  }

  // show preview and enable convert
  currentFile = file;
  showPreview(file);
  fileInfo.textContent = 'Ready to convert';
  convertBtn.disabled = false;
  resetBtn.removeAttribute('aria-disabled');
}

/* Convert flow triggered by button */
async function onConvertClicked() {
  if (!currentFile) {
    showError('No file selected.');
    return;
  }
  setLoading(true);
  clearError();

  try {
    // Prefer the already-displayed preview image if it's loaded
    let img;
    if (previewImg && previewImg.src && previewImg.complete && previewImg.naturalWidth) {
      img = previewImg;
    } else {
      // load the file into an Image element (with timeout)
      img = await loadImageFromFile(currentFile);
    }

    // Convert to PNG Blob
    const pngBlob = await convertImageToPng(img);

    // Prepare filename and trigger download
    const baseName = (currentFile.name || 'image').replace(/\.[^/.]+$/, '');
    const outName = `${baseName}.png`;
    downloadBlob(pngBlob, outName);

    // After successful download, reset UI as required
    // Small delay to ensure download starts for the user
    setTimeout(() => {
      resetUI();
      fileInfo.textContent = 'Downloaded ✓';
    }, 400);
  } catch (err) {
    // surface a friendly error
    showError(err && err.message ? err.message : 'An error occurred during conversion.');
  } finally {
    setLoading(false);
  }
}

/* Drag & drop handlers */
function preventDefault(e) {
  e.preventDefault();
  e.stopPropagation();
}
function onDrop(e) {
  preventDefault(e);
  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length) {
    handleFiles(dt.files);
  }
  dropzone.classList.remove('dragover');
}
function onDragOver(e) {
  preventDefault(e);
  dropzone.classList.add('dragover');
}
function onDragLeave(e) {
  preventDefault(e);
  dropzone.classList.remove('dragover');
}

/* Setup event listeners */
function setupEventListeners() {
  // File input
  fileInput.addEventListener('change', (e) => {
    clearError();
    const files = e.target.files;
    handleFiles(files);
  });

  // Dropzone click/keyboard
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  // The dropzone is a <label> for the hidden file input; the browser
  // will open the file picker on click. Calling fileInput.click() as
  // well can cause duplicate behavior in some browsers, so we avoid
  // programmatically clicking the input here.

  // Drag events
  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, onDragOver);
  });
  ['dragleave', 'dragend', 'mouseout'].forEach((evt) => {
    dropzone.addEventListener(evt, onDragLeave);
  });
  dropzone.addEventListener('drop', onDrop);

  // Convert and reset buttons
  convertBtn.addEventListener('click', onConvertClicked);
  resetBtn.addEventListener('click', resetUI);

  // Accessibility: allow dropping on window too
  window.addEventListener('dragover', preventDefault);
  window.addEventListener('drop', preventDefault);
}

/* Initialize */
function init() {
  // Friendly initial state
  fileInfo.textContent = 'No file selected';
  resetBtn.setAttribute('aria-disabled', 'true');
  convertBtn.disabled = true;
  loader.hidden = true;
  setupEventListeners();
}

// Start
init();