export async function scanBookmarks(scope='all'){
  // Use the original working method - it was reliable
  const tree = await chrome.bookmarks.getTree();
  const urls = [];
  
  // Get dynamic folder IDs
  let bookmarksBarId = null;
  let otherBookmarksId = null;
  
  if (scope === 'bar' || scope === 'other') {
    // Find the actual folder IDs dynamically
    for (const root of tree) {
      if (root.children) {
        for (const child of root.children) {
          if (child.folderType === 'bookmarks-bar') {
            bookmarksBarId = child.id;
          } else if (child.folderType === 'other') {
            otherBookmarksId = child.id;
          }
        }
      }
    }
    console.log(`Dynamic IDs - Bookmarks Bar: ${bookmarksBarId}, Other: ${otherBookmarksId}`);
  }
  
  function walk(nodes, parentId){
    for(const n of nodes){
      if (n.url){
        // Use dynamic IDs instead of hardcoded ones
        if (scope==='bar' && n.parentId !== bookmarksBarId) continue;
        if (scope==='other' && n.parentId !== otherBookmarksId) continue;
        urls.push({ id:n.id, title:n.title||'', url:n.url, parentId:n.parentId });
      }
      if (n.children) walk(n.children, n.id);
    }
  }
  
  walk(tree, null);
  
  // Add context-aware description for UI
  let description = '';
  switch(scope) {
    case 'bar':
      description = `Found ${urls.length} bookmarks in "Bookmarks Bar"`;
      break;
    case 'other':
      description = `Found ${urls.length} bookmarks in "Other Bookmarks"`;
      break;
    case 'all':
    default:
      description = `Found ${urls.length} bookmarks in "All Bookmarks"`;
      break;
  }
  
  console.log(description);
  return urls;
}
