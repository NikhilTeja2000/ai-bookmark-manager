import { getState } from './state.js';
import { canonicalizeURL, topicFromURL, buildPath } from './utils.js';
import { classifyBookmark, improveBookmarkTitle } from '../ai/index.js';

async function classifyWithPrompt(item, onProgress = null) {
  try {
    // Try to get page content for better classification
    let content = '';
    try {
      if (item.url.startsWith('http')) {
        // We can't fetch content directly, but we can use the URL and title
        content = `${item.title} ${new URL(item.url).hostname}`;
      }
    } catch (e) {
      // Ignore content fetch errors
    }

    const result = await classifyBookmark(item.title, item.url, content, onProgress);
    return result;
  } catch (error) {
    console.error('AI classification failed:', error);
    
    // If it's a user activation error, re-throw it
    if (error.message.includes('User interaction required')) {
      throw error;
    }
    
    return null;
  }
}

export async function classifyQueue(items, settings, onProgress = null, onItemProgress = null) {
  const st = getState();
  st.counts = { auto: 0, review: 0, skip: 0, duplicates: 0, errors: 0 };
  st.review = [];
  const seen = new Map();

  console.log(`Starting classification of ${items.length} bookmarks...`);
  
  // Track if we need user activation for the first AI call
  let needsUserActivation = false;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    
    // Report progress for current item
    if (onItemProgress) {
      onItemProgress({
        current: i + 1,
        total: items.length,
        item: it,
        status: 'analyzing'
      });
    }
    
    try {
      // Check for duplicates
      const canon = canonicalizeURL(it.url);
      if (seen.has(canon)) {
        st.counts.duplicates++;
        continue;
      }
      seen.set(canon, true);

      // Create fallback classification
      const baseTopic = topicFromURL(it.url);
      const fallback = {
        topic: baseTopic,
        suggestedFolder: buildPath('AI Collections', baseTopic),
        tags: [baseTopic],
        renameTitle: it.title,
        confidence: 0.65,
        reasons: ["URL-based heuristic classification"]
      };

      // Try AI classification
      let classification = null;
      try {
        // Pass progress callback for the first item to handle model download
        const progressCallback = (i === 0) ? onProgress : null;
        classification = await classifyWithPrompt(it, progressCallback);
      } catch (aiError) {
        if (aiError.message.includes('User interaction required')) {
          needsUserActivation = true;
          throw aiError; // Re-throw to stop processing
        }
        console.warn(`AI classification failed for ${it.title}:`, aiError);
      }

      // Use AI result or fallback
      const result = classification || fallback;
      
      // Improve title if requested and AI is available
      if (settings.autoRename && classification) {
        try {
          const improvedTitle = await improveBookmarkTitle(it.title, it.url);
          if (improvedTitle && improvedTitle !== it.title) {
            result.renameTitle = improvedTitle;
          }
        } catch (titleError) {
          console.warn(`Title improvement failed for ${it.title}:`, titleError);
        }
      }

      // Calculate final confidence (blend AI + heuristic)
      const aiConfidence = classification?.confidence || 0.6;
      const heuristicConfidence = fallback.confidence;
      const finalConfidence = classification ? 
        (0.7 * aiConfidence + 0.3 * heuristicConfidence) : 
        heuristicConfidence;

      // Make decision based on confidence threshold
      const threshold = settings.threshold || 0.9;
      let decision;
      if (finalConfidence >= threshold) {
        decision = 'auto';
      } else if (finalConfidence >= 0.6) {
        decision = 'review';
      } else {
        decision = 'skip';
      }

      // Apply decision
      const bookmarkData = {
        ...it,
        suggestedFolder: result.suggestedFolder,
        renameTitle: result.renameTitle,
        confidence: finalConfidence,
        meta: {
          topic: result.topic,
          tags: result.tags,
          reasons: result.reasons,
          confidence: finalConfidence,
          aiClassified: !!classification
        }
      };

      if (decision === 'auto') {
        if (!settings.dryRun) {
          const mod = await import('./apply.js');
          await mod.applyDecisions([{ ...bookmarkData, decision: 'apply' }]);
          
          // Report successful organization
          if (onItemProgress) {
            onItemProgress({
              current: i + 1,
              total: items.length,
              item: it,
              status: 'organized',
              folder: result.suggestedFolder,
              action: 'moved'
            });
          }
        } else {
          // Report what would happen in dry run
          if (onItemProgress) {
            onItemProgress({
              current: i + 1,
              total: items.length,
              item: it,
              status: 'would-organize',
              folder: result.suggestedFolder,
              action: 'dry-run'
            });
          }
        }
        st.counts.auto++;
      } else if (decision === 'review') {
        st.review.push(bookmarkData);
        st.counts.review++;
        
        if (onItemProgress) {
          onItemProgress({
            current: i + 1,
            total: items.length,
            item: it,
            status: 'needs-review',
            folder: result.suggestedFolder,
            confidence: finalConfidence
          });
        }
      } else {
        st.counts.skip++;
        
        if (onItemProgress) {
          onItemProgress({
            current: i + 1,
            total: items.length,
            item: it,
            status: 'skipped',
            reason: 'low-confidence'
          });
        }
      }

      // Progress logging
      if ((i + 1) % 10 === 0 || i === items.length - 1) {
        console.log(`Processed ${i + 1}/${items.length} bookmarks`);
      }

    } catch (error) {
      st.counts.errors++;
      console.error(`Error processing bookmark ${it.title}:`, error);
    }
  }

  console.log('Classification complete:', st.counts);
}
