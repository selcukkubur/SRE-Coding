-- Create tasks table with the exact required schema
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
