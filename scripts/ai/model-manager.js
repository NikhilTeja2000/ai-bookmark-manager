/**
 * Model Download Progress Manager
 * Handles model downloads with user-friendly progress indicators
 */

class ModelDownloadManager {
  constructor() {
    this.downloadStates = new Map();
    this.progressCallbacks = new Map();
  }

  /**
   * Create a session with download progress monitoring
   * @param {string} apiName - Name of the API (e.g., 'Prompt', 'Summarizer')
   * @param {Function} createFn - Function to create the session
   * @param {Object} options - Options to pass to create function
   * @param {Function} onProgress - Progress callback
   * @returns {Promise} Session instance
   */
  async createWithProgress(apiName, createFn, options = {}, onProgress = null) {
    const key = `${apiName}-${JSON.stringify(options)}`;
    
    // Check if already downloading
    if (this.downloadStates.has(key)) {
      const state = this.downloadStates.get(key);
      if (state.status === 'downloading') {
        // Wait for existing download
        return state.promise;
      }
    }

    // Create new download state
    const downloadState = {
      status: 'checking',
      progress: 0,
      promise: null
    };
    
    this.downloadStates.set(key, downloadState);
    
    if (onProgress) {
      this.progressCallbacks.set(key, onProgress);
    }

    try {
      downloadState.promise = this._createSession(apiName, createFn, options, key);
      const session = await downloadState.promise;
      
      downloadState.status = 'ready';
      downloadState.progress = 1;
      this._notifyProgress(key, { status: 'ready', progress: 1 });
      
      return session;
      
    } catch (error) {
      downloadState.status = 'error';
      downloadState.error = error;
      this._notifyProgress(key, { status: 'error', error });
      throw error;
    }
  }

  async _createSession(apiName, createFn, options, key) {
    let modelNewlyDownloaded = false;
    
    const sessionOptions = {
      ...options,
      monitor: (monitor) => {
        monitor.addEventListener('downloadprogress', (event) => {
          const progress = event.loaded;
          const downloadState = this.downloadStates.get(key);
          
          if (downloadState) {
            downloadState.progress = progress;
            downloadState.status = progress < 1 ? 'downloading' : 'extracting';
          }
          
          this._notifyProgress(key, {
            status: progress < 1 ? 'downloading' : 'extracting',
            progress,
            loaded: event.loaded,
            total: event.total
          });
          
          if (modelNewlyDownloaded && progress === 1) {
            // Model extraction and loading phase
            this._notifyProgress(key, {
              status: 'extracting',
              progress: 1,
              message: 'Extracting and loading model...'
            });
          }
        });
      }
    };

    // Check availability first
    const availability = await this._checkAvailability(apiName, options);
    
    if (availability === 'unavailable') {
      throw new Error(`${apiName} API is not available on this device`);
    }
    
    if (availability !== 'available') {
      modelNewlyDownloaded = true;
      this._notifyProgress(key, { 
        status: 'downloading', 
        progress: 0,
        message: `Downloading ${apiName} model...`
      });
    }

    return await createFn(sessionOptions);
  }

  async _checkAvailability(apiName, options) {
    switch (apiName) {
      case 'Prompt':
        return await LanguageModel.availability?.(options);
      case 'Summarizer':
        return await Summarizer.availability?.(options);
      case 'Writer':
        return await Writer.availability?.(options);
      case 'Rewriter':
        return await Rewriter.availability?.(options);
      case 'Proofreader':
        return await Proofreader.availability?.(options);
      case 'Translator':
        return await Translator.availability?.(options);
      case 'LanguageDetector':
        return await LanguageDetector.availability?.(options);
      default:
        return 'unavailable';
    }
  }

  _notifyProgress(key, progressData) {
    const callback = this.progressCallbacks.get(key);
    if (callback) {
      callback(progressData);
    }
    
    // Also emit a custom event for UI components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai-model-progress', {
        detail: { key, ...progressData }
      }));
    }
  }

  /**
   * Get current download state for a model
   */
  getDownloadState(apiName, options = {}) {
    const key = `${apiName}-${JSON.stringify(options)}`;
    return this.downloadStates.get(key) || { status: 'unknown', progress: 0 };
  }

  /**
   * Clear download state (useful for testing)
   */
  clearState(apiName, options = {}) {
    const key = `${apiName}-${JSON.stringify(options)}`;
    this.downloadStates.delete(key);
    this.progressCallbacks.delete(key);
  }
}

// Global instance
export const modelManager = new ModelDownloadManager();

/**
 * Helper function to create sessions with progress
 */
export async function createWithProgress(apiName, createFn, options = {}, onProgress = null) {
  return modelManager.createWithProgress(apiName, createFn, options, onProgress);
}

/**
 * User activation helper
 */
export function requiresUserActivation() {
  return navigator.userActivation && !navigator.userActivation.isActive;
}

/**
 * Check if user activation is available
 */
export function hasUserActivation() {
  return navigator.userActivation && navigator.userActivation.isActive;
}