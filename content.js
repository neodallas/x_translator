// ─── Settings ────────────────────────────────────────────────────────────────
let settings = {
  targetLang:   'uk',
  autoTranslate: false,
  enabled:       true,
  fontSize:      15,
  borderColor:   '#1d9bf0',
};

function applyAppearance() {
  document.documentElement.style.setProperty('--twt-font-size',    settings.fontSize + 'px');
  document.documentElement.style.setProperty('--twt-border-color', settings.borderColor);
}

function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(
      ['targetLang', 'autoTranslate', 'enabled', 'fontSize', 'borderColor'],
      result => {
        settings.targetLang    = result.targetLang    ?? 'uk';
        settings.autoTranslate = result.autoTranslate ?? false;
        settings.enabled       = result.enabled       !== false;
        const rawSize = Number(result.fontSize) || 15;
        settings.fontSize      = Math.min(Math.max(rawSize, 10), 30);
        settings.borderColor   = /^#[0-9a-f]{6}$/i.test(result.borderColor)
          ? result.borderColor : '#1d9bf0';
        applyAppearance();
        resolve();
      }
    );
  });
}

// Живе оновлення при зміні налаштувань у попапі
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.targetLang)            settings.targetLang    = changes.targetLang.newValue;
  if (changes.enabled !== undefined) {
    settings.enabled = changes.enabled.newValue;
    toggleExtension(settings.enabled);
  }
  if (changes.autoTranslate !== undefined) {
    settings.autoTranslate = changes.autoTranslate.newValue;
    if (settings.autoTranslate && settings.enabled) triggerAutoTranslateAll();
  }
  if (changes.fontSize !== undefined) {
    settings.fontSize = changes.fontSize.newValue;
    applyAppearance();
  }
  if (changes.borderColor !== undefined) {
    settings.borderColor = changes.borderColor.newValue;
    applyAppearance();
  }
});

// ─── Кеш перекладів (сесія, макс. 300 записів) ───────────────────────────────
const cache = new Map();
const CACHE_LIMIT = 300;

