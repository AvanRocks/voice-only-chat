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

const port = process.env.PORT || 8000
 
const initializePassport = require('./passport-config')
initializePassport(
  passport,
	getUserByUsername,
	getUserById
)

var config = {}
if (process.env.NODE_ENV === 'production') {
	config = {
		connectionString: process.env.DATABASE_URL,
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
	//sess.cookie.secure = true
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
	res.render('index.ejs', { username : req.user.username } );
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
	io.to(req.user.id).emit('logOut')
	req.logOut()
	res.redirect('/login')
})

app.get('/getFriends', checkAuthenticated, async (req, res) => {
	let names = []
	let friends = req.user.friends
	if (friends) {
		for (let i=0;i<friends.length;++i) {
			let result = await getUserById(friends[i])
			let friend = result.rows[0]
			names.push(friend.username)
		}
	}

	res.send({
		names: names,
		id: req.user.friends
	})
})

app.post('/addFriend', checkAuthenticated, upload.none(), (req, res) => {
	getUserByUsername(req.body.friendName)
	.then( async result => {
		if (result.rows.length === 0) {
			res.status(400).send('No such user')
		} else if (result.rows[0].username === req.user.username) {
			res.status(400).send("You can't friend yourself")
		} else if (req.user.friends && req.user.friends.includes(result.rows[0].id))  {
			res.status(400).send("You are already friends with that user")
		} else if (req.user['friend requests'] && req.user['friend requests'].includes(result.rows[0].id))  {
			res.status(400).send("You have already sent a friend request to that user")
		} else {
			let newFriend = result.rows[0]
			await pool.query('UPDATE accounts SET "friend requests" = array_append("friend requests", $1) where id = $2', [req.user.id, newFriend.id])

			io.to(newFriend.id).emit('refreshFriendRequests')

			res.sendStatus(200)
		}
	})
	.catch( e => {
		console.log(e)
	})
})

app.delete('/removeFriend', checkAuthenticated, upload.none(), (req, res) => {
	getUserById(req.body.friendId).then( async result => {
		let friend = result.rows[0]
		
		await pool.query('UPDATE accounts SET "friends" = array_remove("friends", $1) where id = $2', [friend.id, req.user.id]);
		await pool.query('UPDATE accounts SET "friends" = array_remove("friends", $1) where id = $2', [req.user.id, friend.id]);

		io.to(req.user.id).to(friend.id).emit('refreshFriends')
		res.sendStatus(200)
	}).catch(e =>  res.sendStatus(400))
})


app.get('/getFriendRequests', checkAuthenticated, async (req, res) => {
	let names = []
	let friendReq = req.user['friend requests']
	if (friendReq) {
		for (let i=0;i<friendReq.length;++i) {
			let result = await getUserById(friendReq[i])
			let friend = result.rows[0]
			names.push(friend.username)
		}
	}

	res.send({
		names: names,
		id: req.user['friend requests']
	})
})

app.post('/handleFriendRequest', checkAuthenticated, upload.none(), (req, res) => {
	getUserById(req.body.friendName).then(async result => {
		let friend = result.rows[0]
		if (req.body.action === 'accept') {
			await pool.query('UPDATE accounts SET "friend requests" = array_remove("friend requests", $1) where id = $2', [friend.id, req.user.id])
			await pool.query('UPDATE accounts SET "friends" = array_append("friends", $1) where id = $2', [req.user.id, friend.id])
			await pool.query('UPDATE accounts SET "friends" = array_append("friends", $1) where id = $2', [friend.id, req.user.id])
			io.to(req.user.id).to(friend.id).emit('refreshFriends')
			io.to(req.user.id).emit('refreshFriendRequests')
		} else if (req.body.action === 'reject') {
			await pool.query('UPDATE accounts SET "friend requests" = array_remove("friend requests", $1) where id = $2', 
				[friend.id, req.user.id])
			io.to(req.user.id).emit('refreshFriendRequests')
		}
	})

	res.send()
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

http.listen(port, () => {
	console.log(`Listening on port ${port} ...`)
})

io.on('connection', (socket) => {
	socket.on('voice message', (audioChunks, selectedId) => {
		//socket.broadcast.emit('voice message', audioChunks)
		socket.to(selectedId).emit('voice message', audioChunks)
	})

	socket.on('init', (username) => {
		getUserByUsername(username).then(res => {
			let userId = res.rows[0].id
			socket.join(userId)
		}).catch(err => console.log('database error: ' + err))
	})
})
