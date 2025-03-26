const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const watermarkService = require('../services/security/watermarkService');
const reEncryptionService = require('../services/security/reEncryptionService');
const auth = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Watermark endpoints
router.post('/watermark', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const privateKey = watermarkService.generatePrivateKey();
        const outputFile = `uploads/watermarked_${Date.now()}.csv`;

        const result = await watermarkService.insertWatermark(
            req.file.path,
            outputFile,
            privateKey
        );

        res.json({
            message: 'File watermarked successfully',
            watermarkHash: result.watermarkHash,
            markedCount: result.markedCount,
            totalTuples: result.totalTuples,
            outputFile
        });
    } catch (error) {
        console.error('Watermarking error:', error);
        res.status(500).json({ message: 'Error watermarking file' });
    }
});

router.post('/detect-watermark', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { privateKey } = req.body;
        if (!privateKey) {
            return res.status(400).json({ message: 'Private key is required' });
        }

        const result = await watermarkService.detectWatermark(
            req.file.path,
            privateKey
        );

        res.json(result);
    } catch (error) {
        console.error('Watermark detection error:', error);
        res.status(500).json({ message: 'Error detecting watermark' });
    }
});

// Proxy Re-encryption endpoints
router.post('/encrypt', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { publicKey } = req.body;
        if (!publicKey) {
            return res.status(400).json({ message: 'Public key is required' });
        }

        const outputFile = `uploads/encrypted_${Date.now()}.json`;
        const result = await reEncryptionService.processFile(
            req.file.path,
            outputFile,
            'encrypt',
            { publicKey }
        );

        res.json({
            message: 'File encrypted successfully',
            outputFile
        });
    } catch (error) {
        console.error('Encryption error:', error);
        res.status(500).json({ message: 'Error encrypting file' });
    }
});

router.post('/decrypt', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { privateKey } = req.body;
        if (!privateKey) {
            return res.status(400).json({ message: 'Private key is required' });
        }

        const outputFile = `uploads/decrypted_${Date.now()}.txt`;
        const result = await reEncryptionService.processFile(
            req.file.path,
            outputFile,
            'decrypt',
            { privateKey }
        );

        res.json({
            message: 'File decrypted successfully',
            outputFile
        });
    } catch (error) {
        console.error('Decryption error:', error);
        res.status(500).json({ message: 'Error decrypting file' });
    }
});

router.post('/re-encrypt', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { reEncryptionKey } = req.body;
        if (!reEncryptionKey) {
            return res.status(400).json({ message: 'Re-encryption key is required' });
        }

        const outputFile = `uploads/reencrypted_${Date.now()}.json`;
        const result = await reEncryptionService.processFile(
            req.file.path,
            outputFile,
            'reEncrypt',
            { reEncryptionKey }
        );

        res.json({
            message: 'File re-encrypted successfully',
            outputFile
        });
    } catch (error) {
        console.error('Re-encryption error:', error);
        res.status(500).json({ message: 'Error re-encrypting file' });
    }
});

router.post('/generate-re-encryption-key', auth, async (req, res) => {
    try {
        const { privateKey, publicKey } = req.body;
        if (!privateKey || !publicKey) {
            return res.status(400).json({ message: 'Both private and public keys are required' });
        }

        const reEncryptionKey = reEncryptionService.generateReEncryptionKey(
            privateKey,
            publicKey
        );

        res.json({
            message: 'Re-encryption key generated successfully',
            reEncryptionKey
        });
    } catch (error) {
        console.error('Re-encryption key generation error:', error);
        res.status(500).json({ message: 'Error generating re-encryption key' });
    }
});

module.exports = router; 