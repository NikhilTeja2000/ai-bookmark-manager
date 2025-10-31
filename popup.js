import { setSettings, loadSettings } from './scripts/settings-helpers.js';
import { smartSaveCurrent, bulkOrganizeQuick } from './scripts/quick-actions.js';

const qs = (s)=>document.querySelector(s);
async function boot(){
  const stg = await loadSettings();
  qs('#pv-threshold').value = stg.threshold;
  qs('#pv-th').textContent = Number(stg.threshold).toFixed(2);
  qs('#pv-dry').checked = stg.dryRun;
  qs('#autoNew').checked = stg.autoNew;
}
boot();

qs('#pv-threshold').oninput = (e)=>{ qs('#pv-th').textContent = Number(e.target.value).toFixed(2); };

qs('#openPanel').onclick = async ()=>{
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  await chrome.sidePanel.open({ tabId: tab.id });
  await chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html' });
};

qs('#smartSave').onclick = ()=>smartSaveCurrent();
qs('#bulkOrganize').onclick = ()=>bulkOrganizeQuick();

qs('#autoNew').onchange = async (e)=>{
  const stg = await loadSettings();
  stg.autoNew = e.target.checked;
  await setSettings(stg);
};
