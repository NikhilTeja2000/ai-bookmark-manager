/**
 * Processing Controller
 * Handles batch processing with stop/resume functionality
 */

class ProcessingController {
  constructor() {
    this.isRunning = false;
    this.shouldStop = false;
    this.currentBatch = 0;
    this.totalBatches = 0;
    this.processedItems = 0;
    this.totalItems = 0;
    this.startTime = null;
    this.onProgress = null;
    this.onItemProgress = null;
    this.onComplete = null;
    this.onError = null;
  }

  async start(items, settings, callbacks = {}) {
    if (this.isRunning) {
      throw new Error('Processing already in progress');
    }

    // Save original state before first organization
    const { saveOriginalState } = await import('./apply.js');
    await saveOriginalState();

    this.isRunning = true;
    this.shouldStop = false;
    this.currentBatch = 0;
    this.processedItems = 0;
    this.totalItems = items.length;
    this.totalBatches = Math.ceil(items.length / 10); // Batch size of 10
    this.startTime = Date.now();
    this.currentMoves = []; // Track moves for snapshot
    
    // Set callbacks
    this.onProgress = callbacks.onProgress;
    this.onItemProgress = callbacks.onItemProgress;
    this.onComplete = callbacks.onComplete;
    this.onError = callbacks.onError;

    // Start processing
    this._processBatches(items, settings);
  }

  stop() {
    if (!this.isRunning) return;
    
    this.shouldStop = true;
    this._notifyProgress({
      status: 'stopping',
      message: 'Stopping after current batch...'
    });
  }

  resume(items, settings, callbacks = {}) {
    if (this.isRunning) {
      throw new Error('Processing already in progress');
    }

    // Resume from where we left off
    const remainingItems = items.slice(this.processedItems);
    if (remainingItems.length === 0) {
      this._notifyComplete();
      return;
    }

    this.start(remainingItems, settings, callbacks);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      currentBatch: this.currentBatch,
      totalBatches: this.totalBatches,
      processedItems: this.processedItems,
      totalItems: this.totalItems,
      progress: this.totalItems > 0 ? this.processedItems / this.totalItems : 0,
      estimatedTimeRemaining: this._getEstimatedTimeRemaining()
    };
  }

  async _processBatches(items, settings) {
    const { classifyBookmarkBatch } = await import('../ai/index.js');
    const { getState } = await import('./state.js');
    
    const batchSize = 10;
    const batches = [];
    
    // Split items into batches
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    this.totalBatches = batches.length;

    try {
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        if (this.shouldStop) {
          this._notifyProgress({
            status: 'stopped',
            message: `Stopped at batch ${batchIndex + 1}/${batches.length}`
          });
          this.isRunning = false;
          return;
        }

        this.currentBatch = batchIndex + 1;
        const batch = batches[batchIndex];

        this._notifyProgress({
          status: 'processing',
          message: `Processing batch ${this.currentBatch}/${this.totalBatches} (${batch.length} bookmarks)`,
          batch: this.currentBatch,
          totalBatches: this.totalBatches
        });

        // Process batch
        const batchResults = await classifyBookmarkBatch(batch, this.onProgress);
        
        if (batchResults) {
          // Process each result in the batch
          for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            const result = batchResults[i];
            
            if (result) {
              await this._processBookmarkResult(item, result, settings);
            }
            
            this.processedItems++;
            
            // Notify item progress
            if (this.onItemProgress) {
              this.onItemProgress({
                current: this.processedItems,
                total: this.totalItems,
                item: item,
                result: result,
                status: result ? 'processed' : 'failed'
              });
            }
          }
        } else {
          // Batch failed, process individually as fallback
          await this._processBatchFallback(batch, settings);
        }

        // Small delay between batches to prevent overwhelming the UI
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this._notifyComplete();
      
    } catch (error) {
      this._notifyError(error);
    } finally {
      this.isRunning = false;
    }
  }

  async _processBatchFallback(batch, settings) {
    const { classifyBookmark } = await import('../ai/index.js');
    
    for (const item of batch) {
      if (this.shouldStop) break;
      
      try {
        const result = await classifyBookmark(item.title, item.url);
        if (result) {
          await this._processBookmarkResult(item, result, settings);
        }
      } catch (error) {
        console.error(`Failed to process ${item.title}:`, error);
      }
      
      this.processedItems++;
      
      if (this.onItemProgress) {
        this.onItemProgress({
          current: this.processedItems,
          total: this.totalItems,
          item: item,
          status: 'processed'
        });
      }
    }
  }

  async _processBookmarkResult(item, result, settings) {
    const { getState } = await import('./state.js');
    const { applyFolderStrategy } = await import('./folder-strategies.js');
    const st = getState();

    // Apply folder strategy to result
    const processedResult = applyFolderStrategy({
      ...result,
      url: item.url
    }, settings.folderStrategy || 'simple');

    // Calculate confidence and make decision
    const confidence = processedResult.confidence || 0.6;
    const threshold = settings.threshold || 0.9;
    
    let decision;
    if (confidence >= threshold) {
      decision = 'auto';
    } else if (confidence >= 0.6) {
      decision = 'review';
    } else {
      decision = 'skip';
    }

    const bookmarkData = {
      ...item,
      suggestedFolder: processedResult.suggestedFolder,
      renameTitle: processedResult.renameTitle,
      confidence: confidence,
      meta: {
        topic: processedResult.topic,
        tags: processedResult.tags,
        reasons: processedResult.reasons,
        confidence: confidence,
        aiClassified: true
      }
    };

    // Apply decision
    if (decision === 'auto') {
      if (!settings.dryRun) {
        const mod = await import('./apply.js');
        
        // Get current bookmark state for snapshot
        const currentBookmark = await chrome.bookmarks.get(item.id).then(x => x[0]).catch(() => null);
        if (currentBookmark) {
          this.currentMoves.push({
            id: item.id,
            prevParentId: currentBookmark.parentId,
            newParentId: null, // Will be set by applyDecisions
            title: currentBookmark.title,
            originalTitle: currentBookmark.title,
            newTitle: bookmarkData.renameTitle
          });
        }
        
        console.log('Applying decision for bookmark:', bookmarkData.title, '→', bookmarkData.suggestedFolder);
        await mod.applyDecisions([{ ...bookmarkData, decision: 'apply' }]);
        console.log('Applied decision successfully');
      }
      st.counts.auto++;
    } else if (decision === 'review') {
      st.review.push(bookmarkData);
      st.counts.review++;
    } else {
      st.counts.skip++;
    }
  }

  _getEstimatedTimeRemaining() {
    if (!this.startTime || this.processedItems === 0) return null;
    
    const elapsed = Date.now() - this.startTime;
    const rate = this.processedItems / elapsed; // items per ms
    const remaining = this.totalItems - this.processedItems;
    
    return Math.round(remaining / rate); // ms remaining
  }

  _notifyProgress(data) {
    if (this.onProgress) {
      this.onProgress({
        ...data,
        ...this.getStatus()
      });
    }
  }

  async _notifyComplete() {
    this.isRunning = false;
    
    // Create snapshot of all moves made during this session
    if (this.currentMoves.length > 0) {
      const { createSnapshot } = await import('./apply.js');
      await createSnapshot(this.currentMoves);
    }
    
    if (this.onComplete) {
      this.onComplete(this.getStatus());
    }
  }

  _notifyError(error) {
    this.isRunning = false;
    if (this.onError) {
      this.onError(error);
    }
  }
}

// Global instance
export const processingController = new ProcessingController();