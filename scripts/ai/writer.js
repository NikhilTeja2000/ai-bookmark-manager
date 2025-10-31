let _writer;

export async function ensureWriter() {
  if (typeof Writer === 'undefined') {
    throw new Error('Writer API not available');
  }
  
  const avail = await Writer.availability?.();
  if (avail === 'unavailable') {
    throw new Error('Writer API unavailable');
  }
  
  if (!_writer) {
    _writer = await Writer.create();
  }
  
  return _writer;
}

export async function improveBookmarkTitle(originalTitle, url, context = '') {
  try {
    const writer = await ensureWriter();
    
    const prompt = `Improve this bookmark title to be more descriptive and organized. Keep it under 60 characters.

Original title: "${originalTitle}"
URL: ${url}
${context ? `Context: ${context.slice(0, 200)}` : ''}

Make it clear, descriptive, and useful for bookmark organization. Remove unnecessary words like "Home", "Welcome", generic terms. Focus on the main purpose or content.`;

    const improved = await writer.write(prompt);
    return improved.trim().slice(0, 60);
  } catch (error) {
    console.error('Title improvement failed:', error);
    return originalTitle;
  }
}