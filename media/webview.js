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
  let currentAccessoryUris = [];
  let gachaCost = 100;
  let canPull = false;
  let hasItemsLeft = true;
  let idleTimer = null;
  const IDLE_TIMEOUT_MS = 3000;

  // --- DOM refs ---
  const catContainer = document.getElementById('cat-container');
  const typeCountEl = document.getElementById('type-count');
  const gachaBtn = document.getElementById('gacha-btn');
  const collectionBtn = document.getElementById('collection-btn');
  const collectionPanel = document.getElementById('collection-panel');
  const closeCollectionBtn = document.getElementById('close-collection');
  const collectionContent = document.getElementById('collection-content');
  const collectionProgress = document.getElementById('collection-progress');
  const gachaOverlay = document.getElementById('gacha-overlay');
  const gachaResultEmoji = document.getElementById('gacha-result-emoji');
  const gachaResultLabel = document.getElementById('gacha-result-label');
  const gachaResultName = document.getElementById('gacha-result-name');
  const gachaCloseBtn = document.getElementById('gacha-close');

  // --- Image preloading ---
  const imageCache = new Map();

  function preloadImage(uri) {
    if (imageCache.has(uri)) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve; // don't block on failure
      img.src = uri;
      imageCache.set(uri, img);
    });
  }

  async function preloadAll(frameUris, accessoryUris) {
    const uris = [...frameUris, ...accessoryUris.map((a) => a.uri)];
    await Promise.all(uris.map(preloadImage));
  }

  // --- Rendering ---
  function renderCat() {
    catContainer.innerHTML = '';

    // Add frame images
    currentFrameUris.forEach((uri, i) => {
      const img = document.createElement('img');
      img.className = 'cat-frame' + (i === PING_PONG[frameIndex] ? ' active' : '');
      img.src = uri;
      img.draggable = false;
      img.dataset.frameIndex = String(i);
      catContainer.appendChild(img);
    });

    // Add accessory overlays
    const activeAcs = state ? (state.activeAccessories[state.activeCat] || []) : [];
    currentAccessoryUris.forEach((acs) => {
      const img = document.createElement('img');
      img.className = 'accessory-overlay' + (activeAcs.includes(acs.id) ? '' : ' hidden');
      img.src = acs.uri;
      img.draggable = false;
      img.dataset.accessoryId = acs.id;
      catContainer.appendChild(img);
    });
  }

  function showFrame(index) {
    const frames = catContainer.querySelectorAll('.cat-frame');
    frames.forEach((f, i) => {
      f.classList.toggle('active', i === index);
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
      // Return to frame 0 (resting pose)
      frameIndex = 0;
      showFrame(PING_PONG[0]);
    }, IDLE_TIMEOUT_MS);
  }

  // --- Controls ---
  function updateControls() {
    typeCountEl.textContent = state ? String(state.typeCount) : '0';
    gachaBtn.textContent = `🎲 Gacha! (${gachaCost})`;
    gachaBtn.disabled = !canPull;
    if (!hasItemsLeft) {
      gachaBtn.textContent = '✅ All collected!';
      gachaBtn.disabled = true;
    }
  }

  // --- Collection ---
  function renderCollection() {
    if (!state || !catalogue.length) {return;}
    collectionContent.innerHTML = '';

    // Calculate and show progress
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

      // Cat header (clickable to select)
      const header = document.createElement('div');
      header.className = 'collection-cat-header' +
        (isUnlocked ? '' : ' locked');

      // Thumbnail
      const thumb = document.createElement('img');
      thumb.className = 'cat-thumb' + (isUnlocked ? '' : ' locked');
      if (isUnlocked) {
        // Use the first frame URI from catalogue
        const catAsset = catalogue.find((c) => c.id === cat.id);
        if (catAsset && catAsset.thumbUri) {
          thumb.src = catAsset.thumbUri;
        }
      }
      thumb.draggable = false;
      header.appendChild(thumb);

      // Info column
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

      if (isUnlocked && !isActive) {
        header.addEventListener('click', () => {
          vscode.postMessage({ type: 'select-cat', catId: cat.id });
        });
      }

      catDiv.appendChild(header);

      // Accessories (only show for unlocked cats)
      if (isUnlocked && cat.accessories.length > 0) {
        const acsList = document.createElement('div');
        acsList.className = 'accessory-list';

        cat.accessories.forEach((acs) => {
          const acsUnlocked = state.unlockedAccessories[cat.id]?.includes(acs.id);
          const acsActive = state.activeAccessories[cat.id]?.includes(acs.id);

          const item = document.createElement('div');
          item.className = 'accessory-item' + (acsUnlocked ? '' : ' locked');

          const toggle = document.createElement('input');
          toggle.type = 'checkbox';
          toggle.className = 'accessory-toggle';
          toggle.checked = !!acsActive;
          toggle.disabled = !acsUnlocked;
          toggle.addEventListener('change', () => {
            vscode.postMessage({
              type: 'toggle-accessory',
              catId: cat.id,
              accessoryId: acs.id,
            });
          });

          const label = document.createElement('span');
          label.className = 'accessory-name';
          label.textContent = acsUnlocked ? acs.displayName : '???';

          item.appendChild(toggle);
          item.appendChild(label);
          acsList.appendChild(item);
        });

        catDiv.appendChild(acsList);
      }

      collectionContent.appendChild(catDiv);
    });
  }

  // --- Event listeners ---
  gachaBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'gacha-pull' });
  });

  collectionBtn.addEventListener('click', () => {
    renderCollection();
    collectionPanel.classList.remove('hidden');
  });

  closeCollectionBtn.addEventListener('click', () => {
    collectionPanel.classList.add('hidden');
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
        currentFrameUris = message.frameUris;
        currentAccessoryUris = message.accessoryUris;
        gachaCost = message.gachaCost;
        canPull = message.canPull;
        hasItemsLeft = message.hasItemsLeft;
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
        canPull = message.canPull;
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
        canPull = message.canPull;
        hasItemsLeft = message.hasItemsLeft;

        // Show result
        gachaResultEmoji.textContent = item.itemType === 'cat' ? '🐱' : '✨';
        gachaResultLabel.textContent = item.itemType === 'cat' ? 'New cat!' : 'New accessory!';
        gachaResultName.textContent = item.displayName;
        gachaOverlay.classList.remove('hidden');

        updateControls();
        break;
      }

      case 'switch-cat': {
        if (state) {
          state.activeCat = message.catId;
        }
        currentFrameUris = message.frameUris;
        currentAccessoryUris = message.accessoryUris;
        if (state) {
          state.activeAccessories[message.catId] = message.activeAccessories;
        }
        frameIndex = 0;

        preloadAll(currentFrameUris, currentAccessoryUris).then(() => {
          renderCat();
        });

        // Re-render collection to update active state
        if (!collectionPanel.classList.contains('hidden')) {
          renderCollection();
        }
        break;
      }
    }
  });

  // Signal ready
  vscode.postMessage({ type: 'webview-ready' });
})();
