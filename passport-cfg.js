const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')

function initialize(passport, usersDb) {
    const authenticateUser = async (email, password, done) => {
        usersDb.get("SELECT * FROM users WHERE email = ?", email, async (err, user) => {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false, { message: 'Invalid Credentials: No user with that email.' });
            }

            try {
                if (await bcrypt.compare(password, user.password)) {
                    return done(null, user);
                } else {
                    return done(null, false, { message: 'Invalid Credentials: Password incorrect.' });
                }
            } catch (e) {
                return done(e);
            }
        });
    }

    passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser))
    passport.serializeUser((user, done) => done(null, user.id))
    passport.deserializeUser((id, done) => {
        usersDb.get("SELECT * FROM users WHERE id = ?", id, (err, user) => {
            if (err) {
                return done(err);
            }
            return done(null, user);
        });
    })
}

module.exports = initialize