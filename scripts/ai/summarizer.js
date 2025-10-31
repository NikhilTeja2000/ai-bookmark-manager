let _summarizer;

export async function ensureSummarizer() {
  if (typeof Summarizer === 'undefined') {
    throw new Error('Summarizer API not available');
  }
  
  const avail = await Summarizer.availability();
  if (avail === 'unavailable') {
    throw new Error('Summarizer API unavailable');
  }
  
  if (!_summarizer) {
    _summarizer = await Summarizer.create({
      type: 'key-points',
      length: 'medium',
      format: 'markdown'
    });
  }
  
  return _summarizer;
}

export async function summarizeContent(text) {
  try {
    const summarizer = await ensureSummarizer();
    return await summarizer.summarize(text);
  } catch (error) {
    console.error('Summarization failed:', error);
    return null;
  }
}