const express = require('express')
const app = express()
const path = require('path')

app.set('view-engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({extended: false}))

// Ruti

app.get('/', (request, response) => {
    response.render('index.ejs', { name: "Blagoja"})
})

app.get('/login', (request, response) =>{
    response.render('login.ejs')
})

app.get('/register', (request, response) =>{
    response.render('register.ejs')
})

// Post Metodi

app.post('/register', (request, response) =>{
    
})

app.post('/login', (request, response) =>{

})

app.listen(3000)