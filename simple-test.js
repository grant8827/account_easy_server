const express = require('express');
const app = express();

app.use(express.json());

app.get('/test', (req, res) => {
  res.json({ message: 'Simple server working!', timestamp: new Date() });
});

app.post('/api/auth/login', (req, res) => {
  console.log('Login request received:', req.body);
  res.json({
    success: true,
    message: 'Test login successful',
    data: {
      user: { 
        id: '1', 
        email: req.body.email, 
        firstName: 'Test', 
        lastName: 'User',
        role: 'admin',
        businesses: []
      },
      token: 'test_token_123',
      refreshToken: 'test_refresh_token_123'
    }
  });
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Simple test server running on port ${PORT}`);
});
