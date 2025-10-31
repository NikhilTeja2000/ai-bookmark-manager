import { classifyBookmark, improveBookmarkTitle } from './scripts/ai/index.js';
import { buildPath, topicFromURL } from './scripts/organizer/utils.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ 
    id: 'ai-save', 
    title: 'Smart Save this Page (AI)', 
    contexts: ['page', 'selection'] 
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'ai-save') {
    await smartSavePage(tab);
  }
});

// Auto-organize newly created bookmarks
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings?.autoNew || !bookmark.url) return;
  
  try {
    await organizeNewBookmark(bookmark, settings);
  } catch (error) {
    console.error('Auto-organize failed:', error);
  }
});

async function smartSavePage(tab) {
  try {
    // Open side panel
    await chrome.sidePanel.open({ tabId: tab.id });
    await chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html' });
    
    // Get page content if possible
    let pageContent = '';
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // Extract meaningful content from the page
          const title = document.title;
          const description = document.querySelector('meta[name="description"]')?.content || '';
          const h1 = document.querySelector('h1')?.textContent || '';
          const firstP = document.querySelector('p')?.textContent?.slice(0, 200) || '';
          return { title, description, h1, firstP };
        }
      });
      
      if (results?.[0]?.result) {
        const content = results[0].result;
        pageContent = `${content.description} ${content.h1} ${content.firstP}`.slice(0, 500);
      }
    } catch (e) {
      console.warn('Could not extract page content:', e);
    }

    // Classify the page
    const classification = await classifyBookmark(tab.title, tab.url, pageContent);
    
    if (classification) {
      // Create bookmark in suggested folder
      const folderId = await ensureFolderPath(classification.suggestedFolder);
      const improvedTitle = classification.renameTitle || tab.title;
      
      const bookmark = await chrome.bookmarks.create({
        parentId: folderId,
        title: improvedTitle,
        url: tab.url
      });

      // Store metadata
      await chrome.storage.local.set({
        [`meta:${bookmark.id}`]: {
          topic: classification.topic,
          tags: classification.tags,
          reasons: classification.reasons,
          confidence: classification.confidence,
          aiClassified: true,
          savedAt: Date.now()
        }
      });

      // Notify user
      chrome.runtime.sendMessage({ 
        type: 'SMART_SAVE_COMPLETE',
        bookmark,
        classification 
      });
    } else {
      // Fallback to regular bookmark
      const bookmark = await chrome.bookmarks.create({
        title: tab.title,
        url: tab.url
      });
      
      chrome.runtime.sendMessage({ 
        type: 'SMART_SAVE_FALLBACK',
        bookmark 
      });
    }
    
  } catch (error) {
    console.error('Smart save failed:', error);
    chrome.runtime.sendMessage({ 
      type: 'SMART_SAVE_ERROR',
      error: error.message 
    });
  }
}

async function organizeNewBookmark(bookmark, settings) {
  // Skip if bookmark is already in an organized folder
  if (bookmark.parentId !== '1' && bookmark.parentId !== '2') return;
  
  const classification = await classifyBookmark(bookmark.title, bookmark.url);
  
  if (classification && classification.confidence >= (settings.threshold || 0.9)) {
    const folderId = await ensureFolderPath(classification.suggestedFolder);
    
    // Move bookmark
    await chrome.bookmarks.move(bookmark.id, { parentId: folderId });
    
    // Improve title if enabled
    if (settings.autoRename) {
      const improvedTitle = await improveBookmarkTitle(bookmark.title, bookmark.url);
      if (improvedTitle && improvedTitle !== bookmark.title) {
        await chrome.bookmarks.update(bookmark.id, { title: improvedTitle });
      }
    }
    
    // Store metadata
    await chrome.storage.local.set({
      [`meta:${bookmark.id}`]: {
        topic: classification.topic,
        tags: classification.tags,
        reasons: classification.reasons,
        confidence: classification.confidence,
        aiClassified: true,
        autoOrganized: true,
        organizedAt: Date.now()
      }
    });
  }
}

async function ensureFolderPath(path) {
  const parts = path.split('/');
  let parentId = '1'; // bookmarks bar root
  
  for (const part of parts) {
    if (!part.trim()) continue;
    
    // Look for existing folder
    const existing = await chrome.bookmarks.search({ title: part });
    let folder = existing.find(f => !f.url && f.parentId === parentId);
    
    if (!folder) {
      // Create new folder
      folder = await chrome.bookmarks.create({
        title: part,
        parentId: parentId
      });
    }
    
    parentId = folder.id;
  }
  
  return parentId;
}
