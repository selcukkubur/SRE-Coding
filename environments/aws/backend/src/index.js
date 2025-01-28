const pg = require('pg');
pg.defaults.native = false; // Disable native bindings
const { Pool } = pg;

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000
};

console.log('Starting Lambda with config:', { 
    host: dbConfig.host,
    database: dbConfig.database,
    user: dbConfig.user,
    port: dbConfig.port,
    ssl: dbConfig.ssl ? 'enabled' : 'disabled'
});

const pool = new Pool(dbConfig);

// Add connection event handlers
pool.on('connect', () => {
    console.log('New client connected to the pool');
});

pool.on('acquire', () => {
    console.log('Client acquired from the pool');
});

pool.on('remove', () => {
    console.log('Client removed from the pool');
});

// Test database connection
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    console.error('Error details:', {
        code: err.code,
        message: err.message,
        stack: err.stack
    });
});

// Check if table exists
const checkTableExists = async (client) => {
    const result = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name = 'tasks'
        );
    `);
    return result.rows[0].exists;
};

const getCorsHeaders = () => ({
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://d3k2p6z3f2d2f6.cloudfront.net',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': '*',
    'Content-Type': 'application/json'
});

// Helper function for responses
const createResponse = (statusCode, body, additionalHeaders = {}) => ({
    statusCode,
    headers: {
        ...getCorsHeaders(),
        ...additionalHeaders
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
});

// Test database connectivity with retries
const testConnection = async (retries = 3, delay = 1000) => {
    let lastError;
    for (let i = 0; i < retries; i++) {
        let testClient;
        try {
            console.log(`Testing database connection (attempt ${i + 1}/${retries})...`);
            testClient = await pool.connect();
            await testClient.query('SELECT NOW()');
            console.log('Database connection test successful');
            return true;
        } catch (error) {
            lastError = error;
            console.error(`Database connection test failed (attempt ${i + 1}/${retries}):`, error);
            console.error('Connection error details:', {
                code: error.code,
                message: error.message,
                stack: error.stack,
                host: dbConfig.host,
                port: dbConfig.port,
                database: dbConfig.database,
                user: dbConfig.user,
                ssl: dbConfig.ssl ? 'enabled' : 'disabled'
            });
            
            if (i < retries - 1) {
                console.log(`Waiting ${delay}ms before next attempt...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } finally {
            if (testClient) {
                testClient.release();
            }
        }
    }

    console.error('All database connection attempts failed');
    throw lastError;
};

// Validate API Gateway event
const validateEvent = (event) => {
    if (!event.requestContext) {
        throw new Error('Missing requestContext in event');
    }
    if (!event.requestContext.http) {
        throw new Error('Missing http context in event.requestContext');
    }
    if (!event.requestContext.http.method) {
        throw new Error('Missing http method in event.requestContext.http');
    }
    if (!event.rawPath) {
        throw new Error('Missing rawPath in event');
    }
    return {
        method: event.requestContext.http.method,
        path: event.rawPath,
        body: event.body
    };
};

