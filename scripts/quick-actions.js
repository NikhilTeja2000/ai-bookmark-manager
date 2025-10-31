import { scanBookmarks, classifyQueue, loadSettings } from '../scripts/organizer/index.js';
export async function smartSaveCurrent(){
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  await chrome.bookmarks.create({ parentId:'1', title: tab.title, url: tab.url });
}
export async function bulkOrganizeQuick(){
  const stg = await loadSettings();
  const queue = await scanBookmarks('all');
  await classifyQueue(queue, stg);
}
