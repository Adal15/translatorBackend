const mongoose = require('mongoose');

const transcriptSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    speakerId: {
        type: String,
        default: 'speaker_1'
    },
    originalText: {
        type: String,
        required: true
    },
    translatedText: {
        type: String,
    },
    sourceLanguage: {
        type: String,
        default: 'en'
    },
    targetLanguage: {
        type: String,
        default: 'es'
    },
    confidence: {
        type: Number
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Transcript', transcriptSchema);
