const express = require('express');
const router = express.Router();
const axios = require('axios'); // To communicate with the Profile Service

router.post('/register', async (req, res) => {
  try {
    const response = await axios.post('http://profile-service:4000/auth/register', req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const response = await axios.post('http://profile-service:4000/auth/login', req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
