const { createClient } = require('@deepgram/sdk');
const fs = require('fs');

class STTService {
    constructor() {
        this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    }

    async startStreaming(sourceLang, onTranscript) {
        if (!process.env.DEEPGRAM_API_KEY) {
            console.warn('DEEPGRAM_API_KEY is missing. STT will not work.');
            return null;
        }

        const options = {
            interim_results: true,
            language: sourceLang || 'en',
            smart_format: true,
        };

        if (sourceLang === 'ar') {
            options.model = 'nova-3';
        } else if (['en', 'es', 'fr', 'hi'].includes(sourceLang)) {
            options.model = 'nova-2';
        } else {
            // Unspecified default
            options.model = 'nova-2'; 
        }

        const dgConnection = this.deepgram.listen.live(options);

        dgConnection.on('open', () => {
            console.log('Deepgram connection opened');
            if (dgConnection.chunkBuffer) {
                dgConnection.chunkBuffer.forEach(chunk => dgConnection.send(chunk));
                dgConnection.chunkBuffer = null;
            }
        });

        dgConnection.on('Results', (data) => {
            console.log('RESULTS:', JSON.stringify(data));
            const transcript = data.channel.alternatives[0].transcript;
            if (transcript && data.is_final) {
                onTranscript(transcript, true);
            } else if (transcript) {
                onTranscript(transcript, false);
            }
        });

        dgConnection.on('error', (err) => {
            console.error('Deepgram Error:', err);
        });

        dgConnection.on('close', () => {
            console.log('Deepgram connection closed');
        });

        return dgConnection;
    }

    async transcribeFile(filePath, sourceLang) {
        if (!process.env.DEEPGRAM_API_KEY) {
            console.warn('DEEPGRAM_API_KEY is missing. STT will not work.');
            return null;
        }

        const options = {
            language: sourceLang || 'en',
            smart_format: true,
            model: 'nova-2'
        };
        
        if (sourceLang === 'ar') {
            options.model = 'nova-3';
        }

        try {
            const fileBuffer = fs.readFileSync(filePath);
            const { result, error } = await this.deepgram.listen.prerecorded.transcribeFile(
                fileBuffer,
                options
            );

            if (error) {
                console.error('Deepgram Error:', error);
                return null;
            }

            const transcript = result?.results?.channels[0]?.alternatives[0]?.transcript;
            return transcript;
        } catch (err) {
            console.error('Failed to transcribe file with Deepgram:', err);
            return null;
        }
    }
}

module.exports = new STTService();
