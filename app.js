const { useEffect, useMemo, useRef, useState } = React;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']);

const quantize = (v, step) => {
  const safe = Math.max(1, step);
  return Math.max(0, Math.min(255, Math.round(v / safe) * safe));
};

const fitCanvasToImage = (canvas, ctx, img) => {
  const maxSide = 1024;
  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
  canvas.width = Math.max(1, Math.round(img.width * ratio));
  canvas.height = Math.max(1, Math.round(img.height * ratio));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
};

const createThumbDataUrl = (img) => {
  const size = 140;
  const c = document.createElement('canvas');
  const tctx = c.getContext('2d');
  c.width = size;
  c.height = size;

  const ratio = Math.min(size / img.width, size / img.height);
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const x = Math.floor((size - w) / 2);
  const y = Math.floor((size - h) / 2);

  tctx.fillStyle = '#0f1524';
  tctx.fillRect(0, 0, size, size);
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(img, x, y, w, h);
  return c.toDataURL('image/png');
};

const blobToImage = (blob) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지 로드 실패'));
    };
    img.src = url;
  });

function App() {
  const beforeCanvasRef = useRef(null);
  const afterCanvasRef = useRef(null);

  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('gallery');
  const [anchor, setAnchor] = useState(null);
  const [brushArea, setBrushArea] = useState(9);
  const [colorCount, setColorCount] = useState(16);
  const [status, setStatus] = useState('먼저 폴더를 연결해주세요.');
  const [unsaved, setUnsaved] = useState(false);

  const selectedItem = useMemo(() => items.find((it) => it.id === selectedId) || null, [items, selectedId]);

  const getBrushSize = () => Math.max(1, Math.round(Math.sqrt(Number(brushArea) || 1)));
  const getColorStep = () => Math.max(1, Math.round(255 / (Math.max(2, Number(colorCount) || 16) - 1)));

  const drawAnchorCross = () => {
    const canvas = beforeCanvasRef.current;
    if (!canvas || !anchor) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const { x, y } = anchor;
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
  };

  const renderWorkspace = () => {
    const beforeCanvas = beforeCanvasRef.current;
    const afterCanvas = afterCanvasRef.current;
    if (!beforeCanvas || !afterCanvas) return;

    const beforeCtx = beforeCanvas.getContext('2d', { willReadFrequently: true });
    const afterCtx = afterCanvas.getContext('2d', { willReadFrequently: true });

    if (!selectedItem) {
      beforeCtx.clearRect(0, 0, beforeCanvas.width, beforeCanvas.height);
      afterCtx.clearRect(0, 0, afterCanvas.width, afterCanvas.height);
      return;
    }

    fitCanvasToImage(beforeCanvas, beforeCtx, selectedItem.beforeImage);
    drawAnchorCross();

    if (selectedItem.afterImage) {
      fitCanvasToImage(afterCanvas, afterCtx, selectedItem.afterImage);
    } else {
      afterCtx.clearRect(0, 0, afterCanvas.width, afterCanvas.height);
    }
  };

  useEffect(() => {
    renderWorkspace();
  }, [selectedItem, anchor]);

  const loadItems = async (list, msg) => {
    setItems(list);
    setSelectedId(list[0]?.id || null);
    setAnchor(null);
    setUnsaved(false);
    setStatus(msg);
  };

  const readImagesFromDirectory = async (dirHandle) => {
    const list = [];
    let index = 0;
    for await (const entry of dirHandle.values()) {
      if (entry.kind !== 'file') continue;
      const file = await entry.getFile();
      if (!IMAGE_TYPES.has(file.type)) continue;
      const img = await blobToImage(file);
      list.push({
        id: `${Date.now()}-${index++}`,
        name: file.name,
        beforeImage: img,
        thumbDataUrl: createThumbDataUrl(img),
        handle: entry,
        afterBlob: null,
        afterImage: null,
        saved: false,
        savedThumbDataUrl: null,
      });
    }
    return list;
  };

  const readImagesFromFiles = async (files) => {
    const list = [];
    let idx = 0;
    for (const file of files) {
      if (!IMAGE_TYPES.has(file.type)) continue;
      const img = await blobToImage(file);
      list.push({
        id: `${Date.now()}-${idx++}`,
        name: file.name,
        beforeImage: img,
        thumbDataUrl: createThumbDataUrl(img),
        handle: null,
        afterBlob: null,
        afterImage: null,
        saved: false,
        savedThumbDataUrl: null,
      });
    }
    return list;
  };

  const handlePickFolder = async () => {
    if (!window.showDirectoryPicker) {
      setStatus('현재 브라우저는 폴더 연결 API를 지원하지 않습니다. 아래 대체 업로드를 사용하세요.');
      return;
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const list = await readImagesFromDirectory(handle);
      setDirectoryHandle(handle);
      await loadItems(list, `${list.length}개 이미지를 폴더에서 불러왔습니다.`);
    } catch (err) {
      setStatus(`폴더 연결이 취소되었거나 실패했습니다: ${err.message}`);
    }
  };

  const handleFallbackFolder = async (event) => {
    const files = Array.from(event.target.files || []);
    const list = await readImagesFromFiles(files);
    setDirectoryHandle(null);
    await loadItems(list, `${list.length}개 이미지를 업로드했습니다. (자동 저장은 미지원)`);
  };

  const selectItem = (item) => {
    const isSame = selectedId === item.id;
    const resetAfter = isSame || Boolean(item.afterBlob);

    setSelectedId(item.id);
    setAnchor(null);

    if (resetAfter) {
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, afterBlob: null, afterImage: null } : it)),
      );
      setUnsaved(false);
    }

    setStatus(`${item.name} 선택됨. Before 이미지에서 위치를 클릭하면 After가 생성됩니다.`);
  };

  const processCurrentImage = async (x, y) => {
    const item = selectedItem;
    const beforeCanvas = beforeCanvasRef.current;
    const afterCanvas = afterCanvasRef.current;
    if (!item || !beforeCanvas || !afterCanvas) return;

    const beforeCtx = beforeCanvas.getContext('2d', { willReadFrequently: true });
    const afterCtx = afterCanvas.getContext('2d', { willReadFrequently: true });

    fitCanvasToImage(beforeCanvas, beforeCtx, item.beforeImage);

    const size = getBrushSize();
    const step = getColorStep();
    const src = beforeCtx.getImageData(0, 0, beforeCanvas.width, beforeCanvas.height);
    const out = new ImageData(beforeCanvas.width, beforeCanvas.height);

    const xStart = x - Math.ceil(x / size) * size;
    const yStart = y - Math.ceil(y / size) * size;

    for (let gy = yStart; gy < beforeCanvas.height; gy += size) {
      for (let gx = xStart; gx < beforeCanvas.width; gx += size) {
        const sx = Math.min(beforeCanvas.width - 1, Math.max(0, gx));
        const sy = Math.min(beforeCanvas.height - 1, Math.max(0, gy));
        const sample = (sy * beforeCanvas.width + sx) * 4;

        const r = quantize(src.data[sample], step);
        const g = quantize(src.data[sample + 1], step);
        const b = quantize(src.data[sample + 2], step);
        const a = src.data[sample + 3];

        const xTo = Math.min(gx + size, beforeCanvas.width);
        const yTo = Math.min(gy + size, beforeCanvas.height);

        for (let py = Math.max(0, gy); py < yTo; py++) {
          for (let px = Math.max(0, gx); px < xTo; px++) {
            const idx = (py * beforeCanvas.width + px) * 4;
            out.data[idx] = r;
            out.data[idx + 1] = g;
            out.data[idx + 2] = b;
            out.data[idx + 3] = a;
          }
        }
      }
    }

    afterCanvas.width = beforeCanvas.width;
    afterCanvas.height = beforeCanvas.height;
    afterCtx.putImageData(out, 0, 0);

    const blob = await new Promise((resolve) => afterCanvas.toBlob(resolve, 'image/png'));
    const afterImage = await blobToImage(blob);

    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, afterBlob: blob, afterImage } : it)));
    setUnsaved(true);
    setStatus(`${item.name}: After 생성 완료. Save 버튼으로 연결 폴더에 저장하세요.`);
  };

  const handleBeforeClick = async (event) => {
    if (!selectedItem) return;
    const canvas = beforeCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);

    setAnchor({ x, y });
    await processCurrentImage(x, y);
  };

  const handleSave = async () => {
    if (!selectedItem || !selectedItem.afterBlob) return;

    if (selectedItem.handle && directoryHandle) {
      const outputName = selectedItem.name.replace(/(\.[^.]+)?$/, '_after.png');
      const writableHandle = await directoryHandle.getFileHandle(outputName, { create: true });
      const writable = await writableHandle.createWritable();
      await writable.write(selectedItem.afterBlob);
      await writable.close();
      setStatus(`${outputName} 파일로 원본 폴더에 저장했습니다.`);
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(selectedItem.afterBlob);
      a.download = selectedItem.name.replace(/(\.[^.]+)?$/, '_after.png');
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus('연결 폴더가 없어 로컬 다운로드로 저장했습니다.');
    }

    setItems((prev) =>
      prev.map((it) =>
        it.id === selectedItem.id
          ? { ...it, saved: true, savedThumbDataUrl: createThumbDataUrl(it.afterImage) }
          : it,
      ),
    );
    setUnsaved(false);
    setActiveTab('completed');
  };

  const canSave = Boolean(selectedItem && selectedItem.afterBlob && unsaved);
  const completedItems = items.filter((it) => it.saved && it.savedThumbDataUrl);

  return (
    <main className="layout">
      <section className="panel controls">
        <h1>Pixel Snap Gallery (React)</h1>
        <p className="muted">폴더를 선택해 이미지를 불러오고, 픽커(anchor) 기준으로 픽셀 스냅 결과를 생성/저장하세요.</p>

        <div className="actions stack">
          <button onClick={handlePickFolder}>폴더 연결</button>
          <label className="file-fallback secondary" htmlFor="folderInput">폴더 업로드(대체)</label>
          <input id="folderInput" type="file" accept="image/*" webkitdirectory="" directory="" multiple onChange={handleFallbackFolder} />
        </div>

        <div className="field">
          <span>브러시 크기 (제곱형)</span>
          <select value={brushArea} onChange={(e) => setBrushArea(Number(e.target.value))}>
            <option value="1">1 (1×1)</option>
            <option value="4">4 (2×2)</option>
            <option value="9">9 (3×3)</option>
            <option value="16">16 (4×4)</option>
            <option value="25">25 (5×5)</option>
            <option value="36">36 (6×6)</option>
          </select>
        </div>

        <div className="field">
          <span>색상 수 (Pixel Snapper 스타일)</span>
          <input type="range" min="2" max="64" value={colorCount} onChange={(e) => setColorCount(Number(e.target.value))} />
          <div className="pill">{colorCount} colors</div>
        </div>

        <div className="field">
          <span>Anchor (픽커 기준점)</span>
          <p className="muted small">Before 이미지를 클릭하면 해당 지점을 기준으로 After 이미지를 다시 생성합니다.</p>
          <div className="pill">{anchor ? `x: ${anchor.x}, y: ${anchor.y}` : 'x: -, y: -'}</div>
        </div>

        <div className="actions">
          <button disabled={!canSave} onClick={handleSave}>Save</button>
        </div>

        <p className="status">{status}</p>
      </section>

      <section className="panel workspace">
        <div className="tab-row">
          <button className={`tab ${activeTab === 'gallery' ? 'active' : ''}`} onClick={() => setActiveTab('gallery')}>갤러리</button>
          <button className={`tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>완성</button>
        </div>

        <div className={`gallery-grid ${activeTab !== 'gallery' ? 'hidden' : ''}`}>
          {items.map((item) => (
            <button key={item.id} className={`thumb-card ${item.id === selectedId ? 'active' : ''}`} onClick={() => selectItem(item)}>
              <img src={item.thumbDataUrl} alt={item.name} />
              <span>{item.name}</span>
              {item.saved ? <b>saved</b> : null}
            </button>
          ))}
        </div>

        <div className={`gallery-grid ${activeTab !== 'completed' ? 'hidden' : ''}`}>
          {completedItems.map((item) => (
            <button key={`${item.id}-done`} className="thumb-card" onClick={() => setSelectedId(item.id)}>
              <img src={item.savedThumbDataUrl} alt={`${item.name} saved`} />
              <span>{item.name}</span>
              <b>saved</b>
            </button>
          ))}
        </div>

        <div className="compare-title">Before / After</div>
        <div className="compare-grid">
          <div className="compare-panel">
            <h2>Before</h2>
            <canvas ref={beforeCanvasRef} onClick={handleBeforeClick} width="1024" height="1024" />
          </div>
          <div className="compare-panel">
            <h2>After</h2>
            <canvas ref={afterCanvasRef} width="1024" height="1024" />
          </div>
        </div>
      </section>
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
