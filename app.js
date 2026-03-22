const express = require('express')
const { engine } = require('express-handlebars')
const session = require('express-session')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const rateLimit = require('express-rate-limit')
const cors = require('cors')
const basicAuth = require('express-basic-auth')
const cookieParser = require('cookie-parser')
const { randomUUID } = require('node:crypto')
const path = require('path')
require('dotenv').config()

const PORT = process.env.PORT || 3000
const SECRET = process.env.JWT_SECRET || 'skibidibopbopbopyesyesyes'

// set up server
const app = express()
app.engine('handlebars', engine({
    defaultLayout: 'main',
    partialsDir: path.join(__dirname, 'views', 'partials'),
}))
app.set('view engine', 'handlebars')
app.set('views', path.join(__dirname, 'views'))

const seed = randomUUID()

// options for middlewares
const option = {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // limit each IP
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 1 minute'
}

// whitelist only the current development origin
const whitelist = [
    `http://localhost:${PORT}`,
];

// options for cors
const corsOptions = {
    origin: function (origin, callback) {
        // !origin allows server-to-server or tools like Postman/Curl
        if (!origin || whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};

// middlewares
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded())
app.use(cookieParser()) // for basic auth logout
// set up session
app.use(session({
    secret: SECRET, // In production, use environment variable
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        httpOnly: true
    }
}))
// set up flash message
app.use((req, res, next) => {
    // Copy flash from session to res.locals (accessible in views)
    if (req.session.flash) {
        res.locals.flash = req.session.flash

        // Clear flash from session after copying
        req.session.flash = null
    } else {
        // Initialize empty flash if none exists
        res.locals.flash = {}
    }

    next()
})
// define setFlash helper
app.use((req, res, next) => {
    req.setFlash = (type, message) => {
        req.session.flash = req.session.flash || {}
        req.session.flash[type] = message
    }

    next()
})
// custom ip filtering middleware
app.use((req, res, next) => {
    const ips = ['127.0.0.1', '::1'] // Allow localhost
    if (!ips.includes(req.ip)) {
        return res.status(403).send('Forbidden')
    }
    next()
})
app.use(cors(corsOptions)) // use cors middleware
app.use(rateLimit(option)) // use rate limit middleware
// check if server instance is valid
app.use((req, res, next) => {
    const clientInstance = req.cookies['server-instance'];

    if (clientInstance && clientInstance !== seed.toString()) {
        res.set('WWW-Authenticate', `Basic realm="${seed.toString()}"`);
        res.clearCookie('server-instance');
        return res.status(401).send('Invalid server instance. Please log in again.');
    }
    next();
})
app.disable('x-powered-by')
// middleware to verify Bearer token
function auth(req, res, next) {
    const header = req.headers.authorization

    if (!header || !header.includes('Bearer ')) return res.status(401)

    const token = header.split(' ')[1]

    try {
        const decoded = jwt.verify(token, SECRET)
        req.user = decoded
        next()
    } catch {
        res.status(403)
    }
}
const basicAuthMiddleware = basicAuth({
    users: { 'admin': 'admin' },
    challenge: true,
    realm: 'Restricted Area'
})

// static data
const data = {
    "market": "Global Energy Exchange",
    "last_updated": "2026-03-15T12:55:00Z",
    "currency": "USD",
    "data": [
        {
            "symbol": "WTI",
            "name": "West Texas Intermediate",
            "price": 78.45,
            "change": 0.12
        },
        {
            "symbol": "BRENT",
            "name": "Brent Crude",
            "price": 82.30,
            "change": -0.05
        },
        {
            "symbol": "NAT_GAS",
            "name": "Natural Gas",
            "price": 2.15,
            "change": 0.02
        }
    ]
}
const users = [
    { username: 'admin', password: bcrypt.hashSync('admin', 10), id: 1, role: 'admin' },
]

// routes
app.get('/', (req, res) => {
    return res.status(200).render('home')
})

// can't be accessed via browser
// must be accessed via curl command
app.get('/api/oil-prices', auth, (req, res) => {
    res.status(200).json(data)
})

app.get('/dashboard', basicAuthMiddleware, (req, res) => {
    const context = data
    const last_updated = (new Date(context.last_updated)).toLocaleDateString('en-US')
    context.last_updated = last_updated
    res.cookie('server-instance', seed.toString()); // set server instance
    return res.status(200).render('dashboard', data)
})

// login route
app.get('/login', (req, res) => {
    res.status(200).render('login')
})

app.post('/login', async (req, res) => {
    const { username, password } = req.body

    const user = users.find(u => u.username === username)
    if (!user) {
        req.setFlash('error', 'Login failed! Incorrect username or password.')
        res.status(202)
        return res.redirect('/login')
    }

    // check whether password matches the hashed password in memory by hashing the password entered by the user
    const match = await bcrypt.compare(password, user.password)
    if (!match) {
        req.setFlash('error', 'Login failed! Incorrect username or password.')
        res.status(202)
        return res.redirect('/login')
    }

    const token = jwt.sign(
        { id: user.id, role: user.role },
        SECRET,
        { expiresIn: '1h' }
    )

    res.json({token})
})

// this route DOES NOT invalidize the jwt token
app.get('/logout', (req, res) => {
    res.clearCookie('server-instance');
    return res.status(401).render('logout');
})

app.use((req, res) => {
    res.status(404)
    res.render('404')
})

app.use((error, req, res, next) => {
    console.error(error.stack)
    res.status(500)
    res.render('500')
})

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`)
})

