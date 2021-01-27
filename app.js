if (process.env.NODE_ENV !== 'production') {
	require('dotenv').config()
}
const path = require('path')
const express = require('express')
const app = express()
const http = require('http').createServer(app)
const io = require('socket.io')(http)
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const { Pool } = require('pg')
const pgSession = require('connect-pg-simple')(session)
const multer = require('multer')
const upload = multer()

const initializePassport = require('./passport-config')
initializePassport(
  passport,
	getUserByUsername,
	getUserById
)

var config = {}
if (process.env.NODE_ENV === 'production') {
	config = {
		connectionString: process.env.DATABASE_URL + '?sslmode=require',
		ssl: {
			rejectUnauthorized: false
		}
	}
}
const pool = new Pool(config)

var sess = {
	store: new pgSession({
		pool: pool,
	}),
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: false,
	cookie: {
		maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
		sameSite: 'strict'
	}
}
if (process.env.NODE_ENV === 'production') {
	sess.cookie.secure = true
}

app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(session(sess))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))
app.use(express.static('public'))

app.get('/', checkAuthenticated, (req, res) => {
	res.render('index.ejs');
})

app.get('/login', checkNotAuthenticated, (req, res) => {
	res.render('login.ejs');
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
	  successRedirect: '/',
	  failureRedirect: '/login',
	  failureFlash: true
}))

app.get('/register', checkNotAuthenticated, (req, res) => {
	  res.render('register.ejs')
})

app.post('/register', checkNotAuthenticated, async (req, res) => {
  try {
		getUserByUsername(req.body.username)
		.then(async result => {
			if (result.rows.length > 0) {
				req.flash('error', 'Username not available')
				res.render('register.ejs')
			} else {
				const hashedPassword = await bcrypt.hash(req.body.password, 10)
				pool.query('INSERT INTO accounts (username,password) VALUES ($1,$2);', [req.body.username, hashedPassword], (err, res2) => {
					res.redirect('/login')
				})
			}
		})
		.catch(e => {
			console.log('error querying database: ' + e)
		})
  } catch {
    res.redirect('/register')
  }
})

app.delete('/logout', (req, res) => {
	req.logOut()
	res.redirect('/login')
})

app.post('/addFriend', checkAuthenticated, upload.none(), (req, res) => {
	getUserByUsername(req.body.friendName)
	.then( result => {
		if (result.rows.length === 0) {
			res.status(400).send('No such user')
		} else if (result.rows[0].username === req.user.username) {
			res.status(400).send("You can't friend yourself")
		} else {
			// add friend to database
			console.log(result)

			res.sendStatus(200)
		}
	})
	.catch( e => {
		console.log(e)
	})
})

function checkAuthenticated(req, res, next) {
	if (req.isAuthenticated()) {
		return next()
	}
	res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
	if (req.isAuthenticated()) {
		return res.redirect('/')
	}
	next()
}

function getUserByUsername(username) {
	return pool.query('SELECT * FROM accounts WHERE username = $1', [username])
}

function getUserById(id) {
	return pool.query('SELECT * FROM accounts WHERE id = $1', [id])
}

http.listen(8000, () => {
	console.log(`Listening on port 8000 ...`)
})

io.on('connection', (socket) => {
	socket.on('voice message', (audioBlob) => {
		socket.broadcast.emit('voice message', audioBlob)
	})
});
