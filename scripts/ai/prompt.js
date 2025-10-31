import { createWithProgress, hasUserActivation } from './model-manager.js';

let _session;

export async function ensurePrompt(opts = {}, onProgress = null) {
  if (typeof LanguageModel === "undefined") {
    throw new Error("LanguageModel API not available");
  }

  if (!_session) {
    // Check if user activation is required
    const availability = await LanguageModel.availability?.(opts);

    if (availability === "unavailable") {
      throw new Error("Prompt API unavailable on this device");
    }

    if (availability === "downloadable" && !hasUserActivation()) {
      throw new Error("User interaction required to download model. Please click a button to start.");
    }

    _session = await createWithProgress(
      'Prompt',
      (options) => LanguageModel.create(options),
      {
        outputLanguage: "en",
        ...opts,
      },
      onProgress
    );
  }

  return _session;
}

export async function classifyBookmark(title, url, content = "", onProgress = null) {
  const session = await ensurePrompt({}, onProgress);

  const schema = {
    type: "object",
    required: [
      "topic",
      "suggestedFolder",
      "tags",
      "renameTitle",
      "confidence",
      "reasons",
    ],
    properties: {
      topic: { type: "string" },
      suggestedFolder: { type: "string" },
      tags: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 6,
      },
      renameTitle: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      reasons: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 3,
      },
    },
  };

  const prompt = `Analyze this bookmark and classify it for smart organization. Return JSON only.

URL: ${url}
Title: ${title}
${content ? `Content preview: ${content.slice(0, 500)}` : ""}

You are an intelligent bookmark organizer. Analyze this bookmark and categorize it logically.

Look at the URL domain and title to understand what this bookmark is for. Use your knowledge of common websites and their purposes.

Create a logical 2-level folder structure like:
- Work/Programming, Work/Design, Work/Business
- Learning/Courses, Learning/Programming, Learning/Research  
- Entertainment/Videos, Entertainment/Social, Entertainment/Games
- Shopping/Electronics, Shopping/Services
- Reference/Documentation, Reference/News
- Personal/Finance, Personal/Health, Personal/Travel

Be specific and logical. Avoid generic "General" folders.

Return JSON with:
- topic: The specific category (e.g., "Programming", "Videos", "Courses")
- suggestedFolder: Two-level path (e.g., "Work/Programming")
- tags: 1-6 relevant tags for search
- renameTitle: Improved title (max 60 chars, keep it descriptive)
- confidence: 0-1 how confident you are in this classification
- reasons: 1-3 brief reasons for this classification`;

  try {
    const response = await session.prompt(prompt, {
      responseConstraint: schema,
      outputLanguage: "en",
    });

    return JSON.parse(response);
  } catch (error) {
    console.error("Classification failed:", error);
    return null;
  }
}

// New batch classification function
export async function classifyBookmarkBatch(bookmarks, onProgress = null) {
  const session = await ensurePrompt({}, onProgress);

  const schema = {
    type: "object",
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          required: ["index", "topic", "suggestedFolder", "tags", "renameTitle", "confidence", "reasons"],
          properties: {
            index: { type: "number" },
            topic: { type: "string" },
            suggestedFolder: { type: "string" },
            tags: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
            renameTitle: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reasons: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 }
          }
        }
      }
    }
  };

  const bookmarkList = bookmarks.map((bookmark, index) =>
    `${index}: URL: ${bookmark.url} | Title: ${bookmark.title}`
  ).join('\n');

  const prompt = `Analyze these ${bookmarks.length} bookmarks and classify each for smart organization. Return JSON only.

Bookmarks:
${bookmarkList}

You are an intelligent bookmark organizer. For each bookmark, analyze the URL and title to categorize it logically.

Create logical 2-level folder structures. Be specific and avoid generic "General" folders.

Examples: Work/Programming, Learning/Courses, Entertainment/Videos, Shopping/Electronics

Return JSON with results array containing for each bookmark:
- index: bookmark number (0-${bookmarks.length - 1})
- topic: Main category only (Work, Learning, Entertainment, Shopping, Reference, Personal)
- suggestedFolder: Simple path like "Work/Programming" or "Learning/Courses"
- tags: 1-6 relevant tags for search
- renameTitle: Improved title (max 60 chars, keep it descriptive)
- confidence: 0-1 how confident you are in this classification
- reasons: 1-3 brief reasons for this classification`;

  try {
    const response = await session.prompt(prompt, {
      responseConstraint: schema,
      outputLanguage: "en",
    });

    const result = JSON.parse(response);
    return result.results || [];
  } catch (error) {
    console.error("Batch classification failed:", error);
    return null;
  }
}
