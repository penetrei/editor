const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({
    mainName: 'main',
    corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js',
});

const uploadInput = document.getElementById('video-upload-input');
const uploadBtn = document.getElementById('video-upload-btn');
const editorDiv = document.getElementById('editor');
const videoPreview = document.getElementById('video-preview');
const cropCanvas = document.getElementById('crop-canvas');
const trimSlider = document.getElementById('trim-slider');
const startTimeDisplay = document.getElementById('start-time-display');
const endTimeDisplay = document.getElementById('end-time-display');
const activateCropBtn = document.getElementById('activate-crop-btn');
const confirmCropBtn = document.getElementById('confirm-crop-btn');
const cancelCropBtn = document.getElementById('cancel-crop-btn');
const cropActionsInitial = document.getElementById('crop-actions-initial');
const cropActionsConfirm = document.getElementById('crop-actions-confirm');
const cropStatusMessage = document.getElementById('crop-status-message');
const resultDiv = document.getElementById('result');
const processBtn = document.getElementById('process-btn');
const statusP = document.getElementById('status');
const errorMessage = document.getElementById('error-message');
const downloadLink = document.getElementById('download-link');

let videoFile = null;
let trimTimes = { start: 0, end: 0 };
let confirmedCropData = null;
let cropper = null;
let isProcessing = false;

const formatTime = (seconds) => new Date(seconds * 1000).toISOString().substr(11, 8);

uploadBtn.addEventListener('click', () => uploadInput.click());
uploadInput.addEventListener('change', async (event) => {
    videoFile = event.target.files[0];
    if (!videoFile) return;
    editorDiv.classList.remove('hidden');
    resultDiv.classList.remove('hidden');
    statusP.textContent = 'Carregando FFmpeg (só na primeira vez)...';
    errorMessage.classList.add('hidden');
    downloadLink.classList.add('hidden');
    cancelCrop();
    if (!ffmpeg.isLoaded()) await ffmpeg.load();
    statusP.textContent = 'Vídeo pronto para edição!';
    videoPreview.src = URL.createObjectURL(videoFile);
    videoPreview.controls = true;
    videoPreview.onloadedmetadata = () => {
        const duration = videoPreview.duration;
        trimTimes = { start: 0, end: duration };
        if (trimSlider.noUiSlider) trimSlider.noUiSlider.destroy();
        noUiSlider.create(trimSlider, { start: [0, duration], connect: true, range: { 'min': 0, 'max': duration }, tooltips: [{ to: formatTime }, { to: formatTime }] });
        trimSlider.noUiSlider.on('update', (values) => {
            trimTimes.start = parseFloat(values[0]);
            trimTimes.end = parseFloat(values[1]);
            startTimeDisplay.textContent = formatTime(trimTimes.start);
            endTimeDisplay.textContent = formatTime(trimTimes.end);
        });
    };
});

activateCropBtn.addEventListener('click', () => { if (cropper) return; videoPreview.pause(); videoPreview.controls = false; cropCanvas.width = videoPreview.videoWidth; cropCanvas.height = videoPreview.videoHeight; cropCanvas.getContext('2d').drawImage(videoPreview, 0, 0, cropCanvas.width, cropCanvas.height); videoPreview.classList.add('hidden'); cropCanvas.style.display = 'block'; cropper = new Cropper(cropCanvas, { viewMode: 1, background: false, autoCropArea: 0.8 }); cropActionsInitial.classList.add('hidden'); cropActionsConfirm.classList.remove('hidden'); });
confirmCropBtn.addEventListener('click', () => { const cropData = cropper.getData(true); confirmedCropData = { w: cropData.width, h: cropData.height, x: cropData.x, y: cropData.y }; cropStatusMessage.textContent = '✓ Área de corte selecionada!'; cancelCrop(); });
cancelCropBtn.addEventListener('click', () => { confirmedCropData = null; cropStatusMessage.textContent = ''; cancelCrop(); });
function cancelCrop() { if (cropper) { cropper.destroy(); cropper = null; } videoPreview.classList.remove('hidden'); videoPreview.controls = true; cropCanvas.style.display = 'none'; cropActionsInitial.classList.remove('hidden'); cropActionsConfirm.classList.add('hidden'); }

ffmpeg.setProgress(({ ratio }) => {
    if (ratio >= 0 && ratio <= 1) {
        const percentage = Math.round(ratio * 100);
        statusP.innerHTML = `Processando... ${percentage}% concluído. <br> Por favor, não feche esta aba.`;
    }
});

processBtn.addEventListener('click', async () => {
    if (isProcessing) {
        statusP.textContent = "Aguarde, um processamento já está em andamento.";
        return;
    }
    if (!videoFile) return alert('Por favor, envie um vídeo primeiro.');
    
    isProcessing = true;
    processBtn.disabled = true;
    statusP.textContent = 'Preparando para processar...';
    errorMessage.classList.add('hidden');
    downloadLink.classList.add('hidden');

    try {
        statusP.textContent = 'Carregando vídeo na memória do navegador...';
        ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));

        const command = [];
        command.push('-ss', String(trimTimes.start));
        command.push('-i', 'input.mp4');
        
        if (confirmedCropData) {
            const { w, h, x, y } = confirmedCropData;
            command.push('-vf', `crop=${w}:${h}:${x}:${y}`);
        }
        
        const duration = trimTimes.end - trimTimes.start;
        command.push('-t', String(duration));
        
        if (!confirmedCropData) {
            command.push('-c', 'copy');
        }
        
        command.push('output.mp4');

        await ffmpeg.run(...command);
        
        statusP.textContent = 'Processamento concluído! Preparando o download...';
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
        
        downloadLink.href = URL.createObjectURL(videoBlob);
        downloadLink.download = `editado_${Date.now()}.mp4`;
        downloadLink.textContent = `Baixar Vídeo Editado`;
        downloadLink.classList.remove('hidden');
        
    } catch (error) {
        statusP.textContent = 'Falha no processamento!';
        errorMessage.textContent = `Detalhes do erro: ${error.message}`;
        errorMessage.classList.remove('hidden');
        console.error(error);
    } finally {
        isProcessing = false;
        processBtn.disabled = false;
    }
});