// Main Lambda handler
exports.handler = async (event, context) => {
    console.log('Lambda invoked with event:', JSON.stringify(event, null, 2));
    console.log('Context:', JSON.stringify(context, null, 2));

    let client;
    try {
        // Validate event structure
        const { method, path, body } = validateEvent(event);
        console.log('Validated request:', { method, path });

        // Handle OPTIONS requests for CORS first
        if (method === 'OPTIONS') {
            return createResponse(200, '');
        }

        // Test database connection
        try {
            await testConnection();
        } catch (connectionError) {
            console.error('Database connection test failed:', connectionError);
            return createResponse(500, {
                error: 'Database connection failed',
                message: connectionError.message,
                code: connectionError.code || 'DB_CONNECTION_ERROR',
                requestId: context.awsRequestId,
                timestamp: new Date().toISOString(),
                details: {
                    host: dbConfig.host,
                    port: dbConfig.port,
                    database: dbConfig.database,
                    user: dbConfig.user
                }
            });
        }

        // Handle /tasks endpoint
        if (path === '/tasks') {
            // Acquire database client for all database operations
            console.log('Acquiring database client...');
            try {
                client = await pool.connect();
                console.log('Database client acquired');

                // Initialize database first
                console.log('Initializing database...');
                const tableExists = await checkTableExists(client);
                if (!tableExists) {
                    console.log('Tasks table does not exist, creating...');
                    await client.query(`
                        CREATE TABLE tasks (
                            id SERIAL PRIMARY KEY,
                            title VARCHAR(255) NOT NULL,
                            description TEXT NOT NULL,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        )
                    `);
                    console.log('Tasks table created successfully');
                } else {
                    console.log('Tasks table already exists');
                }
                console.log('Database initialization complete');

            } catch (connectionError) {
                console.error('Database connection/initialization failed:', connectionError);
                return createResponse(500, {
                    error: 'Database initialization failed',
                    message: connectionError.message,
                    code: connectionError.code || 'DB_INIT_ERROR',
                    requestId: context.awsRequestId,
                    timestamp: new Date().toISOString(),
                    details: {
                        host: dbConfig.host,
                        port: dbConfig.port,
                        database: dbConfig.database,
                        user: dbConfig.user,
                        error: connectionError.message
                    }
                });
            }

            switch (method) {
                case 'GET': {
                    console.log('Executing GET /tasks query');
                    try {
                        const result = await client.query('SELECT * FROM tasks ORDER BY created_at DESC');
                        console.log('GET /tasks result:', { count: result.rows.length });
                        return createResponse(200, result.rows);
                    } catch (dbError) {
                        console.error('Database error during GET /tasks:', dbError);
                        // Log detailed database error
                        const dbErrorDetails = {
                            message: dbError.message,
                            code: dbError.code,
                            stack: dbError.stack,
                            requestId: context.awsRequestId,
                            query: 'SELECT * FROM tasks',
                            dbConfig: {
                                host: dbConfig.host,
                                database: dbConfig.database,
                                user: dbConfig.user,
                                ssl: dbConfig.ssl ? 'enabled' : 'disabled'
                            }
                        };
                        console.error('Detailed database error:', JSON.stringify(dbErrorDetails, null, 2));

                        return createResponse(500, {
                            error: 'Database error',
                            message: dbError.message,
                            code: dbError.code || 'DB_ERROR',
                            requestId: context.awsRequestId,
                            timestamp: new Date().toISOString()
                        });
                    }
                }

                case 'POST': {
                    console.log('Processing POST /tasks request');
                    let parsedBody;
                    try {
                        parsedBody = body ? JSON.parse(body) : {};
                    } catch (parseError) {
                        console.error('Error parsing request body:', parseError);
                        return createResponse(400, {
                            error: 'Invalid JSON in request body',
                            message: parseError.message,
                            code: 'INVALID_JSON',
                            requestId: context.awsRequestId,
                            timestamp: new Date().toISOString(),
                            details: {
                                receivedBody: body,
                                error: 'Failed to parse request body as JSON'
                            }
                        });
                    }

                    console.log('Parsed request body:', parsedBody);
                    const { title, description } = parsedBody;
                    
                    if (!title || !description) {
                        console.log('Invalid request - missing title or description:', body);
                        return createResponse(400, {
                            error: 'Missing required fields',
                            message: 'Title and description are required',
                            code: 'MISSING_FIELDS',
                            requestId: context.awsRequestId,
                            timestamp: new Date().toISOString(),
                            details: {
                                received: { title, description },
                                required: ['title', 'description']
                            }
                        });
                    }

                    try {
                        console.log('Executing POST /tasks query with:', { title, description });
                        const result = await client.query(
                            'INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING *',
                            [title, description]
                        );
                        console.log('POST /tasks result:', result.rows[0]);
                        return createResponse(201, result.rows[0]);
                    } catch (dbError) {
                        console.error('Database error during POST /tasks:', dbError);
                        console.error('Error details:', {
                            code: dbError.code,
                            message: dbError.message,
                            stack: dbError.stack
                        });
                        // Log detailed database error
                        const dbErrorDetails = {
                            message: dbError.message,
                            code: dbError.code,
                            stack: dbError.stack,
                            requestId: context.awsRequestId,
                            query: 'INSERT INTO tasks',
                            params: { title, description },
                            dbConfig: {
                                host: dbConfig.host,
                                database: dbConfig.database,
                                user: dbConfig.user,
                                ssl: dbConfig.ssl ? 'enabled' : 'disabled'
                            }
                        };
                        console.error('Detailed database error:', JSON.stringify(dbErrorDetails, null, 2));

                        return createResponse(500, {
                            error: 'Database error',
                            message: dbError.message,
                            code: dbError.code || 'DB_ERROR',
                            requestId: context.awsRequestId,
                            timestamp: new Date().toISOString()
                        });
                    }
                }

                default:
                    console.log('Method not allowed:', method);
                    return createResponse(405, {
                        error: 'Method not allowed',
                        message: `Method ${method} is not allowed for this endpoint`,
                        code: 'METHOD_NOT_ALLOWED',
                        requestId: context.awsRequestId,
                        timestamp: new Date().toISOString(),
                        details: {
                            method: method,
                            path: path,
                            allowedMethods: ['GET', 'POST', 'OPTIONS']
                        }
                    });
            }
        }

        console.log('Route not found:', path);
        return createResponse(404, {
            error: 'Route not found',
            message: `Path ${path} does not exist`,
            code: 'ROUTE_NOT_FOUND',
            requestId: context.awsRequestId,
            timestamp: new Date().toISOString(),
            details: {
                path: path,
                availableRoutes: ['/tasks']
            }
        });

    } catch (error) {
        console.error('Error processing request:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        // Log the full error details
        const errorDetails = {
            message: error.message,
            code: error.code,
            stack: error.stack,
            requestId: context.awsRequestId,
            path: event.rawPath,
            method: event.requestContext?.http?.method,
            timestamp: new Date().toISOString(),
            dbConfig: {
                host: dbConfig.host,
                database: dbConfig.database,
                user: dbConfig.user,
                ssl: dbConfig.ssl ? 'enabled' : 'disabled'
            }
        };
        
        console.error('Full error details:', JSON.stringify(errorDetails, null, 2));

        // Return a sanitized error response
        return createResponse(500, {
            error: 'Internal server error',
            message: error.message,
            code: error.code || 'INTERNAL_ERROR',
            requestId: context.awsRequestId,
            timestamp: new Date().toISOString()
        });
    } finally {
        if (client) {
            console.log('Releasing database client');
            try {
                await client.release();
                console.log('Database client released successfully');
            } catch (releaseError) {
                console.error('Error releasing database client:', releaseError);
            }
        }
    }
};
