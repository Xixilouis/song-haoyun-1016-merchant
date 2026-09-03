/* Local poster composition: only merchant-confirmed text, no invented metrics. */
window.WfdPosterRenderer = (() => {
  let photoPromise;
  const cache = new Map();
  function sourcePhoto() {
    if (!photoPromise) photoPromise = new Promise((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => { photoPromise = null; reject(new Error('活动图片加载超时，请检查网络后重试')); }, 25000);
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); photoPromise = null; reject(new Error('活动图片未加载，请检查网络后重试')); };
      image.src = 'song-haoyun-assets/2026-public-welfare-story-vertical-web.jpg';
    });
    return photoPromise;
  }
  function lines(ctx, text, width) {
    const output = [];
    for (const paragraph of String(text).split('\n')) {
      let line = '';
      for (const character of paragraph) {
        if (line && ctx.measureText(line + character).width > width) {
          // Keep Chinese closing punctuation with the preceding character.
          if (/[，。！？；：、）》”’]/.test(character) && line.length > 1) {
            const characters = [...line]; const last = characters.pop();
            output.push(characters.join('')); line = last;
          } else { output.push(line); line = ''; }
        }
        line += character;
      }
      output.push(line);
    }
    return output;
  }
  function fitText(ctx, text, { x, y, width, height, size, weight = 400, color = '#0875c9', leading = 1.6 }) {
    let rows;
    do {
      ctx.font = `${weight} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      rows = lines(ctx, text, width);
      if (rows.length * size * leading <= height) break;
      size -= 1;
    } while (size > 20);
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    rows.forEach((line, index) => ctx.fillText(line, x, y + index * size * leading));
  }
  async function compose(content) {
    const image = await sourcePhoto();
    // Network fonts must never block making or saving a merchant's poster.
    const horizontal = content.version === 'horizontal';
    const canvas = document.createElement('canvas');
    canvas.width = horizontal ? 1920 : 1080;
    canvas.height = horizontal ? 1080 : 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前浏览器暂不支持海报制作');
    ctx.fillStyle = '#f3faff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (horizontal) {
      const gradient = ctx.createLinearGradient(0, 0, 820, 980);
      gradient.addColorStop(0, '#0b9fe9'); gradient.addColorStop(1, '#0876cb');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 840, 1080);
      // Reuse the supplied campaign photography, not the sample merchant's figures or QR.
      ctx.drawImage(image, 0, 0, image.width, image.width * .7, 885, 75, 980, 686);
      fitText(ctx, '2026 世界粮食日', { x: 70, y: 85, width: 700, height: 75, size: 36, color: '#fff', weight: 700 });
      fitText(ctx, '让小店的善意\n被更多人看见', { x: 70, y: 210, width: 700, height: 300, size: 82, color: '#fff', weight: 700, leading: 1.4 });
      ctx.fillStyle = '#ffd400'; ctx.fillRect(70, 605, 700, 160);
      fitText(ctx, content.storeName, { x: 100, y: 632, width: 640, height: 110, size: 48, color: '#725400', weight: 700, leading: 1.15 });
      fitText(ctx, '做好事，让善意融入日常。', { x: 70, y: 850, width: 700, height: 90, size: 36, color: '#fff' });
      fitText(ctx, '关注乡村儿童成长\n一起传递温暖与希望', { x: 930, y: 830, width: 900, height: 170, size: 46, weight: 700, leading: 1.5 });
    } else {
      ctx.drawImage(image, 0, 0, image.width, image.width * .71, 0, 0, 1080, 767);
      ctx.fillStyle = '#ffd400'; ctx.fillRect(48, 805, 316, 58);
      fitText(ctx, '商家公益故事', { x: 70, y: 815, width: 280, height: 48, size: 30, weight: 700, color: '#725400' });
      fitText(ctx, '我们为什么加入公益', { x: 48, y: 910, width: 984, height: 85, size: 62, weight: 700 });
      fitText(ctx, content.storeName, { x: 48, y: 1010, width: 984, height: 75, size: 36, weight: 700, leading: 1.2 });
      fitText(ctx, content.story, { x: 48, y: 1110, width: 984, height: 620, size: content.style === '简洁有力' ? 43 : 40, leading: 1.65 });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 1810, 1080, 110);
      fitText(ctx, '2026 世界粮食日 · 让善意被看见', { x: 48, y: 1844, width: 984, height: 65, size: 30, weight: 700 });
    }
    return canvas;
  }
  function render(poster) {
    const key = JSON.stringify(poster.content);
    if (!cache.has(key)) {
      const pending = compose(poster.content).catch(error => { cache.delete(key); throw error; });
      cache.set(key, pending);
      if (cache.size > 8) cache.delete(cache.keys().next().value);
    }
    return cache.get(key);
  }
  async function paint(root, posters) {
    await Promise.all([...root.querySelectorAll('[data-wfd-poster-canvas]')].map(async target => {
      const poster = posters.get(target.dataset.wfdPosterCanvas);
      if (!poster?.content) return;
      try {
        const rendered = await render(poster);
        target.width = rendered.width; target.height = rendered.height;
        target.getContext('2d').drawImage(rendered, 0, 0);
      } catch (error) {
        const status = target.closest('button')?.querySelector('span');
        if (status) status.textContent = error.message;
      }
    }));
  }
  async function download(poster) {
    const canvas = await render(poster);
    const blob = await new Promise((resolve, reject) => {
      try { canvas.toBlob(value => value ? resolve(value) : reject(new Error('图片保存失败，请重试')), 'image/png'); }
      catch { reject(new Error('请通过网页链接打开后保存海报')); }
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = poster.filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return { render, paint, download };
})();
