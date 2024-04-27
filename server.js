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
initialize(
    passport, 
    email => users_prototype.find(user => user.email == email),
    id => users_prototype.find(user => user.id == id)
)

const users_prototype = []

// Databaza za users

const usersDbpath = path.join(__dirname, 'users.db')

const usersDb = new sqlite3.Database(usersDbpath)

usersDb.serialize(()=> {
    usersDb.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, height INTEGER, weight REAL)")
})

// Ruti

app.get('/', (request, response) => {
    response.render('index.ejs')
})

app.get('/login', checkNotAuthenticated, (request, response) =>{
    response.render('login.ejs')
})

app.get('/register', checkNotAuthenticated, (request, response) =>{
    response.render('register.ejs')
})

// Post Metodi

app.post('/register', checkNotAuthenticated, async (request, response) =>{
    try{
        const hashed_password = await bcrypt.hash(request.body.password, 10)

        // usersDb.run("INSERT INTO users (name, email, password, height, weight) VALUES (?, ?, ?, ?, ?)",
        //     request.body.name, request.body.email, hashed_password, request.body.height, request.body.weight,
        //     function(err){
        //         if (err){
        //             console.error(err.message);
        //             response.redirect('/register');
        //         } else {
        //             response.redirect('/login');
        //         }
        //     }
        // )


        //Test kod za storing data
        users_prototype.push({
            id: Date.now().toString(),
            name: request.body.name,
            email: request.body.email,
            password: hashed_password,
            height: request.body.height,
            weight: request.body.weight
        })
        response.redirect('/login')
    } catch(error){
        console.log(error)
        response.redirect('/register')
    }
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}))

app.delete('/logout', (req, res) => {
    req.logOut()
    res.redirect('/login')
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

app.listen(3000)