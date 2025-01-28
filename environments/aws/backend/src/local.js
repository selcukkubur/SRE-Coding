const express = require('express');
const cors = require('cors');
const { handler } = require('./index');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to convert Express request to Lambda event
const createLambdaEvent = (req) => ({
    requestContext: {
        http: {
            method: req.method,
            path: req.path
        }
    },
    body: JSON.stringify(req.body)
});

// Routes
app.post('/tasks', async (req, res) => {
    const result = await handler(createLambdaEvent(req));
    res.status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/tasks', async (req, res) => {
    const result = await handler(createLambdaEvent(req));
    res.status(result.statusCode).json(JSON.parse(result.body));
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(port, () => {
    console.log(`Local development server running at http://localhost:${port}`);
});
