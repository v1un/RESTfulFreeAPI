// Routes for AI chat functionality
const express = require('express');
const { handleChatMessage } = require('../controllers/aiController');

const router = express.Router();

// POST route for handling chat messages
router.post('/chat', handleChatMessage);

module.exports = router;