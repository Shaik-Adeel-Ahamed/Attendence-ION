const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bodyParser = require('body-parser');
const moment = require('moment');
const app = express();

require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
  idNumber: String,
  name: String,
  attendance: [String],
});

const User = mongoose.model('User', userSchema);

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
}));

app.get('/', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { idNumber } = req.body;
  const user = await User.findOne({ idNumber });
  if (user) {
    req.session.userId = user._id;
    res.redirect('/dashboard');
  } else {
    res.send('User not found');
  }
});

app.get('/sign-up', (req, res) => {
  res.render('sign-up');
});

app.post('/sign-up', async (req, res) => {
  const { idNumber, name } = req.body;

  const existingUser = await User.findOne({ idNumber });
  if (existingUser) {
    return res.send('User with this ID already exists. Please go back and login.');
  }

  const newUser = new User({
    idNumber,
    name,
    attendance: [],
  });

  await newUser.save();
  res.redirect('/');
});

app.get('/dashboard', async (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  
  const user = await User.findById(req.session.userId);
  const queryMonth = parseInt(req.query.month);
  const month = isNaN(queryMonth) ? moment().month() : queryMonth;
  const currentYear = moment().year();
  const today = moment().format('YYYY-MM-DD');
  const daysInMonth = moment({ year: currentYear, month }).daysInMonth();

  const filteredAttendance = user.attendance.filter(dateStr => {
    const date = moment(dateStr, 'YYYY-MM-DD');
    return date.month() === month && date.year() === currentYear;
  });

  let calendar = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = moment({ year: currentYear, month, day: d }).format('YYYY-MM-DD');
    calendar.push({
      date,
      isToday: date === today,
      isPast: moment(date).isBefore(today),
      isMarked: filteredAttendance.includes(date),
    });
  }

  res.render('dashboard', {
    user,
    calendar,
    today,
    month,
    presentCount: filteredAttendance
  });
});

app.post('/attendance', async (req, res) => {
  if (!req.session.userId) return res.redirect('/');

  const user = await User.findById(req.session.userId);
  const today = moment().format('YYYY-MM-DD');
  const action = req.body.action;

  if (action === 'mark' && !user.attendance.includes(today)) {
    user.attendance.push(today);
    await user.save();
  } else if (action === 'unmark' && user.attendance.includes(today)) {
    user.attendance = user.attendance.filter(date => date !== today);
    await user.save();
  }

  res.redirect('/dashboard');
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));

