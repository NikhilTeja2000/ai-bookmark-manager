import { getState } from './state.js';

let _pending = [];
export function queueApply(rec) { _pending.push(rec); }

// Cache for bookmark folder IDs
let _bookmarkFolderIds = null;

// Helper function to get all bookmark folder IDs dynamically
async function getBookmarkFolderIds() {
  if (_bookmarkFolderIds) {
    return _bookmarkFolderIds;
  }

  try {
    const tree = await chrome.bookmarks.getTree();
    console.log('Bookmark tree:', tree);

    const folderIds = {
      bookmarksBar: null,
      otherBookmarks: null,
      mobileBookmarks: null
    };

    // Look for folders by folderType
    for (const root of tree) {
      if (root.children) {
        for (const child of root.children) {
          if (child.folderType === 'bookmarks-bar') {
            folderIds.bookmarksBar = child.id;
            console.log(`✅ Found Bookmarks Bar with ID: ${child.id}`);
          } else if (child.folderType === 'other') {
            folderIds.otherBookmarks = child.id;
            console.log(`✅ Found Other Bookmarks with ID: ${child.id}`);
          } else if (child.folderType === 'mobile') {
            folderIds.mobileBookmarks = child.id;
            console.log(`✅ Found Mobile Bookmarks with ID: ${child.id}`);
          }
        }
      }
    }

    // Fallback: try standard IDs if folderType detection fails
    if (!folderIds.bookmarksBar) {
      const standardIds = ['1', '108'];
      for (const id of standardIds) {
        try {
          const result = await chrome.bookmarks.get(id);
          if (result && result[0] && !result[0].url) {
            folderIds.bookmarksBar = id;
            console.log(`✅ Found Bookmarks Bar with fallback ID: ${id}`);
            break;
          }
        } catch (error) {
          // Continue trying
        }
      }
    }

    if (!folderIds.otherBookmarks) {
      const standardIds = ['2', '109'];
      for (const id of standardIds) {
        try {
          const result = await chrome.bookmarks.get(id);
          if (result && result[0] && !result[0].url) {
            folderIds.otherBookmarks = id;
            console.log(`✅ Found Other Bookmarks with fallback ID: ${id}`);
            break;
          }
        } catch (error) {
          // Continue trying
        }
      }
    }

    _bookmarkFolderIds = folderIds;
    console.log('✅ Final bookmark folder IDs:', folderIds);

    // Test if the detected Bookmarks Bar ID actually works
    if (folderIds.bookmarksBar) {
      try {
        await chrome.bookmarks.get(folderIds.bookmarksBar);
        console.log(`✅ Verified Bookmarks Bar ID ${folderIds.bookmarksBar} is accessible`);
      } catch (error) {
        console.error(`❌ Detected Bookmarks Bar ID ${folderIds.bookmarksBar} is not accessible:`, error);
      }
    }

    return folderIds;

  } catch (error) {
    console.error('❌ Failed to get bookmark tree:', error);
    // Last resort fallback
    return {
      bookmarksBar: '1',
      otherBookmarks: '2',
      mobileBookmarks: '3'
    };
  }
}

// Helper function to get Bookmarks Bar ID
async function getBookmarksBarId() {
  const folderIds = await getBookmarkFolderIds();
  return folderIds.bookmarksBar || '1';
}

