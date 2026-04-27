const { useEffect, useMemo, useRef, useState } = React;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']);

const quantize = (v, step) => {
  const safe = Math.max(1, step);
  return Math.max(0, Math.min(255, Math.round(v / safe) * safe));
};

const fitCanvasToImage = (canvas, ctx, img) => {
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
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

const createImageDataUrl = (img) => {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, c.width, c.height);
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
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });

const makeOutputName = (name) => name.replace(/(\.[^.]+)?$/, '_after.png');

const downloadBlob = (blob, filename) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

const saveBlobAsFile = async (blob, filename) => {
  if (!window.showSaveFilePicker) {
    downloadBlob(blob, filename);
    return 'download';
  }

  const handle = await window.showSaveFilePicker({
    suggestedName: filename,
    types: [
      {
        description: 'PNG image',
        accept: { 'image/png': ['.png'] },
      },
    ],
  });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return 'file';
};

const getBrushOrigin = (x, y, size) => ({
  x: x - Math.floor(size / 2),
  y: y - Math.floor(size / 2),
});

const LANGUAGES = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
  { code: 'ja', flag: '🇯🇵', label: '日本語' },
  { code: 'zh', flag: '🇨🇳', label: '中文' },
];

const I18N = {
  en: {
    title: 'Gridloom Pixel Studio',
    intro: 'Load a folder or individual images, then generate and save anchored pixel-sampled results.',
    folderConnect: 'Folder Connect',
    imageRegister: 'Image Upload',
    workspaceDirection: 'Workspace Direction',
    horizontal: 'Horizontal',
    vertical: 'Vertical',
    brushSize: 'Brush Size',
    colorCount: 'Color Count',
    anchor: 'Anchor',
    anchorHelp: 'Click the Before image to regenerate After from that anchor point.',
    saveToFolder: 'Save to Folder',
    saveAsFile: 'Save as File',
    fullscreenCompare: 'Fullscreen Compare',
    gallery: 'Gallery',
    completed: 'Completed',
    beforeAfter: 'Before / After',
    before: 'Before',
    after: 'After',
    compare: 'Compare',
    close: 'Close',
    saved: 'saved',
    colors: 'colors',
    noAnchor: 'x: -, y: -',
    initialStatus: 'Connect a folder or upload images first.',
    imageLoadFailed: 'Image load failed',
    pngImage: 'PNG image',
    folderApiUnsupported: 'This browser does not support the folder connection API. Use the fallback upload below.',
    folderLoaded: (count) => `Loaded ${count} image(s) from the folder.`,
    galleryLoaded: (count) => `Gallery refreshed with ${count} image(s) from the connected folder.`,
    folderError: (message) => `Folder connection was cancelled or failed: ${message}`,
    imageRegistered: (name) => `Loaded ${name}. This image is ready for direct editing and is not added to the gallery.`,
    itemSelected: (name) => `${name} selected. Click the Before image to generate After.`,
    afterGenerated: (name, width, height, destination) =>
      `${name}: After generated (${width}×${height}px). Save to ${destination}.`,
    destinationFolder: 'the connected folder',
    destinationFile: 'a single file',
    folderSaved: (name) => `Saved ${name} to the source folder.`,
    fileSaved: (name) => `Saved ${name}.`,
    fileDownloaded: (name) => `Started downloading ${name}.`,
    saveError: (message) => `Save was cancelled or failed: ${message}`,
    compareLabel: (beforeSize, afterSize) => `Before ${beforeSize} / After ${afterSize}`,
    magnifierLabel: (size, zoom, x, y) => `${size}×${size} · ${zoom}x zoom · x:${x}, y:${y}`,
  },
  ko: {
    title: '그리드룸 픽셀 스튜디오',
    intro: '폴더나 개별 이미지를 불러오고, 픽커 기준으로 픽셀 스냅 결과를 생성/저장하세요.',
    folderConnect: '폴더 연결',
    imageRegister: '이미지 등록',
    workspaceDirection: '작업대 방향',
    horizontal: '가로',
    vertical: '세로',
    brushSize: '브러시 크기',
    colorCount: '색상 수',
    anchor: 'Anchor',
    anchorHelp: 'Before 이미지를 클릭하면 해당 지점을 기준으로 After 이미지를 다시 생성합니다.',
    saveToFolder: '폴더에 저장',
    saveAsFile: '파일로 저장',
    fullscreenCompare: '전체 비교',
    gallery: '갤러리',
    completed: '완성',
    beforeAfter: 'Before / After',
    before: 'Before',
    after: 'After',
    compare: '비교',
    close: '닫기',
    saved: 'saved',
    colors: 'colors',
    noAnchor: 'x: -, y: -',
    initialStatus: '먼저 폴더를 연결하거나 이미지를 등록해주세요.',
    imageLoadFailed: '이미지 로드 실패',
    pngImage: 'PNG 이미지',
    folderApiUnsupported: '현재 브라우저는 폴더 연결 API를 지원하지 않습니다. 아래 대체 업로드를 사용하세요.',
    folderLoaded: (count) => `${count}개 이미지를 폴더에서 불러왔습니다.`,
    galleryLoaded: (count) => `연결 폴더에서 ${count}개 이미지를 갤러리에 표시했습니다.`,
    folderError: (message) => `폴더 연결이 취소되었거나 실패했습니다: ${message}`,
    imageRegistered: (name) => `${name} 이미지를 바로 작업대로 불러왔습니다. 갤러리에는 추가하지 않습니다.`,
    itemSelected: (name) => `${name} 선택됨. Before 이미지에서 위치를 클릭하면 After가 생성됩니다.`,
    afterGenerated: (name, width, height, destination) =>
      `${name}: After 생성 완료 (${width}×${height}px). ${destination}에 저장하세요.`,
    destinationFolder: '연결 폴더',
    destinationFile: '단일 파일',
    folderSaved: (name) => `${name} 파일로 원본 폴더에 저장했습니다.`,
    fileSaved: (name) => `${name} 파일로 저장했습니다.`,
    fileDownloaded: (name) => `${name} 파일 다운로드를 시작했습니다.`,
    saveError: (message) => `저장이 취소되었거나 실패했습니다: ${message}`,
    compareLabel: (beforeSize, afterSize) => `Before ${beforeSize} / After ${afterSize}`,
    magnifierLabel: (size, zoom, x, y) => `${size}×${size} · ${zoom}x zoom · x:${x}, y:${y}`,
  },
  ja: {
    title: 'グリッドルーム・ピクセルスタジオ',
    intro: 'フォルダーまたは画像を読み込み、アンカー基準でピクセル結果を生成して保存します。',
    folderConnect: 'フォルダー接続',
    imageRegister: '画像登録',
    workspaceDirection: '作業台の向き',
    horizontal: '横',
    vertical: '縦',
    brushSize: 'ブラシサイズ',
    colorCount: '色数',
    anchor: 'アンカー',
    anchorHelp: 'Before画像をクリックすると、その点を基準にAfterを再生成します。',
    saveToFolder: 'フォルダーに保存',
    saveAsFile: 'ファイル保存',
    fullscreenCompare: '全画面比較',
    gallery: 'ギャラリー',
    completed: '完了',
    beforeAfter: 'Before / After',
    before: 'Before',
    after: 'After',
    compare: '比較',
    close: '閉じる',
    saved: 'saved',
    colors: 'colors',
    noAnchor: 'x: -, y: -',
    initialStatus: 'フォルダーを接続するか、画像を登録してください。',
    imageLoadFailed: '画像の読み込みに失敗しました',
    pngImage: 'PNG画像',
    folderApiUnsupported: 'このブラウザーはフォルダー接続APIに対応していません。代替アップロードを使用してください。',
    folderLoaded: (count) => `${count}枚の画像をフォルダーから読み込みました。`,
    galleryLoaded: (count) => `接続フォルダーから${count}枚の画像をギャラリーに表示しました。`,
    folderError: (message) => `フォルダー接続がキャンセルまたは失敗しました: ${message}`,
    imageRegistered: (name) => `${name} を直接作業台に読み込みました。ギャラリーには追加しません。`,
    itemSelected: (name) => `${name} を選択しました。Before画像をクリックするとAfterを生成します。`,
    afterGenerated: (name, width, height, destination) =>
      `${name}: After生成完了 (${width}×${height}px)。${destination}に保存できます。`,
    destinationFolder: '接続フォルダー',
    destinationFile: '単一ファイル',
    folderSaved: (name) => `${name} を元のフォルダーに保存しました。`,
    fileSaved: (name) => `${name} を保存しました。`,
    fileDownloaded: (name) => `${name} のダウンロードを開始しました。`,
    saveError: (message) => `保存がキャンセルまたは失敗しました: ${message}`,
    compareLabel: (beforeSize, afterSize) => `Before ${beforeSize} / After ${afterSize}`,
    magnifierLabel: (size, zoom, x, y) => `${size}×${size} · ${zoom}x zoom · x:${x}, y:${y}`,
  },
  zh: {
    title: 'Gridloom 像素工作室',
    intro: '加载文件夹或单张图片，并基于锚点生成、保存像素采样结果。',
    folderConnect: '连接文件夹',
    imageRegister: '添加图片',
    workspaceDirection: '工作区方向',
    horizontal: '横向',
    vertical: '纵向',
    brushSize: '画笔大小',
    colorCount: '颜色数量',
    anchor: '锚点',
    anchorHelp: '点击 Before 图片，会以该点为基准重新生成 After。',
    saveToFolder: '保存到文件夹',
    saveAsFile: '另存为文件',
    fullscreenCompare: '全屏比较',
    gallery: '图库',
    completed: '完成',
    beforeAfter: 'Before / After',
    before: 'Before',
    after: 'After',
    compare: '比较',
    close: '关闭',
    saved: 'saved',
    colors: 'colors',
    noAnchor: 'x: -, y: -',
    initialStatus: '请先连接文件夹或添加图片。',
    imageLoadFailed: '图片加载失败',
    pngImage: 'PNG 图片',
    folderApiUnsupported: '当前浏览器不支持文件夹连接 API。请使用下方的备用上传。',
    folderLoaded: (count) => `已从文件夹加载 ${count} 张图片。`,
    galleryLoaded: (count) => `已从连接的文件夹刷新 ${count} 张图片到图库。`,
    folderError: (message) => `文件夹连接已取消或失败: ${message}`,
    imageRegistered: (name) => `已将 ${name} 直接加载到工作区，不会添加到图库。`,
    itemSelected: (name) => `已选择 ${name}。点击 Before 图片即可生成 After。`,
    afterGenerated: (name, width, height, destination) =>
      `${name}: After 已生成 (${width}×${height}px)。可保存到${destination}。`,
    destinationFolder: '连接的文件夹',
    destinationFile: '单个文件',
    folderSaved: (name) => `已将 ${name} 保存到原文件夹。`,
    fileSaved: (name) => `已保存 ${name}。`,
    fileDownloaded: (name) => `已开始下载 ${name}。`,
    saveError: (message) => `保存已取消或失败: ${message}`,
    compareLabel: (beforeSize, afterSize) => `Before ${beforeSize} / After ${afterSize}`,
    magnifierLabel: (size, zoom, x, y) => `${size}×${size} · ${zoom}x zoom · x:${x}, y:${y}`,
  },
};

