const { Pool } = require('pg');
const Sentry = require('@sentry/node');

// Initialize Sentry
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.AWS_LAMBDA_FUNCTION_NAME,
    tracesSampleRate: 1.0,
    integrations: [
        new Sentry.Integrations.Postgres()
    ]
});

// Database configuration
const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    }
});

// Helper function to handle database errors
const handleDatabaseError = (error, context) => {
    console.error('Database error:', error);
    Sentry.withScope(scope => {
        scope.setExtra('context', context);
        Sentry.captureException(error);
    });
    return {
        statusCode: 500,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            error: 'Internal server error',
            requestId: context.awsRequestId
        })
    };
};

// Helper function for successful responses
const createResponse = (statusCode, body) => ({
    statusCode,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
});

// Main Lambda handler
exports.handler = async (event, context) => {
    // Enable Sentry request handling
    const transaction = Sentry.startTransaction({
        op: 'lambda',
        name: event.requestContext?.routeKey || 'unknown'
    });

    try {
        console.log('Event:', JSON.stringify(event));

        // Handle OPTIONS requests for CORS
        if (event.requestContext?.http?.method === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
                }
            };
        }

        // Route handling
        const route = event.requestContext?.http?.method + ' ' + event.requestContext?.http?.path;

        switch (route) {
            case 'POST /tasks': {
                const { description } = JSON.parse(event.body);
                
                if (!description) {
                    return createResponse(400, { error: 'Description is required' });
                }

                const result = await pool.query(
                    'INSERT INTO tasks (description) VALUES ($1) RETURNING *',
                    [description]
                );

                return createResponse(201, result.rows[0]);
            }

            case 'GET /tasks': {
                const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
                return createResponse(200, result.rows);
            }

            default:
                return createResponse(404, { error: 'Not Found' });
        }
    } catch (error) {
        console.error('Error:', error);
        Sentry.captureException(error);
        
        if (error instanceof SyntaxError) {
            return createResponse(400, { error: 'Invalid request body' });
        }

        return handleDatabaseError(error, context);
    } finally {
        transaction.finish();
        await Sentry.flush(2000);
    }
};

// Add CloudWatch custom metrics
const putMetric = async (metricName, value = 1, unit = 'Count') => {
    const cloudwatch = new AWS.CloudWatch();
    try {
        await cloudwatch.putMetricData({
            Namespace: 'TasksAPI',
            MetricData: [{
                MetricName: metricName,
                Value: value,
                Unit: unit,
                Timestamp: new Date()
            }]
        }).promise();
    } catch (error) {
        console.error('Error putting metric:', error);
        Sentry.captureException(error);
    }
};
