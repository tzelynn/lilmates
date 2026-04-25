// @ts-check

(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  // --- State ---
  const PING_PONG = [0, 1, 2, 1];
  let frameIndex = 0;
  let catalogue = [];
  let state = null;
  let currentFrameUris = [];
  /** @type {{id: string, frameUris: string[]}[]} */
  let currentAccessoryUris = [];
  let idleTimer = null;
  const IDLE_TIMEOUT_MS = 3000;

  // --- DOM refs ---
  const catContainer = document.getElementById('cat-container');
  const typeCountEl = document.getElementById('type-count');
  const collectionBtn = document.getElementById('collection-btn');
  const collectionPanel = document.getElementById('collection-panel');
  const closeCollectionBtn = document.getElementById('close-collection');
  const collectionBackBtn = document.getElementById('collection-back');
  const collectionTitle = document.getElementById('collection-title');
  const collectionContent = document.getElementById('collection-content');
  const collectionProgress = document.getElementById('collection-progress');
  const gachaOverlay = document.getElementById('gacha-overlay');
  const gachaResultBanner = document.getElementById('gacha-result-banner');
  const gachaResultArt = document.getElementById('gacha-result-art');
  const gachaResultName = document.getElementById('gacha-result-name');
  const gachaCloseBtn = document.getElementById('gacha-close');

  /** @type {{mode: 'cats'} | {mode: 'accessories', catId: string}} */
  let collectionView = { mode: 'cats' };

  // --- Image preloading ---
  const imageCache = new Map();

  function preloadImage(uri) {
    if (imageCache.has(uri)) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = uri;
      imageCache.set(uri, img);
    });
  }

  async function preloadAll(frameUris, accessoryUris) {
    const uris = [...frameUris];
    for (const acs of accessoryUris) {
      uris.push(...acs.frameUris);
    }
    await Promise.all(uris.map(preloadImage));
  }

  function getActiveAccessoryId() {
    if (!state) {return null;}
    return state.activeAccessory[state.activeCat] ?? null;
  }

  // --- Rendering ---
  function renderCat() {
    catContainer.innerHTML = '';

    // Cat frames
    currentFrameUris.forEach((uri, i) => {
      const img = document.createElement('img');
      img.className = 'cat-frame' + (i === PING_PONG[frameIndex] ? ' active' : '');
      img.src = uri;
      img.draggable = false;
      img.dataset.frameIndex = String(i);
      catContainer.appendChild(img);
    });

    // Accessory frames (only the equipped one, one <img> per frame)
    const equippedId = getActiveAccessoryId();
    if (equippedId) {
      const acs = currentAccessoryUris.find((a) => a.id === equippedId);
      if (acs) {
        acs.frameUris.forEach((uri, i) => {
          const img = document.createElement('img');
          img.className =
            'accessory-frame' + (i === PING_PONG[frameIndex] ? ' active' : '');
          img.src = uri;
          img.draggable = false;
          img.dataset.frameIndex = String(i);
          img.dataset.accessoryId = equippedId;
          catContainer.appendChild(img);
        });
      }
    }
  }

  function showFrame(index) {
    const nodes = catContainer.querySelectorAll('.cat-frame, .accessory-frame');
    nodes.forEach((el) => {
      const i = Number(el.dataset.frameIndex);
      el.classList.toggle('active', i === index);
    });
  }

  function advanceFrame() {
    frameIndex = (frameIndex + 1) % PING_PONG.length;
    showFrame(PING_PONG[frameIndex]);
    resetIdleTimer();
  }

  function resetIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    idleTimer = setTimeout(() => {
      frameIndex = 0;
      showFrame(PING_PONG[0]);
    }, IDLE_TIMEOUT_MS);
  }

  // --- Controls ---
  function updateControls() {
    typeCountEl.textContent = state ? String(state.typeCount) : '0';
  }

  // --- Collection ---
  function renderCollection() {
    if (!state || !catalogue.length) {return;}

    // If we're in accessory view but the cat is no longer unlocked, bounce out.
    if (collectionView.mode === 'accessories') {
      const cat = catalogue.find((c) => c.id === collectionView.catId);
      if (!cat || !state.unlockedCats.includes(cat.id)) {
        collectionView = { mode: 'cats' };
      }
    }

    if (collectionView.mode === 'cats') {
      renderCatList();
    } else {
      renderAccessoryView(collectionView.catId);
    }
  }

  function renderCatList() {
    collectionContent.innerHTML = '';
    collectionBackBtn.classList.add('hidden');
    collectionTitle.textContent = 'Collection';

    const totalCats = catalogue.length;
    const unlockedCatCount = state.unlockedCats.length;
    const totalAcs = catalogue.reduce((sum, c) => sum + c.accessories.length, 0);
    const unlockedAcsCount = Object.values(state.unlockedAccessories)
      .reduce((sum, arr) => sum + arr.length, 0);
    const total = totalCats + totalAcs;
    const unlocked = unlockedCatCount + unlockedAcsCount;
    collectionProgress.textContent = `${unlocked} / ${total} unlocked`;

    catalogue.forEach((cat) => {
      const isUnlocked = state.unlockedCats.includes(cat.id);
      const isActive = state.activeCat === cat.id;

      const catDiv = document.createElement('div');
      catDiv.className = 'collection-cat' +
        (isActive ? ' active' : '') +
        (isUnlocked ? '' : ' locked');

      const header = document.createElement('div');
      header.className = 'collection-cat-header' +
        (isUnlocked ? '' : ' locked');

      const thumb = document.createElement('img');
      thumb.className = 'cat-thumb' + (isUnlocked ? '' : ' locked');
      if (isUnlocked && cat.thumbUri) {
        thumb.src = cat.thumbUri;
      }
      thumb.draggable = false;
      header.appendChild(thumb);

      const info = document.createElement('div');
      info.className = 'cat-header-info';

      const name = document.createElement('span');
      name.className = 'collection-cat-name';
      name.textContent = isUnlocked ? cat.displayName : '???';
      info.appendChild(name);

      if (isActive) {
        const badge = document.createElement('span');
        badge.className = 'active-indicator';
        badge.textContent = 'Active';
        info.appendChild(badge);
      } else if (isUnlocked && cat.accessories.length > 0) {
        const acsCount = state.unlockedAccessories[cat.id]?.length || 0;
        const badge = document.createElement('span');
        badge.className = 'cat-badge';
        badge.textContent = `${acsCount}/${cat.accessories.length} accessories`;
        info.appendChild(badge);
      } else if (!isUnlocked) {
        const badge = document.createElement('span');
        badge.className = 'cat-badge';
        badge.textContent = '🔒 Locked';
        info.appendChild(badge);
      }

      header.appendChild(info);

      if (isUnlocked && cat.accessories.length > 0) {
        const chevron = document.createElement('span');
        chevron.className = 'cat-chevron';
        chevron.textContent = '›';
        header.appendChild(chevron);
      }

      if (isUnlocked) {
        header.addEventListener('click', () => {
          if (!isActive) {
            vscode.postMessage({ type: 'select-cat', catId: cat.id });
          }
          if (cat.accessories.length > 0) {
            collectionView = { mode: 'accessories', catId: cat.id };
            renderCollection();
          }
        });
      }

      catDiv.appendChild(header);
      collectionContent.appendChild(catDiv);
    });
  }

  function renderAccessoryView(catId) {
    collectionContent.innerHTML = '';
    const cat = catalogue.find((c) => c.id === catId);
    if (!cat) {
      collectionView = { mode: 'cats' };
      renderCatList();
      return;
    }

    collectionBackBtn.classList.remove('hidden');
    collectionTitle.textContent = cat.displayName;

    const totalAcs = cat.accessories.length;
    const unlockedAcs = state.unlockedAccessories[cat.id]?.length || 0;
    collectionProgress.textContent = totalAcs
      ? `${unlockedAcs} / ${totalAcs} accessories`
      : 'No accessories';

    const equippedForCat = state.activeAccessory[cat.id] ?? null;

    const grid = document.createElement('div');
    grid.className = 'accessory-grid';

    grid.appendChild(buildAccessoryTile({
      cat,
      id: null,
      displayName: 'None',
      thumbUri: null,
      unlocked: true,
      active: equippedForCat === null,
      isNone: true,
    }));

    cat.accessories.forEach((acs) => {
      const acsUnlocked = !!state.unlockedAccessories[cat.id]?.includes(acs.id);
      grid.appendChild(buildAccessoryTile({
        cat,
        id: acs.id,
        displayName: acs.displayName,
        thumbUri: acs.thumbUri,
        thumbSvg: acs.thumbSvg,
        unlocked: acsUnlocked,
        active: equippedForCat === acs.id,
        isNone: false,
      }));
    });

    collectionContent.appendChild(grid);
  }

  function zoomSvgToContent(svgEl) {
    // Defer until attached + laid out so getBBox returns real geometry.
    requestAnimationFrame(() => {
      try {
        const bbox = svgEl.getBBox();
        if (!bbox || bbox.width <= 0 || bbox.height <= 0) {return;}
        const pad = Math.max(bbox.width, bbox.height) * 0.12;
        const side = Math.max(bbox.width, bbox.height) + pad * 2;
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        const vx = cx - side / 2;
        const vy = cy - side / 2;
        svgEl.setAttribute('viewBox', `${vx} ${vy} ${side} ${side}`);
      } catch {
        // Ignore; fallback is the original SVG rendering.
      }
    });
  }

  function buildAccessoryTile({ cat, id, displayName, thumbUri, thumbSvg, unlocked, active, isNone }) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'accessory-tile' +
      (active ? ' active' : '') +
      (unlocked ? '' : ' locked');
    tile.disabled = !unlocked;

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'accessory-thumb-wrap' + (unlocked ? '' : ' locked');
    if (isNone) {
      const noneMark = document.createElement('span');
      noneMark.className = 'accessory-thumb-none';
      noneMark.textContent = '∅';
      thumbWrap.appendChild(noneMark);
    } else if (unlocked && thumbSvg) {
      const svgHolder = document.createElement('div');
      svgHolder.className = 'accessory-thumb';
      svgHolder.innerHTML = thumbSvg;
      const svgEl = svgHolder.querySelector('svg');
      if (svgEl) {
        svgEl.classList.add('accessory-thumb-svg');
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        zoomSvgToContent(svgEl);
      }
      thumbWrap.appendChild(svgHolder);
    } else if (unlocked && thumbUri) {
      const img = document.createElement('img');
      img.className = 'accessory-thumb';
      img.src = thumbUri;
      img.draggable = false;
      thumbWrap.appendChild(img);
    } else {
      const lock = document.createElement('span');
      lock.className = 'accessory-thumb-lock';
      lock.textContent = '🔒';
      thumbWrap.appendChild(lock);
    }
    tile.appendChild(thumbWrap);

    const label = document.createElement('span');
    label.className = 'accessory-tile-name';
    label.textContent = unlocked ? displayName : '???';
    tile.appendChild(label);

    if (active) {
      const badge = document.createElement('span');
      badge.className = 'accessory-tile-badge';
      badge.textContent = 'Equipped';
      tile.appendChild(badge);
    }

    tile.addEventListener('click', () => {
      if (!unlocked) {return;}
      if (active && !isNone) {
        vscode.postMessage({
          type: 'set-accessory',
          catId: cat.id,
          accessoryId: null,
        });
      } else {
        vscode.postMessage({
          type: 'set-accessory',
          catId: cat.id,
          accessoryId: isNone ? null : id,
        });
      }
    });

    return tile;
  }

  // --- Event listeners ---
  collectionBtn.addEventListener('click', () => {
    collectionView = { mode: 'cats' };
    renderCollection();
    collectionPanel.classList.remove('hidden');
  });

  closeCollectionBtn.addEventListener('click', () => {
    collectionPanel.classList.add('hidden');
  });

  collectionBackBtn.addEventListener('click', () => {
    collectionView = { mode: 'cats' };
    renderCollection();
  });

  gachaCloseBtn.addEventListener('click', () => {
    gachaOverlay.classList.add('hidden');
  });

  // --- Message handling ---
  window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.type) {
      case 'init': {
        catalogue = message.catalogue;
        state = message.state;
        if (!state.activeAccessory) {state.activeAccessory = {};}
        currentFrameUris = message.frameUris;
        currentAccessoryUris = message.accessoryUris;
        frameIndex = 0;

        preloadAll(currentFrameUris, currentAccessoryUris).then(() => {
          renderCat();
          updateControls();
        });
        break;
      }

      case 'advance-frame': {
        advanceFrame();
        break;
      }

      case 'update-type-count': {
        if (state) {
          state.typeCount = message.typeCount;
        }
        updateControls();
        break;
      }

      case 'gacha-result': {
        const item = message.item;
        if (state) {
          state.typeCount = message.typeCount;
          if (item.itemType === 'cat') {
            state.unlockedCats.push(item.catId);
          } else if (item.accessoryId) {
            if (!state.unlockedAccessories[item.catId]) {
              state.unlockedAccessories[item.catId] = [];
            }
            state.unlockedAccessories[item.catId].push(item.accessoryId);
          }
        }

        gachaResultBanner.textContent = item.itemType === 'cat' ? 'NEW MATE!' : 'NEW ITEM!';
        gachaResultArt.innerHTML = '';
        if (message.catFrameUri) {
          const catImg = document.createElement('img');
          catImg.className = 'gacha-result-cat-frame';
          catImg.src = message.catFrameUri;
          catImg.draggable = false;
          gachaResultArt.appendChild(catImg);
        }
        if (message.accessoryFrameUri) {
          const acsImg = document.createElement('img');
          acsImg.className = 'gacha-result-accessory-frame';
          acsImg.src = message.accessoryFrameUri;
          acsImg.draggable = false;
          gachaResultArt.appendChild(acsImg);
        }
        gachaResultName.textContent = item.displayName;
        gachaOverlay.classList.remove('hidden');

        updateControls();
        break;
      }

      case 'switch-cat': {
        if (state) {
          state.activeCat = message.catId;
          state.activeAccessory[message.catId] = message.activeAccessory ?? null;
        }
        currentFrameUris = message.frameUris;
        currentAccessoryUris = message.accessoryUris;
        frameIndex = 0;

        preloadAll(currentFrameUris, currentAccessoryUris).then(() => {
          renderCat();
        });

        if (!collectionPanel.classList.contains('hidden')) {
          renderCollection();
        }
        break;
      }
    }
  });

  vscode.postMessage({ type: 'webview-ready' });
})();
