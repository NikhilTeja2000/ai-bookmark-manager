# AI Bookmark Manager

A Chrome extension that automatically organizes bookmarks using Chrome's built-in AI APIs (Gemini Nano). **100% on-device processing** - no server calls, complete privacy, works offline.

## ✨ What It Does

Transform your chaotic bookmark collection into a **perfectly organized folder structure** using AI that understands what each bookmark is for.

### 🤖 Intelligent Organization

- **Smart Classification**: AI analyzes bookmark titles and URLs to understand their purpose
- **Logical Folder Structure**: Creates intuitive 2-level folders (Work/Programming, Entertainment/Videos, Learning/Courses)
- **Batch Processing**: Organizes hundreds of bookmarks in seconds (10x faster than one-by-one)
- **Context-Aware**: Detects what folder you're viewing and organizes accordingly

### ⚡ Key Features

- **Batch Processing**: Process 10 bookmarks simultaneously for 10x speed improvement
- **Stop/Resume Control**: Full control - stop anytime, resume exactly where you left off
- **Smart Folder Detection**: Works with any Chrome bookmark structure (auto-detects folder IDs)
- **Dry Run Mode**: Preview what will happen before actually moving bookmarks
- **Real-time Progress**: See exactly what's being organized with live progress updates
- **Complete Reset**: One-click return to original bookmark state

### 🎯 Perfect Results

Instead of messy bookmarks everywhere, get organized folders like:
- **Work/Programming** - GitHub repos, Stack Overflow, coding tools
- **Entertainment/Videos** - YouTube, streaming sites, video content  
- **Learning/Courses** - Coursera, educational content, tutorials
- **Shopping/Electronics** - Amazon, tech products, gadgets
- **Reference/Documentation** - API docs, technical references

### 🎛️ User Control

- **Confidence Threshold**: Control how selective the AI is (70-95%)
- **Scope Selection**: Organize all bookmarks, just Bookmarks Bar, or current folder
- **Review Queue**: Manually approve uncertain classifications
- **Undo/Reset System**: Complete control over changes

## Installation

### For Development/Testing

1. Clone this repository
2. Open Chrome → Extensions → Enable Developer Mode
3. Click "Load unpacked" → Select this folder
4. Note the Extension ID from the details

### Origin Trial Setup

1. Visit [Chrome Origin Trials](https://developer.chrome.com/origintrials/)
2. Register for these trials using your Extension ID:
   - Writer API
   - Prompt API (Multimodal Input)
   - Proofreader API
3. Copy the tokens into `manifest.json` under `origin_trial_tokens`
4. Reload the extension

## Usage

### Quick Start

1. **Install extension** → Click the AI Bookmarks icon
2. **Dashboard tab** → Click "🤖 Organize" 
3. **Watch the magic** → AI organizes your bookmarks in seconds!

### First Time Setup

1. Go to **Diagnostics** tab → Click "Run Checks"
2. Verify Prompt API shows "available" or "downloadable"
3. Click "Test Classify" to verify AI works
4. If model needs downloading, you'll see progress automatically

### Organizing Your Bookmarks

1. **Choose scope**: All bookmarks, Bookmarks Bar, or current folder
2. **Set confidence**: Higher = more selective (recommended: 75-85%)
3. **Preview first**: Enable "Dry Run" to see what will happen
4. **Click "🤖 Organize"** → Watch real-time progress
5. **Review results** → Check Review tab for uncertain items
6. **Apply for real**: Disable Dry Run and organize again

### Advanced Controls

- **⏹️ Stop/▶️ Resume**: Full control during processing
- **↶ Undo Last**: Revert the most recent organization
- **🔄 Reset All**: Return to original bookmark state
- **🧹 Clear Data**: Clean up extension data

### Smart Features

- **Context Detection**: Automatically detects what folder you're viewing
- **Batch Progress**: See "Processing batch 3/8 - ~2 min remaining"
- **Real-time Updates**: Watch bookmarks being organized live
- **Error Recovery**: Graceful handling of any issues

## Technical Details

### Chrome APIs Used

- **Prompt API (Primary)**: Intelligent bookmark classification using Gemini Nano
- **Language Detector API**: Detects bookmark title languages (available but not actively used)
- **Translator API**: Can translate non-English bookmarks (available but not actively used)
- **Summarizer API**: Available for future enhancements
- **Writer/Rewriter APIs**: Available on supported systems for title improvement

### Requirements

- Chrome 138+ (for stable APIs)
- Hardware: 22GB free storage, GPU >4GB VRAM or CPU 16GB RAM + 4 cores
- Origin trial tokens for experimental APIs

### Privacy & Performance

- **100% On-Device**: All AI processing happens locally with Gemini Nano
- **No Server Calls**: Complete privacy, works offline
- **Batch Processing**: 10x faster - processes 10 bookmarks simultaneously
- **Smart Progress**: Real-time updates with time estimates
- **Network Resilient**: Continues working without internet
- **Universal Compatibility**: Auto-detects Chrome bookmark structure (works on any Chrome instance)

## Architecture

```
├── manifest.json          # Extension configuration + origin trial tokens
├── sidepanel.html/js      # Main UI with Dashboard/Review/Settings/Diagnostics
├── service_worker.js      # Background tasks, context menu, auto-organize
├── scripts/
│   ├── ai/               # Chrome Built-in AI API wrappers
│   │   ├── prompt.js     # Bookmark classification
│   │   ├── writer.js     # Title improvement
│   │   └── ...           # Other AI modules
│   └── organizer/        # Core bookmark organization logic
│       ├── classify.js   # AI classification pipeline
│       ├── apply.js      # Folder creation and bookmark moving
│       └── scan.js       # Bookmark tree traversal
```

## Development

### Testing

1. Load extension in Chrome
2. Run diagnostics to verify API availability
3. Test with sample bookmarks using Dry Run mode
4. Check browser console for detailed logs

### Deployment

For Chrome Web Store submission:

1. Update version in manifest.json
2. Ensure all origin trial tokens are valid
3. Test on clean Chrome profile
4. Include clear AI usage disclosure

## What Makes This Special

### 🧠 Intelligent AI Approach
- **Simplified Prompts**: Trusts AI's natural intelligence instead of over-engineering
- **Context Understanding**: AI naturally understands github.com = programming, youtube.com = videos
- **Dynamic Adaptation**: Works with any Chrome bookmark structure automatically

### ⚡ Performance Innovations
- **Batch Processing**: 10x faster than traditional one-by-one processing
- **Smart Progress**: Real-time feedback with time estimates and batch status
- **Universal Compatibility**: Auto-detects bookmark folder IDs (works on any Chrome instance)

### 🎮 User Experience
- **Complete Control**: Stop/resume/undo/reset at any time
- **Context Awareness**: Knows what folder you're viewing and organizes accordingly
- **Progressive Enhancement**: Works immediately, gets better with model downloads

### 🔒 Privacy First
- **100% On-Device**: Uses Chrome's built-in Gemini Nano - no data leaves your computer
- **No Tracking**: No analytics, no server calls, no data collection
- **Offline Capable**: Works without internet connection

## License

MIT License - see LICENSE file for details.
