/**
 * Folder Strategy Manager
 * Handles different approaches to bookmark organization
 */

export function applyFolderStrategy(classification, strategy = 'simple') {
  switch (strategy) {
    case 'simple':
      return applySimpleStrategy(classification);
    case 'detailed':
      return applyDetailedStrategy(classification);
    case 'domain':
      return applyDomainStrategy(classification);
    case 'flat':
      return applyFlatStrategy(classification);
    default:
      return applySimpleStrategy(classification);
  }
}

function applySimpleStrategy(classification) {
  // Force maximum 2 levels, consolidate similar categories
  const { topic, suggestedFolder } = classification;
  
  // Map to main categories
  const mainCategories = {
    'Technology': 'Work',
    'Programming': 'Work', 
    'Development': 'Work',
    'Tools': 'Work',
    'Business': 'Work',
    'Design': 'Work',
    
    'Education': 'Learning',
    'Courses': 'Learning',
    'Tutorials': 'Learning',
    'Documentation': 'Learning',
    'Research': 'Learning',
    
    'Entertainment': 'Entertainment',
    'Videos': 'Entertainment',
    'Games': 'Entertainment',
    'Music': 'Entertainment',
    'Social': 'Entertainment',
    
    'Shopping': 'Shopping',
    'Products': 'Shopping',
    'Services': 'Shopping',
    
    'News': 'Reference',
    'Articles': 'Reference',
    'Resources': 'Reference',
    
    'Personal': 'Personal',
    'Finance': 'Personal',
    'Health': 'Personal',
    'Travel': 'Personal'
  };

  // Get main category
  const mainCategory = mainCategories[topic] || 'Reference';
  
  // Determine subcategory based on URL and content analysis
  let subcategory = 'General';
  const url = classification.url || '';
  const title = classification.title || '';
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();
  
  if (mainCategory === 'Work') {
    if (lowerUrl.includes('github.com') || lowerUrl.includes('stackoverflow.com') || 
        lowerTitle.includes('code') || lowerTitle.includes('programming') || 
        lowerTitle.includes('python') || lowerTitle.includes('javascript') ||
        topic.includes('Program') || topic.includes('Code') || topic.includes('Development')) {
      subcategory = 'Programming';
    } else if (lowerTitle.includes('design') || lowerUrl.includes('figma') || 
               lowerUrl.includes('dribbble') || topic.includes('Design')) {
      subcategory = 'Design';
    } else if (lowerUrl.includes('linkedin.com') || lowerTitle.includes('business') || 
               topic.includes('Business')) {
      subcategory = 'Business';
    } else {
      subcategory = 'Tools';
    }
  } else if (mainCategory === 'Learning') {
    if (lowerUrl.includes('coursera') || lowerUrl.includes('udemy') || 
        lowerUrl.includes('edx') || lowerTitle.includes('course')) {
      subcategory = 'Courses';
    } else if (lowerUrl.includes('github.com') || lowerUrl.includes('stackoverflow.com') ||
               lowerTitle.includes('tutorial') || lowerTitle.includes('programming') ||
               lowerTitle.includes('code')) {
      subcategory = 'Programming';
    } else if (lowerTitle.includes('documentation') || lowerTitle.includes('docs') ||
               lowerUrl.includes('docs.')) {
      subcategory = 'Research';
    } else {
      subcategory = 'Tutorials';
    }
  } else if (mainCategory === 'Entertainment') {
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('vimeo') || 
        lowerTitle.includes('video') || lowerTitle.includes('watch')) {
      subcategory = 'Videos';
    } else if (lowerUrl.includes('reddit.com') || lowerUrl.includes('twitter.com') ||
               lowerUrl.includes('facebook.com') || lowerTitle.includes('social')) {
      subcategory = 'Social';
    } else if (lowerTitle.includes('game') || lowerUrl.includes('steam') ||
               lowerUrl.includes('gaming')) {
      subcategory = 'Games';
    } else if (lowerTitle.includes('news') || lowerUrl.includes('news')) {
      subcategory = 'News';
    } else {
      subcategory = 'Social';
    }
  } else if (mainCategory === 'Shopping') {
    if (lowerUrl.includes('amazon.com') || lowerUrl.includes('electronics') ||
        lowerTitle.includes('tech') || lowerTitle.includes('gadget')) {
      subcategory = 'Tech';
    } else if (lowerTitle.includes('service') || lowerUrl.includes('subscription')) {
      subcategory = 'Services';
    } else {
      subcategory = 'General';
    }
  } else if (mainCategory === 'Reference') {
    if (lowerTitle.includes('documentation') || lowerTitle.includes('api') ||
        lowerUrl.includes('docs.') || lowerTitle.includes('reference')) {
      subcategory = 'Documentation';
    } else if (lowerTitle.includes('tool') || lowerTitle.includes('calculator') ||
               lowerTitle.includes('converter')) {
      subcategory = 'Tools';
    } else {
      subcategory = 'Resources';
    }
  } else if (mainCategory === 'Personal') {
    if (lowerTitle.includes('bank') || lowerTitle.includes('finance') ||
        lowerTitle.includes('investment') || lowerUrl.includes('bank')) {
      subcategory = 'Finance';
    } else if (lowerTitle.includes('health') || lowerTitle.includes('medical') ||
               lowerTitle.includes('fitness')) {
      subcategory = 'Health';
    } else if (lowerTitle.includes('travel') || lowerTitle.includes('hotel') ||
               lowerTitle.includes('flight')) {
      subcategory = 'Travel';
    } else {
      subcategory = 'General';
    }
  }

  return {
    ...classification,
    topic: mainCategory,
    suggestedFolder: `${mainCategory}/${subcategory}`
  };
}

