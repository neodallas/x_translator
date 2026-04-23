const select            = document.getElementById('langSelect');
const autoToggle        = document.getElementById('autoTranslate');
const enabledToggle     = document.getElementById('enabled');
const bodySection       = document.getElementById('bodySection');
const powerLabel        = document.getElementById('powerLabel');
const savedMsg          = document.getElementById('savedMsg');
const fontSizeSelect    = document.getElementById('fontSizeSelect');
const borderColorPicker = document.getElementById('borderColorPicker');
// Завантажуємо збережені налаштування
chrome.storage.sync.get(
  ['targetLang', 'autoTranslate', 'enabled', 'fontSize', 'borderColor'],
  result => {
    if (result.targetLang)    select.value            = result.targetLang;
    if (result.autoTranslate) autoToggle.checked      = result.autoTranslate;
    if (result.fontSize)      fontSizeSelect.value    = result.fontSize;
    if (result.borderColor)   borderColorPicker.value = result.borderColor;

    const isEnabled = result.enabled !== false;
    enabledToggle.checked = isEnabled;
    applyEnabledState(isEnabled);
  }
);

function applyEnabledState(isEnabled) {
  powerLabel.textContent = isEnabled ? 'On' : 'Off';
  bodySection.classList.toggle('disabled', !isEnabled);
}

function showSaved() {
  savedMsg.textContent = 'Saved!';
  setTimeout(() => { savedMsg.textContent = ''; }, 1500);
}

select.addEventListener('change', () => {
  chrome.storage.sync.set({ targetLang: select.value }, showSaved);
});

autoToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ autoTranslate: autoToggle.checked }, showSaved);
});

enabledToggle.addEventListener('change', () => {
  const isEnabled = enabledToggle.checked;
  applyEnabledState(isEnabled);
  chrome.storage.sync.set({ enabled: isEnabled }, showSaved);
});

fontSizeSelect.addEventListener('change', () => {
  chrome.storage.sync.set({ fontSize: Number(fontSizeSelect.value) }, showSaved);
});


// Debounce — не записуємо кожен піксель, тільки коли зупинились
let colorDebounce = null;
borderColorPicker.addEventListener('input', () => {
  clearTimeout(colorDebounce);
  colorDebounce = setTimeout(() => {
    chrome.storage.sync.set({ borderColor: borderColorPicker.value });
  }, 400);
});
borderColorPicker.addEventListener('change', () => {
  clearTimeout(colorDebounce);
  chrome.storage.sync.set({ borderColor: borderColorPicker.value }, showSaved);
});
