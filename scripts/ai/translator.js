let _translator;
let _detector;

export async function ensureLanguageDetector() {
  if (!_detector) {
    const availability = await LanguageDetector.availability();
    if (availability === 'unavailable') {
      throw new Error('Language Detector unavailable');
    }
    _detector = await LanguageDetector.create();
  }
  return _detector;
}

export async function ensureTranslator(sourceLanguage = 'en', targetLanguage = 'es') {
  const key = `${sourceLanguage}-${targetLanguage}`;
  
  if (!_translator || _translator.key !== key) {
    const availability = await Translator.availability({ 
      sourceLanguage, 
      targetLanguage 
    });
    
    if (availability === 'unavailable') {
      throw new Error(`Translator unavailable for ${sourceLanguage} → ${targetLanguage}`);
    }
    
    _translator = await Translator.create({ 
      sourceLanguage, 
      targetLanguage 
    });
    _translator.key = key;
  }
  
  return _translator;
}

export async function translateText(text, targetLanguage = 'en') {
  try {
    // First detect the language
    const detector = await ensureLanguageDetector();
    const results = await detector.detect(text);
    
    if (!results || results.length === 0) {
      throw new Error('Could not detect language');
    }
    
    const sourceLanguage = results[0].detectedLanguage;
    
    // Skip translation if already in target language
    if (sourceLanguage === targetLanguage) {
      return { text, sourceLanguage, targetLanguage, translated: false };
    }
    
    // Create translator for detected language pair
    const translator = await ensureTranslator(sourceLanguage, targetLanguage);
    const translatedText = await translator.translate(text);
    
    return { 
      text: translatedText, 
      sourceLanguage, 
      targetLanguage, 
      translated: true,
      confidence: results[0].confidence 
    };
    
  } catch (error) {
    console.error('Translation failed:', error);
    throw error;
  }
}