function App() {
  const beforeCanvasRef = useRef(null);
  const afterCanvasRef = useRef(null);
  const magnifierCanvasRef = useRef(null);

  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [items, setItems] = useState([]);
  const [singleItem, setSingleItem] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [language, setLanguage] = useState('en');
  const [activeTab, setActiveTab] = useState('gallery');
  const [workspaceLayout, setWorkspaceLayout] = useState('horizontal');
  const [anchor, setAnchor] = useState(null);
  const [brushSize, setBrushSize] = useState(3);
  const [colorCount, setColorCount] = useState(16);
  const [status, setStatus] = useState(I18N.en.initialStatus);
  const [unsaved, setUnsaved] = useState(false);
  const [pickerPreview, setPickerPreview] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareMode, setCompareMode] = useState('split');
  const [compareSplit, setCompareSplit] = useState(50);
  const [compareSnapshot, setCompareSnapshot] = useState(null);
  const [canvasSizes, setCanvasSizes] = useState({
    before: { width: 1024, height: 1024 },
    after: { width: 1024, height: 1024 },
  });

  const selectedItem = useMemo(
    () => (singleItem?.id === selectedId ? singleItem : items.find((it) => it.id === selectedId) || null),
    [items, selectedId, singleItem],
  );
  const text = I18N[language];

  const getBrushSize = () => Math.max(1, Math.round(Number(brushSize) || 1));
  const getColorStep = () => Math.max(1, Math.round(255 / (Math.max(2, Number(colorCount) || 16) - 1)));
  const getMagnifierZoom = (size) => Math.max(4, Math.min(18, Math.round(72 / Math.max(1, size))));

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

    setCanvasSizes({
      before: { width: beforeCanvas.width, height: beforeCanvas.height },
      after: { width: afterCanvas.width, height: afterCanvas.height },
    });
  };

  useEffect(() => {
    renderWorkspace();
  }, [selectedItem, anchor]);

  useEffect(() => {
    setPickerPreview(null);
  }, [selectedId]);

  useEffect(() => {
    if (!items.length) setStatus(text.initialStatus);
  }, [language]);

  const loadItems = async (list, msg) => {
    setItems(list);
    setSingleItem(null);
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
        source: 'directory',
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
        source: 'file',
        afterBlob: null,
        afterImage: null,
        saved: false,
        savedThumbDataUrl: null,
      });
    }
    return list;
  };

  const createItemFromFile = async (file, source = 'file') => {
    if (!file || !IMAGE_TYPES.has(file.type)) return null;
    const img = await blobToImage(file);
    return {
      id: `${source}-${Date.now()}`,
      name: file.name,
      beforeImage: img,
      thumbDataUrl: createThumbDataUrl(img),
      handle: null,
      source,
      afterBlob: null,
      afterImage: null,
      saved: false,
      savedThumbDataUrl: null,
    };
  };

  const handlePickFolder = async () => {
    if (!window.showDirectoryPicker) {
      setStatus(text.folderApiUnsupported);
      return;
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const list = await readImagesFromDirectory(handle);
      setDirectoryHandle(handle);
      await loadItems(list, text.folderLoaded(list.length));
    } catch (err) {
      setStatus(text.folderError(err.message));
    }
  };

  const handlePickImages = async (event) => {
    const file = Array.from(event.target.files || []).find((item) => IMAGE_TYPES.has(item.type));
    const item = await createItemFromFile(file, 'file');
    if (item) {
      setSingleItem(item);
      setSelectedId(item.id);
      setAnchor(null);
      setUnsaved(false);
      setActiveTab('gallery');
      setStatus(text.imageRegistered(item.name));
    }
    event.target.value = '';
  };

  const handleOpenGallery = async () => {
    setActiveTab('gallery');
    if (!directoryHandle) return;

    try {
      const list = await readImagesFromDirectory(directoryHandle);
      setSingleItem(null);
      await loadItems(list, text.galleryLoaded(list.length));
      setActiveTab('gallery');
    } catch (err) {
      setStatus(text.folderError(err.message));
    }
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

    setStatus(text.itemSelected(item.name));
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
    const origin = getBrushOrigin(x, y, size);

    const xStart = origin.x - Math.ceil(origin.x / size) * size;
    const yStart = origin.y - Math.ceil(origin.y / size) * size;
    const outputWidth = Math.ceil((beforeCanvas.width - xStart) / size);
    const outputHeight = Math.ceil((beforeCanvas.height - yStart) / size);
    const out = new ImageData(outputWidth, outputHeight);

    for (let outY = 0, gy = yStart; gy < beforeCanvas.height; outY++, gy += size) {
      for (let outX = 0, gx = xStart; gx < beforeCanvas.width; outX++, gx += size) {
        const sx = Math.min(beforeCanvas.width - 1, Math.max(0, gx));
        const sy = Math.min(beforeCanvas.height - 1, Math.max(0, gy));
        const sample = (sy * beforeCanvas.width + sx) * 4;

        const r = quantize(src.data[sample], step);
        const g = quantize(src.data[sample + 1], step);
        const b = quantize(src.data[sample + 2], step);
        const a = src.data[sample + 3];

        const idx = (outY * outputWidth + outX) * 4;
        out.data[idx] = r;
        out.data[idx + 1] = g;
        out.data[idx + 2] = b;
        out.data[idx + 3] = a;
      }
    }

    afterCanvas.width = outputWidth;
    afterCanvas.height = outputHeight;
    afterCtx.putImageData(out, 0, 0);
    setCanvasSizes({
      before: { width: beforeCanvas.width, height: beforeCanvas.height },
      after: { width: afterCanvas.width, height: afterCanvas.height },
    });

    const blob = await new Promise((resolve) => afterCanvas.toBlob(resolve, 'image/png'));
    const afterImage = await blobToImage(blob);

    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, afterBlob: blob, afterImage } : it)));
    setUnsaved(true);
    setStatus(text.afterGenerated(
      item.name,
      outputWidth,
      outputHeight,
      item.source === 'directory' ? text.destinationFolder : text.destinationFile,
    ));
  };

  const handleBeforeClick = async (event) => {
    if (!selectedItem) return;
    const canvas = beforeCanvasRef.current;
    const { x, y } = getCanvasPoint(canvas, event);

    setAnchor({ x, y });
    await processCurrentImage(x, y);
  };

  const getCanvasPoint = (canvas, event) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);

    return {
      x: Math.max(0, Math.min(canvas.width - 1, x)),
      y: Math.max(0, Math.min(canvas.height - 1, y)),
    };
  };

  const drawMagnifier = (x, y, size) => {
    const sourceCanvas = beforeCanvasRef.current;
    const previewCanvas = magnifierCanvasRef.current;
    if (!sourceCanvas || !previewCanvas) return 10;

    const previewSize = 150;
    const zoom = getMagnifierZoom(size);
    const sampleSize = Math.ceil(previewSize / zoom);
    const half = Math.floor(sampleSize / 2);
    const sx = Math.max(0, x - half);
    const sy = Math.max(0, y - half);
    const sw = Math.min(sampleSize, sourceCanvas.width - sx);
    const sh = Math.min(sampleSize, sourceCanvas.height - sy);
    const dx = (half - (x - sx)) * zoom;
    const dy = (half - (y - sy)) * zoom;
    const ctx = previewCanvas.getContext('2d');

    previewCanvas.width = previewSize;
    previewCanvas.height = previewSize;
    ctx.clearRect(0, 0, previewSize, previewSize);
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(0, 0, previewSize, previewSize);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, dx, dy, sw * zoom, sh * zoom);
    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(previewSize / 2, 0);
    ctx.lineTo(previewSize / 2, previewSize);
    ctx.moveTo(0, previewSize / 2);
    ctx.lineTo(previewSize, previewSize / 2);
    ctx.stroke();

    return zoom;
  };

  const handleBeforePointerMove = (event) => {
    if (!selectedItem) return;
    const canvas = beforeCanvasRef.current;
    const wrapper = event.currentTarget.parentElement;
    if (!canvas || !wrapper) return;

    const { x, y } = getCanvasPoint(canvas, event);
    const wrapperRect = wrapper.getBoundingClientRect();
    const boxSize = 172;
    const offset = 14;
    const maxLeft = Math.max(8, wrapperRect.width - boxSize - 8);
    const maxTop = Math.max(8, wrapperRect.height - boxSize - 8);
    const left = Math.min(Math.max(8, event.clientX - wrapperRect.left + offset), maxLeft);
    const top = Math.min(Math.max(8, event.clientY - wrapperRect.top + offset), maxTop);
    const canvasRect = canvas.getBoundingClientRect();
    const size = getBrushSize();
    const brushWidth = Math.max(1, size * (canvasRect.width / canvas.width));
    const brushHeight = Math.max(1, size * (canvasRect.height / canvas.height));
    const origin = getBrushOrigin(x, y, size);
    const brushLeft = canvasRect.left - wrapperRect.left + (origin.x / canvas.width) * canvasRect.width;
    const brushTop = canvasRect.top - wrapperRect.top + (origin.y / canvas.height) * canvasRect.height;

    const zoom = drawMagnifier(x, y, size);
    setPickerPreview({
      x,
      y,
      left,
      top,
      brushLeft,
      brushTop,
      brushWidth,
      brushHeight,
      brushZoomSize: size * zoom,
      brushZoomLeft: 75 - (x - origin.x) * zoom,
      brushZoomTop: 75 - (y - origin.y) * zoom,
      magnifierZoom: zoom,
      cellCount: size,
    });
  };

  const handleSave = async () => {
    if (!selectedItem || !selectedItem.afterBlob) return;

    const outputName = makeOutputName(selectedItem.name);

    try {
      if (selectedItem.handle && directoryHandle) {
        const writableHandle = await directoryHandle.getFileHandle(outputName, { create: true });
        const writable = await writableHandle.createWritable();
        await writable.write(selectedItem.afterBlob);
        await writable.close();
        setStatus(text.folderSaved(outputName));
      } else {
        const result = await saveBlobAsFile(selectedItem.afterBlob, outputName);
        setStatus(
          result === 'file'
            ? text.fileSaved(outputName)
            : text.fileDownloaded(outputName),
        );
      }
    } catch (err) {
      setStatus(text.saveError(err.message));
      return;
    }

    setItems((prev) =>
      prev.map((it) =>
        it.id === selectedItem.id
          ? { ...it, saved: true, savedThumbDataUrl: createThumbDataUrl(it.afterImage) }
          : it,
      ),
    );
    if (singleItem?.id === selectedItem.id) {
      setSingleItem((prev) =>
        prev && prev.afterImage ? { ...prev, saved: true, savedThumbDataUrl: createThumbDataUrl(prev.afterImage) } : prev,
      );
    }
    setUnsaved(false);
    if (selectedItem.source !== 'file') setActiveTab('completed');
  };

  const handleOpenCompare = () => {
    const beforeCanvas = beforeCanvasRef.current;
    const afterCanvas = afterCanvasRef.current;
    if (!selectedItem || !beforeCanvas || !afterCanvas || !selectedItem.afterImage) return;

    setCompareSnapshot({
      beforeUrl: createImageDataUrl(selectedItem.beforeImage),
      afterUrl: createImageDataUrl(selectedItem.afterImage),
      beforeSize: `${beforeCanvas.width}×${beforeCanvas.height}`,
      afterSize: `${afterCanvas.width}×${afterCanvas.height}`,
      name: selectedItem.name,
    });
    setCompareMode('split');
    setCompareSplit(50);
    setCompareOpen(true);
  };

  const canSave = Boolean(selectedItem && selectedItem.afterBlob && unsaved);
  const canCompare = Boolean(selectedItem && selectedItem.afterImage);
  const completedItems = items.filter((it) => it.saved && it.savedThumbDataUrl);

  return (
    <main className="layout">
      <section className="panel controls">
        <div className="language-picker" aria-label="Language">
          {LANGUAGES.map((item) => (
            <button
              key={item.code}
              className={language === item.code ? 'active' : ''}
              type="button"
              title={item.label}
              aria-label={item.label}
              onClick={() => setLanguage(item.code)}
            >
              {item.flag}
            </button>
          ))}
        </div>

        <h1>{text.title}</h1>
        <p className="muted">{text.intro}</p>

        <div className="actions stack">
          <button onClick={handlePickFolder}>{text.folderConnect}</button>
          <label className="file-fallback secondary" htmlFor="imageInput">{text.imageRegister}</label>
          <input id="imageInput" name="image" type="file" accept="image/*" onChange={handlePickImages} />
        </div>

        <div className="field">
          <span>{text.workspaceDirection}</span>
          <div className="segmented">
            <button
              className={workspaceLayout === 'horizontal' ? 'active' : ''}
              type="button"
              onClick={() => setWorkspaceLayout('horizontal')}
            >
              {text.horizontal}
            </button>
            <button
              className={workspaceLayout === 'vertical' ? 'active' : ''}
              type="button"
              onClick={() => setWorkspaceLayout('vertical')}
            >
              {text.vertical}
            </button>
          </div>
        </div>

        <div className="field">
          <span>{text.brushSize}</span>
          <input name="brushSize" type="range" min="1" max="16" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
          <div className="pill">{brushSize}×{brushSize} ({brushSize * brushSize}px)</div>
        </div>

        <div className="field">
          <span>{text.colorCount}</span>
          <input name="colorCount" type="range" min="2" max="64" value={colorCount} onChange={(e) => setColorCount(Number(e.target.value))} />
          <div className="pill">{colorCount} {text.colors}</div>
        </div>

        <div className="field">
          <span>{text.anchor}</span>
          <p className="muted small">{text.anchorHelp}</p>
          <div className="pill">{anchor ? `x: ${anchor.x}, y: ${anchor.y}` : text.noAnchor}</div>
        </div>

        <div className="actions">
          <button disabled={!canSave} onClick={handleSave}>
            {selectedItem?.source === 'directory' ? text.saveToFolder : text.saveAsFile}
          </button>
          <button className="secondary" disabled={!canCompare} onClick={handleOpenCompare}>
            {text.fullscreenCompare}
          </button>
        </div>

        <p className="status">{status}</p>
      </section>

      <section className="panel workspace">
        <div className="tab-row">
          <button className={`tab ${activeTab === 'gallery' ? 'active' : ''}`} onClick={handleOpenGallery}>{text.gallery}</button>
          <button className={`tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>{text.completed}</button>
        </div>

        <div className={`gallery-grid ${activeTab !== 'gallery' ? 'hidden' : ''}`}>
          {items.map((item) => (
            <button key={item.id} className={`thumb-card ${item.id === selectedId ? 'active' : ''}`} onClick={() => selectItem(item)}>
              <img src={item.thumbDataUrl} alt={item.name} />
              <span>{item.name}</span>
              {item.saved ? <b>{text.saved}</b> : null}
            </button>
          ))}
        </div>

        <div className={`gallery-grid ${activeTab !== 'completed' ? 'hidden' : ''}`}>
          {completedItems.map((item) => (
            <button key={`${item.id}-done`} className="thumb-card" onClick={() => setSelectedId(item.id)}>
              <img src={item.savedThumbDataUrl} alt={`${item.name} saved`} />
              <span>{item.name}</span>
              <b>{text.saved}</b>
            </button>
          ))}
        </div>

        <div className="compare-title">{text.beforeAfter}</div>
        <div className={`compare-grid ${workspaceLayout === 'vertical' ? 'vertical' : 'horizontal'}`}>
          <div className="compare-panel">
            <h2>{text.before}</h2>
            <div className={`canvas-wrap ${pickerPreview ? 'picking' : ''}`}>
              <canvas
                ref={beforeCanvasRef}
                onClick={handleBeforeClick}
                onPointerMove={handleBeforePointerMove}
                onPointerLeave={() => setPickerPreview(null)}
                width="1024"
                height="1024"
                style={{ aspectRatio: `${canvasSizes.before.width} / ${canvasSizes.before.height}` }}
              />
              {pickerPreview ? (
                <div
                  className="brush-preview"
                  style={{
                    left: pickerPreview.brushLeft,
                    top: pickerPreview.brushTop,
                    width: pickerPreview.brushWidth,
                    height: pickerPreview.brushHeight,
                    gridTemplateColumns: `repeat(${pickerPreview.cellCount}, 1fr)`,
                  }}
                >
                  {Array.from({ length: pickerPreview.cellCount * pickerPreview.cellCount }).map((_, index) => (
                    <span key={index} />
                  ))}
                </div>
              ) : null}
              <div
                className={`magnifier ${pickerPreview ? 'visible' : ''}`}
                style={{ left: pickerPreview?.left || 0, top: pickerPreview?.top || 0 }}
              >
                <div className="magnifier-stage">
                  <canvas ref={magnifierCanvasRef} width="150" height="150" />
                  {pickerPreview ? (
                    <div
                      className="magnifier-brush"
                      style={{
                        left: pickerPreview.brushZoomLeft,
                        top: pickerPreview.brushZoomTop,
                        width: pickerPreview.brushZoomSize,
                        height: pickerPreview.brushZoomSize,
                        gridTemplateColumns: `repeat(${pickerPreview.cellCount}, 1fr)`,
                      }}
                    >
                      {Array.from({ length: pickerPreview.cellCount * pickerPreview.cellCount }).map((_, index) => (
                        <span key={index} />
                      ))}
                    </div>
                  ) : null}
                </div>
                <span>
                  {pickerPreview
                    ? text.magnifierLabel(pickerPreview.cellCount, pickerPreview.magnifierZoom, pickerPreview.x, pickerPreview.y)
                    : text.noAnchor}
                </span>
              </div>
            </div>
          </div>
          <div className="compare-panel">
            <h2>{text.after}</h2>
            <canvas
              ref={afterCanvasRef}
              width="1024"
              height="1024"
              style={{ aspectRatio: `${canvasSizes.after.width} / ${canvasSizes.after.height}` }}
            />
          </div>
        </div>
      </section>
      {compareOpen && compareSnapshot ? (
        <div className="compare-fullscreen" role="dialog" aria-modal="true" aria-label={text.fullscreenCompare}>
          <div className="compare-fullscreen-toolbar">
            <div>
              <strong>{compareSnapshot.name}</strong>
              <span>{text.compareLabel(compareSnapshot.beforeSize, compareSnapshot.afterSize)}</span>
            </div>
            <div className="compare-mode-buttons">
              <button className={compareMode === 'before' ? 'active' : ''} type="button" onClick={() => setCompareMode('before')}>
                {text.before}
              </button>
              <button className={compareMode === 'split' ? 'active' : ''} type="button" onClick={() => setCompareMode('split')}>
                {text.compare}
              </button>
              <button className={compareMode === 'after' ? 'active' : ''} type="button" onClick={() => setCompareMode('after')}>
                {text.after}
              </button>
              <button type="button" onClick={() => setCompareOpen(false)}>
                {text.close}
              </button>
            </div>
          </div>

          <div className={`compare-fullscreen-stage mode-${compareMode}`}>
            <img className="compare-fullscreen-img before-img" src={compareSnapshot.beforeUrl} alt={text.before} draggable="false" />
            <div className="after-clip" style={{ clipPath: compareMode === 'split' ? `inset(0 0 0 ${compareSplit}%)` : undefined }}>
              <img className="compare-fullscreen-img after-img" src={compareSnapshot.afterUrl} alt={text.after} draggable="false" />
            </div>
            {compareMode === 'split' ? (
              <div className="split-handle" style={{ left: `${compareSplit}%` }} />
            ) : null}
          </div>

          <div className="compare-fullscreen-slider">
            <span>{text.before}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={compareSplit}
              onChange={(event) => {
                setCompareMode('split');
                setCompareSplit(Number(event.target.value));
              }}
            />
            <span>{text.after}</span>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
