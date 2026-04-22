require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const sttService = require('./services/sttService');
const translationService = require('./services/translationService');
const Transcript = require('./models/Transcript');

const app = express();
const server = http.createServer(app);
const upload = multer({ dest: 'uploads/' });
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { sourceLang, targetLang } = req.body;
        const filePath = req.file.path;
        const mimetype = req.file.mimetype;
        
        let originalText = '';
        
        if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) {
            originalText = await sttService.transcribeFile(filePath, sourceLang);
        } else if (mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            originalText = data.text;
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: filePath });
            originalText = result.value;
        } else if (mimetype === 'text/plain') {
            originalText = fs.readFileSync(filePath, 'utf8');
        } else {
            return res.status(400).json({ error: 'Unsupported file type' });
        }

        if (!originalText || originalText.trim() === '') {
            return res.status(500).json({ error: 'Failed to extract text from file or file is empty' });
        }
        
        const translatedText = await translationService.translate(originalText, sourceLang, targetLang);
        
        try { fs.unlinkSync(filePath); } catch (e) { }
        
        res.json({ originalText, translatedText });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Internal server error processing file' });
    }
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/translator';
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Socket.IO Handling
const activeConnections = new Map(); // socketId -> dgConnection

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('start-stream', async ({ roomId, sourceLang, targetLang }) => {
        console.log(`Starting stream for room ${roomId}`);
        
        const dgConnection = await sttService.startStreaming(sourceLang, async (text, isFinal) => {
            // Emit transcript to the room
            socket.emit('transcript-update', { text, isFinal, type: 'source' });

            if (isFinal) {
                // Translate
                const translated = await translationService.translate(text, sourceLang, targetLang);
                socket.emit('transcript-update', { text: translated, isFinal: true, type: 'translated' });

                // Save to DB
                try {
                    await Transcript.create({
                        sessionId: roomId,
                        originalText: text,
                        translatedText: translated,
                        sourceLanguage: sourceLang,
                        targetLanguage: targetLang
                    });
                } catch (err) {
                    console.error('Failed to save transcript:', err);
                }
            }
        });

        if (dgConnection) {
            activeConnections.set(socket.id, dgConnection);
        }
    });

    socket.on('audio-chunk', (data) => {
        const dgConnection = activeConnections.get(socket.id);
        if (dgConnection) {
            if (dgConnection.getReadyState() === 1) {
                dgConnection.send(data);
            } else if (dgConnection.getReadyState() === 0) {
                if (!dgConnection.chunkBuffer) dgConnection.chunkBuffer = [];
                dgConnection.chunkBuffer.push(data);
            }
        }
    });

    socket.on('stop-stream', () => {
        const dgConnection = activeConnections.get(socket.id);
        if (dgConnection) {
            dgConnection.finish();
            activeConnections.delete(socket.id);
        }
    });

    socket.on('disconnect', () => {
        const dgConnection = activeConnections.get(socket.id);
        if (dgConnection) {
            dgConnection.finish();
            activeConnections.delete(socket.id);
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