async function ensureFolderPath(path) {
  if (!path || path.trim() === '') {
    return await getBookmarksBarId(); // Get actual bookmarks bar ID
  }

  const parts = path.split('/').filter(p => p.trim() !== '');
  let parentId = await getBookmarksBarId(); // Get actual bookmarks bar ID

  for (const p of parts) {
    try {
      console.log(`Processing folder part: "${p}" in parent ${parentId}`);

      // Search for existing folder with this title under the current parent
      const hits = await chrome.bookmarks.search({ title: p });
      let node = hits.find(h => h.title === p && !h.url && h.parentId === parentId);

      if (!node) {
        console.log(`Creating folder "${p}" in parent ${parentId}`);
        try {
          // Small delay to avoid overwhelming Chrome's API
          await new Promise(resolve => setTimeout(resolve, 100));

          node = await chrome.bookmarks.create({
            title: p,
            parentId: parentId
          });
          console.log(`✅ Created folder "${p}" with ID ${node.id}`);
        } catch (createError) {
          console.error(`❌ Failed to create folder "${p}":`, createError);

          // If we can't create in the current parent, try bookmarks bar
          if (parentId !== '1') {
            console.log(`Trying to create "${p}" in bookmarks bar as fallback`);
            try {
              node = await chrome.bookmarks.create({
                title: p,
                parentId: '1'
              });
              console.log(`✅ Created folder "${p}" in bookmarks bar with ID ${node.id}`);
            } catch (fallbackError) {
              console.error(`❌ Even bookmarks bar creation failed:`, fallbackError);
              return '1'; // Give up and return bookmarks bar
            }
          } else {
            console.error(`❌ Can't create folder even in bookmarks bar`);
            return '1'; // Give up
          }
        }
      } else {
        console.log(`✅ Found existing folder "${p}" with ID ${node.id}`);
      }

      parentId = node.id;
    } catch (error) {
      console.error(`❌ Error processing folder part "${p}":`, error);
      return '1'; // Fall back to bookmarks bar
    }
  }

  console.log(`✅ Final folder path "${path}" resolved to ID: ${parentId}`);
  return parentId;
}

export async function applyDecisions(decisions) {
  console.log('applyDecisions called with:', decisions?.length, 'decisions');
  const st = getState();
  const snap = st.lastSnapshot || (st.lastSnapshot = { timestamp: Date.now(), moves: [] });

  for (const d of (decisions || _pending)) {
    if (d.decision === 'skip') continue;

    try {
      console.log('Processing decision for:', d.title, '→', d.suggestedFolder);

      // Verify bookmark still exists
      if (!d.id) {
        console.warn('Decision missing bookmark ID:', d);
        continue;
      }

      const before = await chrome.bookmarks.get(d.id).then(x => x[0]).catch(() => null);
      if (!before) {
        console.warn(`Bookmark ${d.id} no longer exists, skipping`);
        continue;
      }

      // Ensure target folder exists
      console.log('Creating folder path:', d.suggestedFolder);
      const targetId = await ensureFolderPath(d.suggestedFolder || 'AI Collections/Unsorted');
      console.log('Folder created with ID:', targetId);
      if (!targetId) {
        console.warn(`Failed to create folder: ${d.suggestedFolder}`);
        continue;
      }

      // Move bookmark if needed
      if (before.parentId !== targetId) {
        console.log(`Moving bookmark "${before.title}" from ${before.parentId} to ${targetId}`);
        snap.moves.push({
          id: d.id,
          prevParentId: before.parentId,
          newParentId: targetId,
          title: before.title,
          originalTitle: before.title
        });
        await chrome.bookmarks.move(d.id, { parentId: targetId });
        console.log('Bookmark moved successfully');
      } else {
        console.log('Bookmark already in correct folder');
      }

      // Rename if needed
      if (d.renameTitle && d.renameTitle !== before.title) {
        await chrome.bookmarks.update(d.id, { title: d.renameTitle });
      }

      // Save metadata
      if (d.meta) {
        await chrome.storage.local.set({ ['meta:' + d.id]: d.meta });
      }

    } catch (error) {
      console.error(`Failed to apply decision for bookmark ${d.id}:`, error);
      // Continue with other bookmarks instead of failing completely
    }
  }
  _pending = [];
}

export async function undoLast() {
  const st = getState();
  const snap = st.lastSnapshot;
  if (!snap) return;
  for (const mv of [...snap.moves].reverse()) {
    try {
      await chrome.bookmarks.move(mv.id, { parentId: mv.prevParentId });
      await chrome.bookmarks.update(mv.id, { title: mv.title });
    } catch { }
  }
  st.lastSnapshot = null;
}

