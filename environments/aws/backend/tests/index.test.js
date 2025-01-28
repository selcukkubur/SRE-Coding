const { handler } = require('../src/index');

// Mock the PostgreSQL client
jest.mock('pg', () => {
    const mPool = {
        query: jest.fn()
    };
    return { Pool: jest.fn(() => mPool) };
});

// Mock Sentry
jest.mock('@sentry/node', () => ({
    init: jest.fn(),
    captureException: jest.fn(),
    startTransaction: jest.fn(() => ({
        finish: jest.fn()
    })),
    withScope: jest.fn(),
    flush: jest.fn()
}));

describe('Lambda Handler Tests', () => {
    let mockEvent;
    let mockContext;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock AWS Lambda context
        mockContext = {
            awsRequestId: 'test-request-id'
        };

        // Set environment variables
        process.env.DB_HOST = 'localhost';
        process.env.DB_NAME = 'test_db';
        process.env.DB_USER = 'test_user';
        process.env.DB_PASSWORD = 'test_password';
        process.env.SENTRY_DSN = 'https://test@sentry.io/123';
    });

    describe('GET /tasks', () => {
        beforeEach(() => {
            mockEvent = {
                requestContext: {
                    http: {
                        method: 'GET',
                        path: '/tasks'
                    }
                }
            };
        });

        it('should return all tasks', async () => {
            const mockTasks = [
                { id: 1, description: 'Test task 1', created_at: new Date() },
                { id: 2, description: 'Test task 2', created_at: new Date() }
            ];

            const { Pool } = require('pg');
            const pool = new Pool();
            pool.query.mockResolvedValueOnce({ rows: mockTasks });

            const response = await handler(mockEvent, mockContext);

            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.body)).toEqual(mockTasks);
            expect(pool.query).toHaveBeenCalledWith(
                'SELECT * FROM tasks ORDER BY created_at DESC'
            );
        });

        it('should handle database errors', async () => {
            const { Pool } = require('pg');
            const pool = new Pool();
            pool.query.mockRejectedValueOnce(new Error('Database error'));

            const response = await handler(mockEvent, mockContext);

            expect(response.statusCode).toBe(500);
            expect(JSON.parse(response.body)).toHaveProperty('error');
        });
    });

    describe('POST /tasks', () => {
        beforeEach(() => {
            mockEvent = {
                requestContext: {
                    http: {
                        method: 'POST',
                        path: '/tasks'
                    }
                },
                body: JSON.stringify({ description: 'New task' })
            };
        });

        it('should create a new task', async () => {
            const mockTask = {
                id: 1,
                description: 'New task',
                created_at: new Date()
            };

            const { Pool } = require('pg');
            const pool = new Pool();
            pool.query.mockResolvedValueOnce({ rows: [mockTask] });

            const response = await handler(mockEvent, mockContext);

            expect(response.statusCode).toBe(201);
            expect(JSON.parse(response.body)).toEqual(mockTask);
            expect(pool.query).toHaveBeenCalledWith(
                'INSERT INTO tasks (description) VALUES ($1) RETURNING *',
                ['New task']
            );
        });

        it('should validate required fields', async () => {
            mockEvent.body = JSON.stringify({});

            const response = await handler(mockEvent, mockContext);

            expect(response.statusCode).toBe(400);
            expect(JSON.parse(response.body)).toHaveProperty('error');
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid JSON', async () => {
            mockEvent = {
                requestContext: {
                    http: {
                        method: 'POST',
                        path: '/tasks'
                    }
                },
                body: 'invalid json'
            };

            const response = await handler(mockEvent, mockContext);

            expect(response.statusCode).toBe(400);
            expect(JSON.parse(response.body)).toHaveProperty('error');
        });

        it('should handle unknown routes', async () => {
            mockEvent = {
                requestContext: {
                    http: {
                        method: 'GET',
                        path: '/unknown'
                    }
                }
            };

            const response = await handler(mockEvent, mockContext);

            expect(response.statusCode).toBe(404);
            expect(JSON.parse(response.body)).toHaveProperty('error');
        });
    });
});
