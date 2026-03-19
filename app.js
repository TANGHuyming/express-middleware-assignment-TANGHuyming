const express = require('express')
const { engine } = require('express-handlebars')
const rateLimit = require('express-rate-limit')
const cors = require('cors')
const basicAuth = require('express-basic-auth')
const cookieParser = require('cookie-parser')
const { randomUUID } = require('node:crypto')
const path = require('path')
require('dotenv').config()

PORT = process.env.PORT || 3000

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
    'http://localhost:3000',
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
app.use(cookieParser()) // for basic auth logout
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
// used to authenticate Bearer Token
const authenticate = (req, res, next) => {
    const authHeader = req.get('Authorization')

    if(!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send('Unauthorized')
    }

    const token = authHeader.split(' ')[1]

    if (!token || token !== process.env.APIKEY) {
        return res.status(401).send('Unauthorized')
    }

    next()
}

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

// routes
app.get('/', (req, res) => {
    res.status(200).render('home')
})

app.get('/api/oil-prices', authenticate, (req, res) => {
    res.status(200).json(data)
})

app.use(basicAuth({
    users: { 'admin': 'admin' },
    challenge: true
}));

app.get('/dashboard', (req, res) => {
    const context = data
    const last_updated = (new Date(context.last_updated)).toLocaleDateString('en-US')
    context.last_updated = last_updated
    res.status(200).render('dashboard', data)
})

app.use((req, res, next) => {
    res.cookie('server-instance', seed.toString());
    next();
});

app.get('/logout', (req, res) => {
    res.clearCookie('server-instance');
    return res.status(401).send('Logged Out');
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

