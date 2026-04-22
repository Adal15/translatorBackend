const translate = require('google-translate-api-x');

class TranslationService {
    constructor() {
        // No API keys needed for Google Translate Free API
    }

    async translate(text, sourceLang, targetLang) {
        if (!text || text.trim() === '') return text;

        try {
            // Translate the text directly using free Google Translate
            const response = await translate(text, {
                from: sourceLang === 'en' ? 'en' : sourceLang, 
                to: targetLang 
            });

            return response.text;
        } catch (error) {
            console.error('Translation Error:', error);
            return text;
        }
    }
}

module.exports = new TranslationService();
