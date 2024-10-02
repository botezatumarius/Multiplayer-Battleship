const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/create', async (req, res) => {
  try {
    const response = await axios.post('http://battleship-service:5000/game/create', req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create game' });
  }
});

router.post('/attack', async (req, res) => {
  try {
    const response = await axios.post('http://battleship-service:5000/game/attack', req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send attack' });
  }
});

module.exports = router;
