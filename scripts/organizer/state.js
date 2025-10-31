const _state = {
  counts: { auto: 0, review: 0, skip: 0, duplicates: 0, errors: 0 },
  review: [],
  lastSnapshot: null,
  settings: { threshold: 0.90, dryRun: false, autoRename: true, folderStrategy: 'simple', autoNew: false }
};
export function getState() { return _state; }
export async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  if (settings) Object.assign(_state.settings, settings);
  return _state.settings;
}
export async function setSettings(s) {
  Object.assign(_state.settings, s || {});
  await chrome.storage.local.set({ settings: _state.settings });
}
