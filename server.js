// ============================================
//   ChromaSense — Backend API (server.js)
//   Node.js + Express + MongoDB + JWT Auth
// ============================================

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'chromasense-secret-key-change-in-production';

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chromasense';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ============================================
//   SCHEMAS
// ============================================

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  age: { type: String, default: '18-35' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Test Result Schema
const testResultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cvdType: { type: String, required: true },
  severity: { type: String, default: 'None' },
  overallScore: { type: Number, required: true },
  moduleScores: {
    ishihara: { type: Number, default: 0 },
    colorid: { type: Number, default: 0 },
    gradient: { type: Number, default: 0 }
  },
  totalQuestions: { type: Number, default: 0 },
  answers: [{ type: Object }],
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const TestResult = mongoose.model('TestResult', testResultSchema);

// ============================================
//   MIDDLEWARE
// ============================================
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500', 'null', 'file://'],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Auth Middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.user = await User.findById(decoded.userId).select('-password');
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Log every request
app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
//   AUTH ROUTES
// ============================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, age } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      age: age || '18-35'
    });
    
    await user.save();
    
    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        age: user.age
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        age: user.age
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ============================================
//   TEST RESULT ROUTES
// ============================================

// Save test result (protected)
app.post('/api/results', authMiddleware, async (req, res) => {
  try {
    const { cvdType, severity, overallScore, moduleScores, totalQuestions, answers } = req.body;
    
    if (!cvdType || overallScore === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = new TestResult({
      userId: req.userId,
      cvdType,
      severity: severity || 'None',
      overallScore,
      moduleScores: moduleScores || {},
      totalQuestions: totalQuestions || 0,
      answers: answers || []
    });
    
    await result.save();
    
    res.status(201).json({
      success: true,
      message: 'Result saved successfully',
      result
    });
  } catch (err) {
    console.error('Save result error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Get user's test results with improvement analysis
app.get('/api/results/my-results', authMiddleware, async (req, res) => {
  try {
    const results = await TestResult.find({ userId: req.userId })
      .sort({ timestamp: -1 })
      .lean();
    
    // Calculate improvement
    let improvement = null;
    if (results.length >= 2) {
      const latest = results[0];
      const previous = results[1];
      
      const scoreDiff = latest.overallScore - previous.overallScore;
      const daysDiff = Math.floor((new Date(latest.timestamp) - new Date(previous.timestamp)) / (1000 * 60 * 60 * 24));
      
      improvement = {
        scoreDiff,
        daysDiff,
        isImproved: scoreDiff > 0,
        message: scoreDiff > 5 
          ? 'Great improvement! Your color vision has significantly improved.'
          : scoreDiff > 0 
          ? 'Slight improvement detected. Keep practicing!'
          : scoreDiff < -5
          ? 'Your score has decreased. Consider consulting an eye specialist.'
          : 'Your vision remains stable.'
      };
    }
    
    // Calculate stats
    const stats = {
      totalTests: results.length,
      averageScore: results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length)
        : 0,
      bestScore: results.length > 0 
        ? Math.max(...results.map(r => r.overallScore))
        : 0,
      firstTestDate: results.length > 0 ? results[results.length - 1].timestamp : null,
      latestTestDate: results.length > 0 ? results[0].timestamp : null
    };
    
    res.json({
      success: true,
      results,
      improvement,
      stats
    });
  } catch (err) {
    console.error('Get results error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Get latest result
app.get('/api/results/latest', authMiddleware, async (req, res) => {
  try {
    const result = await TestResult.findOne({ userId: req.userId })
      .sort({ timestamp: -1 })
      .lean();
    
    if (!result) {
      return res.status(404).json({ error: 'No results found' });
    }
    
    res.json({ success: true, result });
  } catch (err) {
    console.error('Get latest result error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Delete a result
app.delete('/api/results/:id', authMiddleware, async (req, res) => {
  try {
    const result = await TestResult.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }
    
    res.json({ success: true, message: 'Result deleted' });
  } catch (err) {
    console.error('Delete result error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ============================================
//   DASHBOARD ROUTE
// ============================================

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const results = await TestResult.find({ userId: req.userId })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();
    
    // Get improvement trend
    let trend = 'stable';
    if (results.length >= 2) {
      const recent = results.slice(0, 3).reduce((sum, r) => sum + r.overallScore, 0) / Math.min(3, results.length);
      const older = results.slice(-3).reduce((sum, r) => sum + r.overallScore, 0) / Math.min(3, results.length);
      trend = recent > older + 5 ? 'improving' : recent < older - 5 ? 'declining' : 'stable';
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        age: user.age,
        memberSince: user.createdAt
      },
      recentResults: results,
      trend,
      totalTests: await TestResult.countDocuments({ userId: req.userId })
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ============================================
//   HEALTH CHECK
// ============================================

app.get('/', (_req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'ChromaSense API running with MongoDB',
    version: '2.0.0',
    port: PORT 
  });
});

// 404 fallback
app.use((req, res) => res.status(404).json({ error: `${req.method} ${req.path} not found` }));

// ============================================
//   START SERVER
// ============================================
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`
  ╔══════════════════════════════════════════╗
  ║   ChromaSense API  ✓  Running            ║
  ║   http://localhost:${port}                  ║
  ║   MongoDB: ${mongoose.connection.readyState === 1 ? '✓ Connected' : '✗ Disconnected'}          ║
  ╠══════════════════════════════════════════╣
  ║  POST   /api/auth/register               ║
  ║  POST   /api/auth/login                  ║
  ║  GET    /api/auth/me                     ║
  ║  POST   /api/results                     ║
  ║  GET    /api/results/my-results          ║
  ║  GET    /api/results/latest              ║
  ║  GET    /api/dashboard                   ║
  ╚══════════════════════════════════════════╝
    `);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`\n  ⚠  Port ${port} is already in use. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
