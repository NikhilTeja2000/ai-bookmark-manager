export function canonicalizeURL(url){
  try {
    const u = new URL(url);
    u.hash='';
    const params = new URLSearchParams(u.search);
    for (const k of [...params.keys()]){
      if (k.startsWith('utm_') || k==='ref' || k==='fbclid' || k==='gclid') params.delete(k);
    }
    u.search = params.toString();
    u.pathname = u.pathname.replace(/\/$/,''); 
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch { return url; }
}

const TOPIC_HINTS = {
  // Development
  'github.com': 'Technology/Development',
  'gitlab.com': 'Technology/Development', 
  'stackoverflow.com': 'Technology/Development',
  'npmjs.com': 'Technology/Development',
  'pypi.org': 'Technology/Development',
  'developer.': 'Technology/Development',
  'docs.': 'Reference/Documentation',
  
  // News & Media
  'medium.com': 'News/Tech',
  'cnn.com': 'News/General',
  'bbc.com': 'News/General',
  'theverge.com': 'Technology/News',
  'techcrunch.com': 'Technology/News',
  'ycombinator.com': 'Technology/News',
  
  // Education & Research
  'arxiv.org': 'Education/Research',
  'coursera.org': 'Education/Courses',
  'udemy.com': 'Education/Courses',
  'khan': 'Education/Learning',
  'wikipedia.org': 'Reference/Encyclopedia',
  
  // Shopping
  'amazon.': 'Shopping/General',
  'ebay.': 'Shopping/General',
  'etsy.': 'Shopping/Crafts',
  'shop': 'Shopping/General',
  'store': 'Shopping/General',
  
  // Social
  'twitter.com': 'Social/Twitter',
  'linkedin.com': 'Social/Professional',
  'reddit.com': 'Social/Reddit',
  'facebook.com': 'Social/Facebook',
  
  // Tools
  'figma.com': 'Tools/Design',
  'notion.so': 'Tools/Productivity',
  'trello.com': 'Tools/Productivity',
  'slack.com': 'Tools/Communication'
};

export function topicFromURL(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const fullUrl = url.toLowerCase();
    
    // Check specific domain mappings
    for (const [key, topic] of Object.entries(TOPIC_HINTS)) {
      if (host.includes(key) || fullUrl.includes(key)) {
        return topic;
      }
    }
    
    // Pattern-based detection
    if (/blog|news|article/.test(fullUrl)) return 'News/Blogs';
    if (/docs|documentation|api|spec|guide/.test(fullUrl)) return 'Reference/Documentation';
    if (/shop|store|cart|buy|product/.test(fullUrl)) return 'Shopping/General';
    if (/learn|course|tutorial|education/.test(fullUrl)) return 'Education/Learning';
    if (/tool|app|software|service/.test(fullUrl)) return 'Tools/General';
    if (/video|watch|youtube|vimeo/.test(fullUrl)) return 'Entertainment/Videos';
    
    // Domain-based fallbacks
    if (host.includes('edu')) return 'Education/Academic';
    if (host.includes('gov')) return 'Reference/Government';
    if (host.includes('org')) return 'Reference/Organizations';
    
    return 'General/Unsorted';
  } catch {
    return 'General/Unsorted';
  }
}

export function buildPath(root, topic, strategy = 'topic') {
  if (strategy === 'domain') {
    try {
      const domain = new URL(topic).hostname.replace('www.', '');
      return `${root}/By Domain/${domain}`;
    } catch {
      return `${root}/By Domain/Other`;
    }
  }
  
  if (strategy === 'hybrid') {
    // Use AI topic but organize by domain within topic
    const parts = topic.split('/');
    if (parts.length > 1) {
      return `${root}/${parts[0]}/${parts[1]}`;
    }
  }
  
  // Default topic strategy
  return topic.startsWith(root) ? topic : `${root}/${topic}`;
}

export function getDomainFromURL(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}
