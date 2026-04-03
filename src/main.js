import './style.css';

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Local Watermark Studio</p>
        <h1>营业执照水印助手</h1>
        <p class="hero-copy">
          上传执照或身份证图片，输入水印内容，浏览器会在本地直接生成带水印图片，不经过服务器。
        </p>
      </div>
      <div class="hero-badge">仅本地处理</div>
    </header>

    <main class="workspace">
      <section class="panel controls-panel">
        <label class="upload-card" for="imageInput">
          <input id="imageInput" type="file" accept="image/*" />
          <span class="upload-title">上传图片</span>
          <span class="upload-tip">支持 jpg、png、webp，建议原图宽度不低于 1200px</span>
        </label>

        <div class="field">
          <label for="watermarkText">水印内容</label>
          <textarea
            id="watermarkText"
            rows="4"
            placeholder="例如：仅供XX银行开户使用\n2026-04-03\n经办人：张三"
          >仅供业务办理使用</textarea>
        </div>

        <div class="grid two-up">
          <div class="field">
            <label for="opacityRange">透明度</label>
            <input id="opacityRange" type="range" min="0.08" max="0.45" step="0.01" value="0.22" />
            <span id="opacityValue" class="field-value">22%</span>
          </div>
          <div class="field">
            <label for="fontSizeRange">字号</label>
            <div class="size-control-row">
              <input id="fontSizeRange" type="range" min="20" max="80" step="1" value="48" />
              <input id="fontSizeInput" class="number-input" type="number" min="20" max="80" step="1" value="48" />
            </div>
            <span id="fontSizeValue" class="field-value">48px</span>
          </div>
        </div>

        <div class="grid two-up">
          <div class="field">
            <label for="gapRange">间距</label>
            <input id="gapRange" type="range" min="140" max="340" step="10" value="220" />
            <span id="gapValue" class="field-value">220px</span>
          </div>
          <div class="field">
            <label for="rotationRange">旋转角度</label>
            <input id="rotationRange" type="range" min="-60" max="60" step="1" value="-28" />
            <span id="rotationValue" class="field-value">-28°</span>
          </div>
        </div>

        <div class="grid two-up color-grid">
          <div class="field">
            <label for="colorPreset">字体颜色</label>
            <select id="colorPreset" class="select-input">
              <option value="#a02626" selected>执照红</option>
              <option value="#6b6b6b">示例灰</option>
              <option value="#2d2d2d">深灰黑</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <div class="field">
            <label for="colorInput">自定义颜色</label>
            <div class="color-picker-row">
              <input id="colorInput" type="color" value="#a02626" />
              <span id="colorValue" class="field-value">#A02626</span>
            </div>
          </div>
        </div>

        <div class="actions">
          <button id="renderButton" class="primary">生成水印图</button>
          <button id="downloadButton" class="secondary" disabled>下载图片</button>
        </div>

        <p id="statusText" class="status">请先上传一张图片。</p>
      </section>

      <section class="panel preview-panel">
        <div class="preview-header">
          <h2>实时预览</h2>
          <span id="imageMeta">未加载图片</span>
        </div>
        <div class="preview-stage">
          <canvas id="previewCanvas"></canvas>
          <div id="emptyState" class="empty-state">
            <strong>等待图片</strong>
            <span>上传后会在这里展示处理结果</span>
          </div>
        </div>
      </section>
    </main>
  </div>