function cacheSet(key, value) {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

// ─── Lingva Translate (основний, без ключа) ───────────────────────────────────
const LINGVA_INSTANCES = [
  'https://lingva.ml',
  'https://translate.plausibility.cloud',
  'https://lingva.thedaviddelta.com',
];

async function translateViaLingva(text, targetLang) {
  for (const instance of LINGVA_INSTANCES) {
    try {
      const url = `${instance}/api/v1/auto/${encodeURIComponent(targetLang)}/${encodeURIComponent(text)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.translation) continue;
      return {
        translation: data.translation,
        detectedLang: data.info?.detectedSource ?? null,
      };
    } catch {
      continue; // пробуємо наступну інстанцію
    }
  }
  throw new Error('Всі Lingva інстанції недоступні');
}

// ─── Головна функція перекладу ────────────────────────────────────────────────
async function translateText(text, targetLang) {
  const key = `${targetLang}::${text}`;
  if (cache.has(key)) return cache.get(key);

  const result = await translateViaLingva(text, targetLang);
  cacheSet(key, result);
  return result;
}

// ─── Retry з exponential backoff: 1с → 2с → помилка ─────────────────────────
async function translateWithRetry(text, targetLang, btn) {
  const MAX_RETRIES = 2;
  const delays = [1000, 2000];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await translateText(text, targetLang);
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        if (btn) btn.textContent = `${attempt + 1}/${MAX_RETRIES}`;
        await new Promise(r => setTimeout(r, delays[attempt]));
      } else {
        throw err;
      }
    }
  }
}

function isSameLang(a, b) {
  if (!a || !b) return false;
  return a.toLowerCase().split('-')[0] === b.toLowerCase().split('-')[0];
}

// ─── Вмк/Вимк розширення ─────────────────────────────────────────────────────
function toggleExtension(enabled) {
  document.querySelectorAll('.twt-translate-wrapper, .twt-translation-result').forEach(el => {
    el.style.display = enabled ? '' : 'none';
  });
  // При вмиканні — вставляємо кнопки в статті що завантажились поки було вимкнено
  if (enabled) scanForTweets();
}

// ─── Реєстр статей (для автоперекладу при зміні налаштувань) ─────────────────
const articleRegistry = new Map(); // article → doTranslate

// Прибираємо з реєстру статті які Twitter видалив з DOM (віртуалізація)
function cleanArticleRegistry() {
  articleRegistry.forEach((_, article) => {
    if (!document.contains(article)) articleRegistry.delete(article);
  });
}

function triggerAutoTranslateAll() {
  cleanArticleRegistry();
  articleRegistry.forEach(fn => fn(true));
}

// ─── Фабрика кнопки ──────────────────────────────────────────────────────────
function getTweetText(article) {
  return article.querySelector('[data-testid="tweetText"]')?.innerText.trim() ?? null;
}

function createTranslateButton(article) {
  const btn = document.createElement('button');
  btn.className = 'twt-translate-btn';
  btn.title = 'Translate';
  btn.textContent = 'Tr';

  const resultBox = document.createElement('div');
  resultBox.className = 'twt-translation-result';
  resultBox.hidden = true;

  const wrapper = document.createElement('div');
  wrapper.className = 'twt-translate-wrapper';
  wrapper.appendChild(btn);

  // idle | loading | done | same | error
  let state = 'idle';

  async function doTranslate(auto = false) {
    if (state === 'loading') return;

    // Повторний клік — перемкнути видимість
    if (state === 'done') {
      if (!auto) {
        resultBox.hidden = !resultBox.hidden;
        btn.style.opacity = resultBox.hidden ? '0.45' : '';
        btn.title = resultBox.hidden ? 'Show translation' : 'Hide translation';
      }
      return;
    }

    const text = getTweetText(article);
    if (!text) return;

    state = 'loading';
    if (!auto) {
      btn.textContent = '…';
      btn.disabled = true;
    }

    try {
      const { translation, detectedLang } = await translateWithRetry(text, settings.targetLang, auto ? null : btn);

      // #5 — Пост вже на потрібній мові
      if (isSameLang(detectedLang, settings.targetLang)) {
        state = 'same';
        if (auto) {
          wrapper.remove();
        } else {
          btn.textContent = '✓';
          btn.disabled = true;
          setTimeout(() => wrapper.remove(), 1500);
        }
        return;
      }

      resultBox.textContent = translation;
      resultBox.hidden = false;
      state = 'done';
      btn.textContent = 'Tr';
      btn.title = 'Hide translation';

    } catch {
      state = 'idle'; // дозволяємо повторну спробу
      if (!auto) {
        resultBox.textContent = 'Error. Please try again.';
        resultBox.hidden = false;
        btn.textContent = 'Tr';
      }
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    doTranslate(false);
  });

  return { wrapper, resultBox, doTranslate };
}

// ─── Вставка кнопки в пост ────────────────────────────────────────────────────
function injectButton(article) {
  if (article.dataset.twtTranslateInjected) return;
  if (!settings.enabled) return;

  const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
  if (!tweetTextEl) return; // ще не відрендерено — observer спіймає пізніше

  article.dataset.twtTranslateInjected = 'true';

  const { wrapper, resultBox, doTranslate } = createTranslateButton(article);

  // Вставляємо кнопку перед Grok (або перед "..." якщо Grok немає)
  const caretBtn  = article.querySelector('[data-testid="caret"]');
  const grokBtn   = article.querySelector('[data-testid="grok-actions"], [aria-label*="Grok"], [aria-label*="grok"]');
  const anchorBtn = grokBtn ?? caretBtn;
  if (anchorBtn) {
    anchorBtn.parentElement.insertBefore(wrapper, anchorBtn);
  } else {
    // Fallback: після тексту твіту
    tweetTextEl.insertAdjacentElement('afterend', wrapper);
  }

  // Блок перекладу — під текстом
  tweetTextEl.insertAdjacentElement('afterend', resultBox);

  // Зберігаємо для triggerAutoTranslateAll
  articleRegistry.set(article, doTranslate);

  // #4 — Автопереклад
  if (settings.autoTranslate) doTranslate(true);
}

// ─── Сканування сторінки ─────────────────────────────────────────────────────
function scanForTweets() {
  if (!settings.enabled) return; // не скануємо коли вимкнено — критичний баг-фікс
  document.querySelectorAll('article[data-testid="tweet"]').forEach(injectButton);
}

// ─── Debounced MutationObserver ───────────────────────────────────────────────
let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(scanForTweets, 300);
});
observer.observe(document.body, { childList: true, subtree: true });

// ─── Старт ───────────────────────────────────────────────────────────────────
loadSettings().then(scanForTweets);
