const imageInput = document.getElementById('imageInput');
const pixelSizeInput = document.getElementById('pixelSize');
const snapButton = document.getElementById('snapButton');
const downloadButton = document.getElementById('downloadButton');
const statusEl = document.getElementById('status');
const anchorLabel = document.getElementById('anchorLabel');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const state = {
  image: null,
  anchor: null,
  snapped: false,
};

const setStatus = (msg) => {
  statusEl.textContent = msg;
};

const updateAnchorLabel = () => {
  if (!state.anchor) {
    anchorLabel.textContent = 'x: -, y: -';
    return;
  }
  anchorLabel.textContent = `x: ${state.anchor.x}, y: ${state.anchor.y}`;
};

const fitCanvasToImage = (img) => {
  const maxSide = 1536;
  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
  canvas.width = Math.max(1, Math.round(img.width * ratio));
  canvas.height = Math.max(1, Math.round(img.height * ratio));
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
};

const getPixelSize = () => {
  const raw = Number(pixelSizeInput.value);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.round(raw);
};

const snapImage = () => {
  if (!state.image) {
    setStatus('먼저 이미지를 업로드해주세요.');
    return;
  }

  const size = getPixelSize();
  if (!state.anchor) {
    state.anchor = {
      x: Math.floor(canvas.width / 2),
      y: Math.floor(canvas.height / 2),
    };
    updateAnchorLabel();
  }

  const { x: ax, y: ay } = state.anchor;
  const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = new ImageData(canvas.width, canvas.height);

  const xStart = ax - Math.ceil(ax / size) * size;
  const yStart = ay - Math.ceil(ay / size) * size;

  for (let gy = yStart; gy < canvas.height; gy += size) {
    for (let gx = xStart; gx < canvas.width; gx += size) {
      const sx = Math.min(canvas.width - 1, Math.max(0, gx));
      const sy = Math.min(canvas.height - 1, Math.max(0, gy));
      const sampleIndex = (sy * canvas.width + sx) * 4;

      const r = src.data[sampleIndex];
      const g = src.data[sampleIndex + 1];
      const b = src.data[sampleIndex + 2];
      const a = src.data[sampleIndex + 3];

      const xTo = Math.min(gx + size, canvas.width);
      const yTo = Math.min(gy + size, canvas.height);

      for (let y = Math.max(0, gy); y < yTo; y++) {
        for (let x = Math.max(0, gx); x < xTo; x++) {
          const idx = (y * canvas.width + x) * 4;
          out.data[idx] = r;
          out.data[idx + 1] = g;
          out.data[idx + 2] = b;
          out.data[idx + 3] = a;
        }
      }
    }
  }

  ctx.putImageData(out, 0, 0);

  // Anchor mark
  ctx.save();
  ctx.strokeStyle = '#ffd54a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ax - 8, ay);
  ctx.lineTo(ax + 8, ay);
  ctx.moveTo(ax, ay - 8);
  ctx.lineTo(ax, ay + 8);
  ctx.stroke();
  ctx.restore();

  state.snapped = true;
  downloadButton.disabled = false;
  setStatus(`Pixel snap 완료 (pixel size: ${size}, anchor: ${ax}, ${ay}).`);
};

const openImage = (file) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.image = img;
    state.anchor = {
      x: Math.floor(img.width / 2),
      y: Math.floor(img.height / 2),
    };
    fitCanvasToImage(img);
    updateAnchorLabel();
    setStatus('이미지가 로드되었습니다. 캔버스를 클릭해 anchor를 지정한 뒤 Pixel Snap 적용을 누르세요.');
    downloadButton.disabled = true;
    state.snapped = false;
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    setStatus('이미지를 읽지 못했습니다. 파일 형식을 확인해주세요.');
    URL.revokeObjectURL(url);
  };
  img.src = url;
};

imageInput.addEventListener('change', (e) => {
  const [file] = e.target.files || [];
  if (!file) return;
  openImage(file);
});

canvas.addEventListener('click', (e) => {
  if (!state.image) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);
  state.anchor = { x, y };
  updateAnchorLabel();

  fitCanvasToImage(state.image);
  ctx.save();
  ctx.strokeStyle = '#ffd54a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 8, y);
  ctx.lineTo(x + 8, y);
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x, y + 8);
  ctx.stroke();
  ctx.restore();

  setStatus(`Anchor가 (${x}, ${y})로 설정되었습니다.`);
});

snapButton.addEventListener('click', snapImage);

downloadButton.addEventListener('click', () => {
  if (!state.snapped) return;
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'pixel-snapped.png';
  a.click();
});
