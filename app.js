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

var config = {};
if (process.env.NODE_ENV === 'production') {
	config = {
		connectionString: process.env.DATABASE_URL + '?sslmode=require',
		ssl: {
})

app.get('/', (req, res) => {
})

app.get('/login', (req, res) => {
})

app.post('/login', (req, res) => {
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

