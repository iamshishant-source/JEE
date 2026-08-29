require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-me';
let databaseReady = false;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (!databaseReady) {
    return res.status(503).json({ error: 'Database is unavailable. Check the MongoDB connection settings.' });
  }
  next();
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  chaptersStudied: { type: Number, default: 0, min: 0, max: 75 },
  timers: { lecture: { type: Number, default: 0 }, practice: { type: Number, default: 0 }, revision: { type: Number, default: 0 } },
  rankHistory: [{ rank: Number, date: { type: Date, default: Date.now } }],
  todos: [{ title: String, done: Boolean, date: { type: Date, default: Date.now } }]
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

function normalizeChapters(value) {
  return Math.min(75, Math.max(0, Number(value || 0)));
}
function getDayKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}
function trimRankHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-10);
}
function addRankSnapshot(user, rank, date = new Date()) {
  user.rankHistory = trimRankHistory([...(user.rankHistory || []), { rank: Number(rank), date }]);
}
function getTaskRankImpact(currentRank) {
  const rank = Number(currentRank || 0);
  if (rank >= 1000000 && rank <= 1500000) return { bonus: 100, penalty: 200 };
  if (rank >= 100000 && rank < 1000000) return { bonus: 50, penalty: 100 };
  if (rank >= 8000 && rank < 100000) return { bonus: 10, penalty: 20 };
  return { bonus: 0, penalty: 100 };
}
function getTaskImpactForCompletion(currentRank) {
  const impact = getTaskRankImpact(currentRank);
  return { reward: impact.bonus, penalty: impact.penalty };
}
function getDailyTaskImpact(user, now = new Date()) {
  const todayKey = getDayKey(now);
  const todayTasks = (user.todos || []).filter(task => {
    const taskKey = task.dayKey || getDayKey(task.date || now);
    return taskKey === todayKey;
  });
  const doneToday = todayTasks.filter(task => task.done).length;
  const pendingToday = todayTasks.filter(task => !task.done).length;
  return (pendingToday * 3500) - (doneToday * 2200);
}
function normalizeUserTasks(user, now = new Date()) {
  if (!Array.isArray(user.todos)) user.todos = [];
  const todayKey = getDayKey(now);
  const activeTasks = [];
  for (const task of user.todos) {
    const taskKey = task.dayKey || getDayKey(task.date || now);
    task.dayKey = taskKey;
    if (taskKey === todayKey) {
      activeTasks.push(task);
      continue;
    }
    if (!task.done) {
      const currentRank = calculateRank({ ...user, todos: activeTasks });
      const impact = getTaskRankImpact(currentRank);
      addRankSnapshot(user, currentRank + impact.penalty, now);
    }
  }
  user.todos = activeTasks;
  user.rankHistory = trimRankHistory(user.rankHistory || []);
  return user;
}
function interpolateChapterRank(chapters) {
  const points = [
    { chapters: 0, air: 1500000 },
    { chapters: 10, air: 50000 },
    { chapters: 20, air: 45000 },
    { chapters: 30, air: 35000 },
    { chapters: 40, air: 25000 },
    { chapters: 50, air: 16000 },
    { chapters: 55, air: 10000 },
    { chapters: 60, air: 6000 },
    { chapters: 65, air: 2500 },
    { chapters: 70, air: 800 },
    { chapters: 73, air: 200 },
    { chapters: 75, air: 50 }
  ];

  if (chapters <= 0) return 1500000;
  if (chapters >= 75) return 50;

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    if (chapters >= current.chapters && chapters <= next.chapters) {
      const ratio = (chapters - current.chapters) / (next.chapters - current.chapters);
      return Math.round(current.air + (next.air - current.air) * ratio);
    }
  }

  return points[points.length - 1].air;
}
function calculateRank(user) {
  const chapters = normalizeChapters(user.chaptersStudied);
  const lecture = user.timers?.lecture || 0;
  const practice = user.timers?.practice || 0;
  const revision = user.timers?.revision || 0;
  const totalMinutes = lecture + practice + revision;
  const chapterAIR = interpolateChapterRank(chapters);
  const studyBoost = Math.min(0.35, totalMinutes / 22000);
  const timeAdjustedAIR = Math.max(1, Math.round(chapterAIR * (1 - studyBoost)));
  return Math.max(1, timeAdjustedAIR);
}
function publicUser(user) {
  normalizeUserTasks(user);
  user.chaptersStudied = normalizeChapters(user.chaptersStudied);
  user.rankHistory = trimRankHistory(user.rankHistory || []);
  const rank = user.rankHistory.length ? Number(user.rankHistory[user.rankHistory.length - 1].rank) : calculateRank(user);
  return { id: user._id, name: user.name, email: user.email, chaptersStudied: user.chaptersStudied, timers: user.timers, rank, rankHistory: user.rankHistory, todos: user.todos };
}
function tokenFor(user) { return jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' }); }
async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(payload.id);
    if (!req.user) throw new Error('Missing user');
    req.user.chaptersStudied = normalizeChapters(req.user.chaptersStudied);
    next();
  } catch { res.status(401).json({ error: 'Please sign in again.' }); }
}