function applyDetailedStrategy(classification) {
  // Keep original detailed structure
  return classification;
}

function applyDomainStrategy(classification) {
  // Organize by website domain
  const url = classification.url || '';
  let domain = 'Other';
  
  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname.replace('www.', '');
    
    // Group similar domains
    if (domain.includes('github.com')) {
      domain = 'GitHub';
    } else if (domain.includes('youtube.com')) {
      domain = 'YouTube';
    } else if (domain.includes('stackoverflow.com')) {
      domain = 'Stack Overflow';
    } else if (domain.includes('medium.com')) {
      domain = 'Medium';
    } else if (domain.includes('amazon.com')) {
      domain = 'Amazon';
    }
  } catch (e) {
    domain = 'Other';
  }

  return {
    ...classification,
    topic: 'By Domain',
    suggestedFolder: `By Domain/${domain}`
  };
}

function applyFlatStrategy(classification) {
  // Minimal folders - just main categories
  const { topic } = classification;
  
  let mainCategory = 'General';
  
  if (topic.includes('Program') || topic.includes('Code') || topic.includes('Tech')) {
    mainCategory = 'Programming';
  } else if (topic.includes('Learn') || topic.includes('Course') || topic.includes('Tutorial')) {
    mainCategory = 'Learning';
  } else if (topic.includes('Entertainment') || topic.includes('Video') || topic.includes('Game')) {
    mainCategory = 'Entertainment';
  } else if (topic.includes('Shop') || topic.includes('Buy')) {
    mainCategory = 'Shopping';
  } else if (topic.includes('Work') || topic.includes('Business')) {
    mainCategory = 'Work';
  }

  return {
    ...classification,
    topic: mainCategory,
    suggestedFolder: mainCategory
  };
}

// Predefined folder structures for different strategies
export const FOLDER_TEMPLATES = {
  simple: {
    'Work': ['Programming', 'Design', 'Business', 'Tools'],
    'Learning': ['Courses', 'Tutorials', 'Documentation', 'Resources'],
    'Entertainment': ['Videos', 'Games', 'Music', 'Social'],
    'Shopping': ['Products', 'Services', 'Deals'],
    'Reference': ['News', 'Articles', 'Resources'],
    'Personal': ['Finance', 'Health', 'Travel', 'Hobbies']
  },
  
  flat: [
    'Programming', 'Learning', 'Entertainment', 'Shopping', 'Work', 'Reference'
  ],
  
  domain: [
    'By Domain'
  ]
};