/* upload.js */

const dropzone     = document.getElementById('dropzone');
const fileInput    = document.getElementById('fileInput');
const dropzoneBody = document.getElementById('dropzoneBody');
const progressPanel= document.getElementById('progressPanel');
const progressFill = document.getElementById('progressFill');
const progressLabel= document.getElementById('progressLabel');
const progressPct  = document.getElementById('progressPct');
const upFilename   = document.getElementById('upFilename');
const statusToast  = document.getElementById('statusToast');

function showToast(msg, type) {
  statusToast.textContent = msg;
  statusToast.className = 'toast ' + type;
}

function uploadFile(file) {
  // Show progress panel
  upFilename.textContent = file.name;
  dropzoneBody.classList.add('hidden');
  progressPanel.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressPct.textContent = '0%';
  progressLabel.textContent = 'Uploading…';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/upload');

  xhr.upload.addEventListener('progress', e => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = pct + '%';
      progressPct.textContent = pct + '%';
    }
  });

  xhr.addEventListener('load', () => {
    let json;
    try { json = JSON.parse(xhr.responseText); } catch(e) {
      showError('Unexpected server response.');
      return;
    }
    if (json.error) { showError(json.error); return; }

    progressFill.style.width = '100%';
    progressPct.textContent = '100%';
    progressLabel.textContent = 'Upload complete — redirecting…';
    showToast('File uploaded successfully!', 'success');
    setTimeout(() => { window.location.href = '/analyse'; }, 700);
  });

  xhr.addEventListener('error', () => showError('Upload failed. Please try again.'));

  const data = new FormData();
  data.append('logfile', file);
  xhr.send(data);
}

function showError(msg) {
  dropzoneBody.classList.remove('hidden');
  progressPanel.classList.add('hidden');
  showToast('Error: ' + msg, 'error');
}

/* Drag & drop */
dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
['dragleave', 'dragend'].forEach(ev =>
  dropzone.addEventListener(ev, () => dropzone.classList.remove('dragover'))
);
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
});

/* Browse */
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) uploadFile(fileInput.files[0]);
});
