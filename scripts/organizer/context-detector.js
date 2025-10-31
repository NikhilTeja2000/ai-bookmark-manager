/**
 * Context Detector
 * Detects current bookmark folder context and provides smart scoping
 */

export async function getCurrentBookmarkContext() {
  try {
    // Get the current active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if user is on Chrome bookmarks page
    if (activeTab.url && activeTab.url.startsWith('chrome://bookmarks')) {
      const urlParams = new URL(activeTab.url);
      const folderId = urlParams.searchParams.get('id');
      
      if (folderId) {
        // User is viewing a specific folder
        const folder = await chrome.bookmarks.get(folderId).then(x => x[0]).catch(() => null);
        if (folder && !folder.url) { // It's a folder
          return {
            type: 'folder',
            folderId: folderId,
            folderName: folder.title,
            parentId: folder.parentId
          };
        }
      }
    }
    
    // Default context
    return {
      type: 'all',
      folderId: null,
      folderName: 'All Bookmarks',
      parentId: null
    };
    
  } catch (error) {
    console.warn('Failed to detect bookmark context:', error);
    return {
      type: 'all',
      folderId: null,
      folderName: 'All Bookmarks',
      parentId: null
    };
  }
}

export async function getBookmarksInContext(context) {
  const tree = await chrome.bookmarks.getTree();
  const bookmarks = [];
  
  function walkBookmarks(nodes, targetFolderId = null) {
    for (const node of nodes) {
      // If we're looking for a specific folder
      if (targetFolderId && node.id === targetFolderId) {
        // Found the target folder, get its children
        if (node.children) {
          extractBookmarksFromNodes(node.children, bookmarks);
        }
        return;
      }
      
      // If this is a bookmark (has URL)
      if (node.url) {
        // Only add if we're not looking for a specific folder (i.e., getting all)
        if (!targetFolderId) {
          bookmarks.push({
            id: node.id,
            title: node.title || '',
            url: node.url,
            parentId: node.parentId
          });
        }
      }
      
      // Recurse into children
      if (node.children) {
        walkBookmarks(node.children, targetFolderId);
      }
    }
  }
  
  // Alternative approach: scan by parent ID directly
  function scanByParentId(nodes, targetParentId) {
    for (const node of nodes) {
      // If this is a bookmark with the target parent
      if (node.url && node.parentId === targetParentId) {
        bookmarks.push({
          id: node.id,
          title: node.title || '',
          url: node.url,
          parentId: node.parentId
        });
      }
      
      // Recurse into children
      if (node.children) {
        scanByParentId(node.children, targetParentId);
      }
    }
  }
  
  function extractBookmarksFromNodes(nodes, bookmarkList) {
    for (const node of nodes) {
      if (node.url) {
        // It's a bookmark
        bookmarkList.push({
          id: node.id,
          title: node.title || '',
          url: node.url,
          parentId: node.parentId
        });
      } else if (node.children) {
        // It's a folder, recurse into it
        extractBookmarksFromNodes(node.children, bookmarkList);
      }
    }
  }
  
  switch (context.type) {
    case 'folder':
      walkBookmarks(tree, context.folderId);
      break;
    case 'bar':
      // Use the direct parent ID scanning for Bookmarks Bar
      scanByParentId(tree, '1');
      break;
    case 'other':
      // Use the direct parent ID scanning for Other Bookmarks
      scanByParentId(tree, '2');
      break;
    case 'all':
    default:
      walkBookmarks(tree);
      break;
  }
  
  return bookmarks;
}

export async function getSmartScope() {
  const context = await getCurrentBookmarkContext();
  
  // If user is viewing a specific folder, suggest organizing that folder
  if (context.type === 'folder') {
    return {
      scope: 'current',
      description: `Organize "${context.folderName}" folder`,
      context: context
    };
  }
  
  // Default to all bookmarks
  return {
    scope: 'all',
    description: 'Organize all bookmarks',
    context: context
  };
}

export async function scanBookmarksWithContext(scopeType) {
  let context;
  
  if (scopeType === 'current') {
    // Get current context
    context = await getCurrentBookmarkContext();
  } else {
    // Use specified scope
    context = {
      type: scopeType,
      folderId: scopeType === 'bar' ? '1' : scopeType === 'other' ? '2' : null,
      folderName: scopeType === 'bar' ? 'Bookmarks Bar' : scopeType === 'other' ? 'Other Bookmarks' : 'All Bookmarks'
    };
  }
  
  const bookmarks = await getBookmarksInContext(context);
  
  return {
    bookmarks,
    context,
    description: `Found ${bookmarks.length} bookmarks in "${context.folderName}"`
  };
}