`;

const imageInput = document.querySelector('#imageInput');
const watermarkText = document.querySelector('#watermarkText');
const opacityRange = document.querySelector('#opacityRange');
const fontSizeRange = document.querySelector('#fontSizeRange');
const fontSizeInput = document.querySelector('#fontSizeInput');
const gapRange = document.querySelector('#gapRange');
const rotationRange = document.querySelector('#rotationRange');
const colorPreset = document.querySelector('#colorPreset');
const colorInput = document.querySelector('#colorInput');
const opacityValue = document.querySelector('#opacityValue');
const fontSizeValue = document.querySelector('#fontSizeValue');
const gapValue = document.querySelector('#gapValue');
const rotationValue = document.querySelector('#rotationValue');
const colorValue = document.querySelector('#colorValue');
const renderButton = document.querySelector('#renderButton');
const downloadButton = document.querySelector('#downloadButton');
const statusText = document.querySelector('#statusText');
const imageMeta = document.querySelector('#imageMeta');
const previewCanvas = document.querySelector('#previewCanvas');
const emptyState = document.querySelector('#emptyState');

const canvasContext = previewCanvas.getContext('2d');
const sourceImage = new Image();
let sourceFileName = 'watermarked-license';
let hasImage = false;

function setRangeLabels() {
  opacityValue.textContent = `${Math.round(Number(opacityRange.value) * 100)}%`;
  fontSizeValue.textContent = `${fontSizeRange.value}px`;
  fontSizeInput.value = fontSizeRange.value;
  gapValue.textContent = `${gapRange.value}px`;
  rotationValue.textContent = `${rotationRange.value}°`;
  colorValue.textContent = colorInput.value.toUpperCase();
}

function setEmptyStateVisible(isVisible) {
  emptyState.hidden = !isVisible;
  emptyState.classList.toggle('is-hidden', !isVisible);
}

function hexToRgba(hexColor, opacity) {
  const normalizedHex = hexColor.replace('#', '');
  const safeHex = normalizedHex.length === 3
    ? normalizedHex.split('').map((char) => `${char}${char}`).join('')
    : normalizedHex;
  const red = Number.parseInt(safeHex.slice(0, 2), 16);
  const green = Number.parseInt(safeHex.slice(2, 4), 16);
  const blue = Number.parseInt(safeHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function getSelectedColor() {
  return colorPreset.value === 'custom' ? colorInput.value : colorPreset.value;
}

function wrapWatermarkLines() {
  return watermarkText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function drawCanvas() {
  if (!hasImage) {
    return;
  }

  const width = sourceImage.naturalWidth;
  const height = sourceImage.naturalHeight;
  previewCanvas.width = width;
  previewCanvas.height = height;
  setEmptyStateVisible(false);

  canvasContext.clearRect(0, 0, width, height);
  canvasContext.drawImage(sourceImage, 0, 0, width, height);

  const lines = wrapWatermarkLines();
  if (!lines.length) {
    statusText.textContent = '请输入至少一行水印内容。';
    downloadButton.disabled = true;
    return;
  }

  const fontSize = Number(fontSizeRange.value);
  const gap = Number(gapRange.value);
  const rotation = (Number(rotationRange.value) * Math.PI) / 180;
  const opacity = Number(opacityRange.value);
  const lineHeight = fontSize * 1.4;
  const watermarkColor = getSelectedColor();

  canvasContext.save();
  canvasContext.fillStyle = hexToRgba(watermarkColor, opacity);
  canvasContext.font = `600 ${fontSize}px "Avenir Next", "PingFang SC", sans-serif`;
  canvasContext.textAlign = 'center';
  canvasContext.textBaseline = 'middle';

  const diagonal = Math.sqrt(width * width + height * height);
  const tileStepX = gap;
  const tileStepY = gap * 0.82;

  canvasContext.translate(width / 2, height / 2);
  canvasContext.rotate(rotation);

  for (let x = -diagonal; x <= diagonal; x += tileStepX) {
    for (let y = -diagonal; y <= diagonal; y += tileStepY) {
      lines.forEach((line, index) => {
        canvasContext.fillText(line, x, y + index * lineHeight);
      });
    }
  }

  canvasContext.restore();
  statusText.textContent = '水印已生成，可以直接下载。';
  downloadButton.disabled = false;
}

function updatePreview() {
  setRangeLabels();
  if (hasImage) {
    drawCanvas();
  }
}

imageInput.addEventListener('change', (event) => {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  sourceFileName = file.name.replace(/\.[^.]+$/, '') || 'watermarked-license';
  const objectUrl = URL.createObjectURL(file);
  sourceImage.onload = () => {
    hasImage = true;
    imageMeta.textContent = `${sourceImage.naturalWidth} × ${sourceImage.naturalHeight}`;
    statusText.textContent = '图片加载完成，正在生成水印。';
    drawCanvas();
    URL.revokeObjectURL(objectUrl);
  };
  sourceImage.src = objectUrl;
});

[watermarkText, opacityRange, fontSizeRange, gapRange, rotationRange].forEach((element) => {
  element.addEventListener('input', updatePreview);
});

fontSizeInput.addEventListener('input', () => {
  const parsedValue = Number(fontSizeInput.value);
  const clampedValue = Math.min(80, Math.max(20, Number.isNaN(parsedValue) ? 34 : parsedValue));
  fontSizeRange.value = String(clampedValue);
  updatePreview();
});

colorPreset.addEventListener('change', () => {
  if (colorPreset.value !== 'custom') {
    colorInput.value = colorPreset.value;
  }
  updatePreview();
});

colorInput.addEventListener('input', () => {
  colorPreset.value = 'custom';
  updatePreview();
});

renderButton.addEventListener('click', () => {
  if (!hasImage) {
    statusText.textContent = '请先上传一张图片后再生成。';
    return;
  }
  drawCanvas();
});

downloadButton.addEventListener('click', () => {
  if (!hasImage) {
    return;
  }

  const link = document.createElement('a');
  link.download = `${sourceFileName}-watermarked.png`;
  link.href = previewCanvas.toDataURL('image/png');
  link.click();
});

setRangeLabels();
setEmptyStateVisible(true);
