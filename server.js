if (process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}

const express = require('express')
const app = express()
const path = require('path')
const bcrypt = require('bcrypt')
const sqlite3 = require('sqlite3')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')

app.set('view-engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({extended: false}))
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))

app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

const initialize = require('./passport-cfg')
const { Session } = require('inspector')

// Databaza za users

const fitInDbPath = path.join(__dirname, 'db/fitin.db')
const fitInDb = new sqlite3.Database(fitInDbPath)
initialize(
    passport,
    fitInDb
);

fitInDb.serialize(()=> {
    fitInDb.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, birthday DATE, height INTEGER, weight REAL, trainings INTEGER)")

    fitInDb.run("CREATE TABLE IF NOT EXISTS subscribed_users (membership_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, FOREIGN KEY(user_id) REFERENCES users(id))")

    fitInDb.run("CREATE TABLE IF NOT EXISTS trainers (trainer_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, FOREIGN KEY(user_id) REFERENCES users(id))")

    fitInDb.run("CREATE TABLE IF NOT EXISTS classes (class_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, timeslot DATETIME, trainer_id INTEGER, FOREIGN KEY(trainer_id) REFERENCES trainers(trainer_id))")
})

// Ruti

app.get('/', (request, response) => {
    response.render('index.ejs', {user: request.user})
})

app.get('/schedule', checkAuthenticated, async (request, response) => {
    try {
        const userId = request.user.id;
        const user = await new Promise((resolve, reject) => {
            fitInDb.get("SELECT u.id, s.membership_id FROM users u LEFT JOIN subscribed_users s ON u.id = s.user_id WHERE u.id = ?", userId, (err, row) => {                if (err) {
                    reject(err);
                } else {
                    console.log('Selected row: ', row)
                    resolve(row);
                }
            });
        });

        if (!user) {
            return response.status(404).send("User not found");
        }

        const classes = await new Promise((resolve, reject) => {
            fitInDb.all("SELECT c.*, u.name AS trainer_name FROM classes c LEFT JOIN users u ON c.trainer_id = u.id ORDER BY timeslot ASC", (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        response.render('schedule.ejs', { user: user, classes: classes});
    } catch (error) {
        console.error("Error fetching user:", error);
        response.status(500).send("Internal Server Error");
    }
})
app.get('/login', checkNotAuthenticated, (request, response) =>{
    response.render('login.ejs')
})

app.get('/register', checkNotAuthenticated, (request, response) =>{
    response.render('register.ejs')
})

app.get('/profile', checkAuthenticated, async (request, response) => {
    try {
        const userId = request.user.id;
        const user = await new Promise((resolve, reject) => {
            fitInDb.get("SELECT u.id, u.name, u.email, u.birthday, u.height, u.weight, u.trainings, t.trainer_id, s.membership_id FROM users u LEFT JOIN trainers t ON u.id = t.user_id LEFT JOIN subscribed_users s ON u.id = s.user_id WHERE u.id = ?", userId, (err, row) => {                if (err) {
                    reject(err);
                } else {
                    console.log('Selected row: ', row)
                    resolve(row);
                }
            });
        });

        if (!user) {
            return response.status(404).send("User not found");
        }

        response.render('profile.ejs', { user: user });
    } catch (error) {
        console.error("Error fetching user:", error);
        response.status(500).send("Internal Server Error");
    }
})


// Post Metodi

app.post('/register', checkNotAuthenticated, async (request, response) =>{
    try{
        const existingUser = await new Promise((resolve, reject) => {
            fitInDb.get("SELECT * FROM users WHERE email = ?", request.body.email, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });

        if(existingUser) {
            return response.render('register.ejs', { messages: { error: 'Invalid Request: Email already in use.' } });
        }

        const hashed_password = await bcrypt.hash(request.body.password, 10)

        fitInDb.run("INSERT INTO users (name, email, password, birthday, height, weight, trainings) VALUES (?, ?, ?, ?, ?, ?, ?)",
            request.body.name, request.body.email, hashed_password, request.body.birthday, request.body.height, request.body.weight, 0,
            function(err){
                if (err){
                    console.error(err.message);
                    return response.render('register.ejs', { messages: { error: 'Failed to register. Please try again later.' } });
                } else {
                    response.redirect('/login');
                }
            }
        )

    } catch(error){
        console.log(error)
        response.redirect('/register')
    }
})

app.post('/profile', checkAuthenticated, async (request, response) => {
    try {
        const userId = request.user.id;

        const user = await new Promise((resolve, reject) => {
            fitInDb.get("SELECT u.id, u.name, u.email, u.birthday, u.height, u.weight, u.trainings, t.trainer_id, s.membership_id FROM users u LEFT JOIN trainers t ON u.id = t.user_id LEFT JOIN subscribed_users s ON u.id = s.user_id WHERE u.id = ?", userId, (err, row) => {                if (err) {
                    reject(err);
                } else {
                    console.log('Selected row: ', row)
                    resolve(row);
                }
            });
        });
        
        const isTrainer = await new Promise((resolve, reject) => {
            fitInDb.get("SELECT * FROM trainers WHERE user_id = ?", userId, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });

        if (isTrainer) {
            const classDateTime = new Date(request.body.datetime);
            const currentDateTime = new Date();
            if (classDateTime < currentDateTime) {
                return response.render('profile.ejs', { user: user, messages: { error: 'Invalid date set. Please select a date in the future.' } });
            }

            fitInDb.run("INSERT INTO classes (name, timeslot, trainer_id) VALUES (?, ?, ?)",
            request.body.name, request.body.datetime, userId,
                function(err) {
                    if (err) {
                        console.error("Error inserting class:", err);
                        response.status(500).send("Internal Server Error");
                    } else {
                        response.redirect('/schedule');
                    }
                }
            );
        } else {
            response.status(403).send("Forbidden: Only trainers can access this page");
        }
    } catch (error) {
        console.error("Error processing form submission:", error);
        response.status(500).send("Internal Server Error");
    }
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}))

app.delete('/logout', (request, response) => {
    request.logout((err) => {
        if (err) {
            return next(err);
        }
        response.redirect('/login');
    });
})

function checkAuthenticated(request, response, next){
    if(request.isAuthenticated()){
        return next()
    }

    response.redirect('/login')
}

function checkNotAuthenticated(request, response, next){
    if(request.isAuthenticated()){
        return response.redirect('/')
    }
    next()
}

// function insertTestClasses() { // Samo za debugging/testiranje
//     const classesData = [
//         { timeslot: '2024-05-17T09:00:00Z', trainer_id: 1 },
//         { timeslot: '2024-05-18T10:30:00Z', trainer_id: 1 },
//         { timeslot: '2024-05-19T13:00:00Z', trainer_id: 1 },
//     ];

//     classesData.forEach(classData => {
//         fitInDb.run("INSERT INTO classes (timeslot, trainer_id) VALUES (?, ?)", [classData.timeslot, classData.trainer_id], (err) => {
//             if (err) {
//                 console.error("Error inserting test class:", err);
//             } else {
//                 console.log("Test class inserted successfully");
//             }
//         });
//     });
// }

//insertTestClasses();

app.listen(3000)