app.post('/api/auth/signup', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const chaptersInput = req.body.chaptersStudied;
    const chaptersStudied = normalizeChapters(chaptersInput);
    if (!name || !email || !password || chaptersInput === undefined || chaptersInput === '') return res.status(400).json({ error: 'Complete every field to continue.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (!Number.isFinite(Number(chaptersInput)) || Number(chaptersInput) < 0 || Number(chaptersInput) > 75) return res.status(400).json({ error: 'Chapters completed must be a whole number from 0 to 75.' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'An account with that email already exists.' });
    const initialRank = calculateRank({ chaptersStudied, timers: { lecture: 0, practice: 0, revision: 0 }, todos: [] });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10), chaptersStudied, timers: { lecture: 0, practice: 0, revision: 0 }, rankHistory: [{ rank: initialRank, date: new Date() }], todos: [] });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'An account with that email already exists.' });
    console.error('Signup failed:', error.message);
    res.status(500).json({ error: 'Could not create account.' });
  }
});
app.post('/api/auth/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: String(req.body.email || '').trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) {
    console.error('Login failed:', error.message);
    res.status(500).json({ error: 'Could not sign in.' });
  }
});
app.get('/api/health', (req, res) => res.status(databaseReady ? 200 : 503).json({ database: databaseReady ? 'connected' : 'disconnected' }));
app.get('/api/me', auth, (req, res) => res.json(publicUser(req.user)));
app.patch('/api/me', auth, async (req, res) => {
  const allowed = ['chaptersStudied'];
  allowed.forEach(key => { if (req.body[key] !== undefined) req.user[key] = normalizeChapters(req.body[key]); });
  if (req.body.timers) ['lecture', 'practice', 'revision'].forEach(key => { if (req.body.timers[key] !== undefined) req.user.timers[key] = Number(req.body.timers[key]); });
  normalizeUserTasks(req.user);
  req.user.chaptersStudied = normalizeChapters(req.user.chaptersStudied);
  const rank = calculateRank(req.user);
  req.user.rankHistory = trimRankHistory(req.user.rankHistory || []);
  const last = req.user.rankHistory[req.user.rankHistory.length - 1];
  if (!last || last.rank !== rank) addRankSnapshot(req.user, rank, new Date());
  await req.user.save();
  res.json(publicUser(req.user));
});
app.post('/api/todos', auth, async (req, res) => {
  if (!req.body.title?.trim()) return res.status(400).json({ error: 'Add a task title.' });
  normalizeUserTasks(req.user);
  req.user.todos.push({ title: req.body.title.trim(), done: false, dayKey: getDayKey(), date: new Date() });
  await req.user.save();
  res.json(publicUser(req.user));
});
app.patch('/api/todos/:id', auth, async (req, res) => {
  normalizeUserTasks(req.user);
  const task = req.user.todos.id(req.params.id); if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (task.done) return res.json(publicUser(req.user));
  if (req.body.done !== true) return res.json(publicUser(req.user));

  const beforeRank = Number((req.user.rankHistory?.length ? req.user.rankHistory[req.user.rankHistory.length - 1].rank : calculateRank(req.user)) || calculateRank(req.user));
  const impact = getTaskImpactForCompletion(beforeRank);
  task.done = true;
  task.dayKey = getDayKey();

  const updatedRank = Math.max(1, Math.round(beforeRank - impact.reward));
  addRankSnapshot(req.user, updatedRank, new Date());
  await req.user.save();
  res.json(publicUser(req.user));
});
app.get('/api/search', auth, async (req, res) => { const query = (req.query.q || '').trim(); if (!query) return res.json([]); const users = await User.find({ name: new RegExp(query, 'i') }).limit(8); res.json(users.map(publicUser)); });

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
async function start() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
      databaseReady = true;
      console.log(`MongoDB connected to ${mongoose.connection.name}`);
    } catch (error) {
      console.error('MongoDB connection failed:', error.message);
      console.error('Check the Atlas cluster status, network access IP allowlist, database user/password, and URL-encode special characters in the password.');
    }
  } else {
    console.warn('MONGODB_URI is not set. Add it to .env before using the API.');
  }
  app.listen(PORT, () => console.log(`JEE Edge running at http://localhost:${PORT}`));
}
start();