// Complete reset functionality
export async function resetToOriginal() {
  const st = getState();

  try {
    // Get all snapshots from storage (we'll store multiple snapshots)
    const { allSnapshots, originalState } = await chrome.storage.local.get(['allSnapshots', 'originalState']);

    if (!originalState) {
      throw new Error('No original state found. Cannot reset.');
    }

    // Restore all bookmarks to their original positions and titles
    if (allSnapshots && allSnapshots.length > 0) {
      // Process all snapshots in reverse order (most recent first)
      for (const snapshot of [...allSnapshots].reverse()) {
        for (const mv of [...snapshot.moves].reverse()) {
          try {
            await chrome.bookmarks.move(mv.id, { parentId: mv.prevParentId });
            await chrome.bookmarks.update(mv.id, { title: mv.originalTitle || mv.title });

            // Remove AI metadata
            await chrome.storage.local.remove(`meta:${mv.id}`);
          } catch (error) {
            console.warn(`Failed to restore bookmark ${mv.id}:`, error);
          }
        }
      }
    }

    // Remove AI-created folders that are now empty
    await cleanupEmptyFolders();

    // Clear all snapshots and reset state
    await chrome.storage.local.remove(['allSnapshots', 'lastSnapshot']);
    st.lastSnapshot = null;
    st.counts = { auto: 0, review: 0, skip: 0, duplicates: 0, errors: 0 };
    st.review = [];

    return { success: true, message: 'Successfully reset all bookmarks to original state' };

  } catch (error) {
    console.error('Reset failed:', error);
    return { success: false, message: error.message };
  }
}

// Save original state before first organization
export async function saveOriginalState() {
  const { originalState } = await chrome.storage.local.get('originalState');

  if (!originalState) {
    // Get all bookmarks and save their current state
    const bookmarks = await chrome.bookmarks.getTree();
    const timestamp = Date.now();

    await chrome.storage.local.set({
      originalState: {
        timestamp,
        bookmarks: bookmarks,
        saved: true
      }
    });

    console.log('Original bookmark state saved for reset functionality');
  }
}

// Enhanced snapshot system that tracks all changes
export async function createSnapshot(moves) {
  const st = getState();
  const timestamp = Date.now();

  const snapshot = {
    timestamp,
    moves: moves.map(mv => ({
      ...mv,
      originalTitle: mv.originalTitle || mv.title // Preserve original titles
    }))
  };

  // Save current snapshot
  st.lastSnapshot = snapshot;

  // Also save to persistent storage for reset functionality
  const { allSnapshots = [] } = await chrome.storage.local.get('allSnapshots');
  allSnapshots.push(snapshot);

  // Keep only last 10 snapshots to avoid storage bloat
  if (allSnapshots.length > 10) {
    allSnapshots.splice(0, allSnapshots.length - 10);
  }

  await chrome.storage.local.set({
    allSnapshots,
    lastSnapshot: snapshot
  });
}

// Clean up empty folders created by AI organization
async function cleanupEmptyFolders() {
  try {
    const bookmarks = await chrome.bookmarks.getTree();
    const emptyFolders = [];

    // Find empty folders (recursive)
    function findEmptyFolders(nodes) {
      for (const node of nodes) {
        if (!node.url) { // It's a folder
          if (node.children) {
            findEmptyFolders(node.children);
            // Check if folder is empty after processing children
            if (node.children.length === 0 && node.id !== '1' && node.id !== '2') {
              emptyFolders.push(node.id);
            }
          }
        }
      }
    }

    findEmptyFolders(bookmarks);

    // Remove empty folders
    for (const folderId of emptyFolders) {
      try {
        await chrome.bookmarks.remove(folderId);
      } catch (error) {
        console.warn(`Failed to remove empty folder ${folderId}:`, error);
      }
    }

  } catch (error) {
    console.warn('Failed to cleanup empty folders:', error);
  }
}
