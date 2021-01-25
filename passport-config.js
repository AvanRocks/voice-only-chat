const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')

function initialize(passport, getUserByUsername, getUserById) {
	const authenticateUser = (username, password, done) => {
		getUserByUsername(username)
			.then(async res => {
				let user = res.rows[0]
				if (user == null) {
					return done(null, false, { message: 'No user with that username' })
				}

				bcrypt.compare(password, user.password, (err, res) => {
					if (err) {
						return done(err)
					}

					if (res) {
						return done(null, user)
					} else {
						return done(null, false, { message: 'Password incorrect' })
					}
				})
			})
			.catch(e => {
				return done(e)
			})
	}

	passport.use(new LocalStrategy(authenticateUser))
	passport.serializeUser((user, done) => done(null, user.id))
	passport.deserializeUser((id, done) => {
		getUserById(id)
			.then(res => {
				let user = res.rows[0]
				done(null, user)
			})
			.catch(e => {
				done(e)
			})
	})
}

module.exports = initialize
