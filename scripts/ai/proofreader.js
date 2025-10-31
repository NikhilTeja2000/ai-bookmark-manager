let _proofreader;

export async function ensureProofreader() {
  if (typeof Proofreader === 'undefined') {
    throw new Error('Proofreader API not available');
  }
  
  const avail = await Proofreader.availability?.();
  if (avail === 'unavailable') {
    throw new Error('Proofreader API unavailable');
  }
  
  if (!_proofreader) {
    _proofreader = await Proofreader.create({
      expectedInputLanguages: ['en'],
      includeCorrectionTypes: true,
      includeCorrectionExplanations: true
    });
  }
  
  return _proofreader;
}

export async function proofreadText(text) {
  try {
    const proofreader = await ensureProofreader();
    return await proofreader.proofread(text);
  } catch (error) {
    console.error('Proofreading failed:', error);
    return null;
  }
}