/**
 * Progress Indicator UI Component
 * Shows model download progress with user-friendly messages
 */

export class ProgressIndicator {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.isVisible = false;
    this.currentStatus = null;
    
    this.createElements();
    this.bindEvents();
  }

  createElements() {
    this.element = document.createElement('div');
    this.element.className = 'ai-progress-indicator';
    this.element.style.display = 'none';
    
    this.element.innerHTML = `
      <div class="progress-content">
        <div class="progress-icon">🤖</div>
        <div class="progress-text">
          <div class="progress-title">Preparing AI Model</div>
          <div class="progress-message">Getting ready...</div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <div class="progress-percent">0%</div>
        </div>
      </div>
    `;
    
    this.container.appendChild(this.element);
    
    // Get references to elements
    this.titleEl = this.element.querySelector('.progress-title');
    this.messageEl = this.element.querySelector('.progress-message');
    this.fillEl = this.element.querySelector('.progress-fill');
    this.percentEl = this.element.querySelector('.progress-percent');
  }

  bindEvents() {
    // Listen for global progress events
    if (typeof window !== 'undefined') {
      window.addEventListener('ai-model-progress', (event) => {
        this.updateProgress(event.detail);
      });
    }
  }

  show() {
    this.isVisible = true;
    this.element.style.display = 'block';
    this.element.classList.add('visible');
  }

  hide() {
    this.isVisible = false;
    this.element.classList.remove('visible');
    setTimeout(() => {
      if (!this.isVisible) {
        this.element.style.display = 'none';
      }
    }, 300);
  }

  updateProgress({ status, progress = 0, message, error }) {
    if (!this.isVisible && status !== 'ready' && status !== 'error') {
      this.show();
    }

    this.currentStatus = status;
    
    // Update progress bar
    const percent = Math.round(progress * 100);
    this.fillEl.style.width = `${percent}%`;
    this.percentEl.textContent = `${percent}%`;
    
    // Update status messages
    switch (status) {
      case 'checking':
        this.titleEl.textContent = 'Checking AI Model';
        this.messageEl.textContent = 'Verifying model availability...';
        break;
        
      case 'downloading':
        this.titleEl.textContent = 'Downloading AI Model';
        this.messageEl.textContent = message || `Downloading model... ${percent}%`;
        this.element.className = 'ai-progress-indicator downloading';
        break;
        
      case 'extracting':
        this.titleEl.textContent = 'Loading AI Model';
        this.messageEl.textContent = message || 'Extracting and loading model into memory...';
        this.element.className = 'ai-progress-indicator extracting';
        // Show indeterminate progress
        this.fillEl.style.width = '100%';
        this.fillEl.classList.add('indeterminate');
        this.percentEl.textContent = '';
        break;
        
      case 'ready':
        this.titleEl.textContent = 'AI Model Ready';
        this.messageEl.textContent = 'Model loaded successfully!';
        this.element.className = 'ai-progress-indicator ready';
        this.fillEl.style.width = '100%';
        this.fillEl.classList.remove('indeterminate');
        this.percentEl.textContent = '✓';
        
        // Auto-hide after success
        setTimeout(() => this.hide(), 2000);
        break;
        
      case 'error':
        this.titleEl.textContent = 'Model Error';
        this.messageEl.textContent = error?.message || 'Failed to load AI model';
        this.element.className = 'ai-progress-indicator error';
        this.fillEl.style.width = '0%';
        this.percentEl.textContent = '✗';
        
        // Auto-hide after error
        setTimeout(() => this.hide(), 5000);
        break;
    }
  }

  reset() {
    this.hide();
    this.currentStatus = null;
    this.fillEl.style.width = '0%';
    this.fillEl.classList.remove('indeterminate');
    this.percentEl.textContent = '0%';
    this.element.className = 'ai-progress-indicator';
  }
}

// CSS styles (to be added to your main CSS file)
export const progressStyles = `
.ai-progress-indicator {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.3s ease;
}

.ai-progress-indicator.visible {
  opacity: 1;
  transform: translateY(0);
}

.progress-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-icon {
  font-size: 24px;
  animation: pulse 2s infinite;
}

.progress-text {
  flex: 1;
  min-width: 0;
}

.progress-title {
  font-weight: 600;
  color: #495057;
  margin-bottom: 4px;
}

.progress-message {
  font-size: 14px;
  color: #6c757d;
}

.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-fill.indeterminate {
  animation: indeterminate 2s infinite;
}

.progress-percent {
  font-size: 12px;
  font-weight: 600;
  color: #495057;
  min-width: 30px;
  text-align: right;
}

.ai-progress-indicator.downloading .progress-fill {
  background: #007bff;
}

.ai-progress-indicator.extracting .progress-fill {
  background: #ffc107;
}

.ai-progress-indicator.ready .progress-fill {
  background: #28a745;
}

.ai-progress-indicator.error {
  background: #f8d7da;
  border-color: #f5c6cb;
}

.ai-progress-indicator.error .progress-fill {
  background: #dc3545;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
`;