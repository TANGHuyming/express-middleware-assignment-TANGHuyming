# Homework 9: Secure Oil Price API

This project is an INF 653 Node.js + Express app that demonstrates API security with middleware.

It protects an oil price endpoint using:

- IP filtering
- CORS policy
- rate limiting
- Bearer token authentication
- Basic Authentication for dashboard access
- cookie-based server instance validation

## Tech Stack

- Node.js
- Express
- Express Handlebars
- cors
- express-rate-limit
- express-basic-auth
- cookie-parser
- dotenv

## Project Structure

```text
homework-9-secure-oil-price-TANGHuyming/
|- app.js
|- .env.example
|- public/
|  |- style.css
|- views/
|  |- home.handlebars
|  |- dashboard.handlebars
|  |- 404.handlebars
|  |- 500.handlebars
|  |- layouts/main.handlebars
|  |- partials/header.handlebars
|  |- partials/footer.handlebars
|- package.json
|- README.md
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file from `.env.example`:

```env
PORT=3000
APIKEY=your_super_secret_key
```

3. Start the server:

```bash
node app.js
```

4. Open in browser:

```text
http://localhost:3000
```

## Security Middleware in This App

The app applies middleware in this order:

1. Static files
2. Cookie parser
3. IP filter (`127.0.0.1`, `::1` allowed)
4. CORS whitelist (`http://localhost:3000`)
5. Rate limit (10 requests per minute per IP)
6. Server-instance cookie validation
7. Route-level Bearer token authentication (`/api/oil-prices`)
8. Basic Auth for dashboard route

## Routes

- `GET /`
	- Renders home page.

- `GET /api/oil-prices`
	- Protected by Bearer token.
	- Returns JSON oil price data.
	- Header required:

```http
Authorization: Bearer <APIKEY>
```

- `GET /dashboard`
	- Protected by Basic Auth.
	- Credentials from current code:
		- username: `admin`
		- password: `admin`

- `GET /logout`
	- Clears the `server-instance` cookie.

## API Test Example (curl)

```bash
curl -X GET "http://localhost:3000/api/oil-prices" \
	-H "Authorization: Bearer your_super_secret_key" \
	-H "Content-Type: application/json"
```

## Common Responses

- `200 OK`: Request passed all security checks.
- `401 Unauthorized`: Missing/invalid Bearer token or invalid instance state.
- `403 Forbidden`: IP blocked by IP filter.
- `429 Too Many Requests`: Rate limit exceeded.
- `404 Not Found`: Unknown route.
- `500 Internal Server Error`: Server error.

## Notes

- This project is for learning middleware security concepts.
- The Basic Auth credentials are hardcoded for demo purposes and should not be used in production.
