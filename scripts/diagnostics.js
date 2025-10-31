import { classifyBookmark, improveBookmarkTitle } from './ai/index.js';

export async function runDiagnostics(opts = {}) {
  const log = [];
  const badges = [];
  
  function badge(name, status, cls) { 
    badges.push({ name, status, class: cls }); 
  }

  // Extension info
  try { 
    log.push(`Extension ID: ${chrome.runtime.id}`); 
  } catch(e) { 
    log.push(`Extension ID: <error: ${e}>`); 
  }

  // Check Chrome version
  try {
    const info = await chrome.system.cpu.getInfo();
    log.push(`Chrome version: ${navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown'}`);
  } catch(e) {
    log.push(`System info unavailable: ${e}`);
  }

  // Test API availability
  const apis = [
    { 
      name: 'Prompt API', 
      test: async () => {
        if (typeof LanguageModel === 'undefined') return 'not-supported';
        return await LanguageModel.availability?.() || 'unavailable';
      }
    },
    { 
      name: 'Writer API', 
      test: async () => {
        if (typeof Writer === 'undefined') return 'not-supported';
        return await Writer.availability?.() || 'unavailable';
      }
    },
    { 
      name: 'Proofreader API', 
      test: async () => {
        if (typeof Proofreader === 'undefined') return 'not-supported';
        return await Proofreader.availability?.() || 'unavailable';
      }
    },
    { 
      name: 'Summarizer API', 
      test: async () => {
        if (typeof Summarizer === 'undefined') return 'not-supported';
        return await Summarizer.availability?.() || 'unavailable';
      }
    },
    { 
      name: 'Translator API', 
      test: async () => {
        if (typeof Translator === 'undefined') return 'not-supported';
        try {
          return await Translator.availability?.({ sourceLanguage: 'en', targetLanguage: 'es' }) || 'unavailable';
        } catch (e) {
          return 'error - ' + e.message;
        }
      }
    },
    { 
      name: 'Language Detector API', 
      test: async () => {
        if (typeof LanguageDetector === 'undefined') return 'not-supported';
        try {
          return await LanguageDetector.availability?.() || 'unavailable';
        } catch (e) {
          return 'error - ' + e.message;
        }
      }
    }
  ];

  for (const api of apis) {
    try {
      const status = await api.test();
      let cls = 'err';
      
      if (status === 'available' || status === 'after-download') {
        cls = 'ok';
      } else if (status === 'not-supported') {
        cls = 'warn';
      }
      
      badge(api.name, status || 'unavailable', cls);
      log.push(`${api.name}: ${status}`);
    } catch(e) {
      badge(api.name, 'error', 'err');
      log.push(`${api.name}: error - ${e.message}`);
    }
  }

  // Test bookmark permissions
  try {
    const bookmarks = await chrome.bookmarks.getTree();
    log.push(`Bookmarks permission: OK (${bookmarks.length} root nodes)`);
  } catch(e) {
    log.push(`Bookmarks permission: ERROR - ${e.message}`);
  }

  // Sample classification test
  if (opts.sample) {
    log.push('\n--- Sample Classification Test ---');
    
    try {
      const testBookmark = {
        title: 'GitHub - microsoft/vscode: Visual Studio Code',
        url: 'https://github.com/microsoft/vscode'
      };
      
      log.push(`Testing with: ${testBookmark.title}`);
      log.push(`URL: ${testBookmark.url}`);
      
      const result = await classifyBookmark(
        testBookmark.title, 
        testBookmark.url
      );
      
      if (result) {
        log.push('✅ Classification successful:');
        log.push(`  Topic: ${result.topic}`);
        log.push(`  Folder: ${result.suggestedFolder}`);
        log.push(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        log.push(`  Tags: ${result.tags.join(', ')}`);
        log.push(`  Improved title: ${result.renameTitle}`);
        log.push(`  Reasons: ${result.reasons.join('; ')}`);
      } else {
        log.push('❌ Classification returned null');
      }
      
    } catch(e) {
      log.push(`❌ Sample classification failed: ${e.message}`);
    }

    // Test title improvement
    try {
      log.push('\n--- Title Improvement Test ---');
      const originalTitle = 'Home - Microsoft';
      const improvedTitle = await improveBookmarkTitle(
        originalTitle, 
        'https://www.microsoft.com'
      );
      log.push(`Original: "${originalTitle}"`);
      log.push(`Improved: "${improvedTitle}"`);
    } catch(e) {
      log.push(`Title improvement test failed: ${e.message}`);
    }
  }

  return { log, badges };
}
