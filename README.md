# SRE Coding Exercise

A serverless application with separate local development and AWS deployment environments.

## Project Structure

```
.
├── environments/              
│   ├── local/                 # Local development environment
│   │   ├── backend/           # Express.js API server
│   │   ├── frontend/          # Static frontend with local server
│   │   ├── monitoring/        # Local logging and monitoring
│   │   ├── docker-compose.yml # Local container orchestration
│   │   └── .env.example      # Local environment variables
│   └── aws/                   # AWS serverless environment
│       ├── backend/           # Lambda functions
│       ├── frontend/          # S3/CloudFront static site
│       ├── infrastructure/    # Terraform IaC templates
│       ├── monitoring/        # AWS monitoring configurations
│       └── .env.example      # AWS environment variables
├── .github/                   # GitHub Actions workflows
├── package.json              # Root package.json
└── README.md                # Project documentation
```

## Prerequisites

- Node.js 18 or later
- Docker and Docker Compose
- AWS CLI configured (for AWS deployment)
- Terraform (for AWS infrastructure)

## Local Development Environment

### Setup

1. Copy the environment variables:
   ```bash
   cd environments/local
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd environments/local/backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. Start the local environment:
   ```bash
   cd environments/local
   docker-compose up
   ```

This will start:
- PostgreSQL database
- Express.js backend (http://localhost:3000)
- Frontend static server (http://localhost:8080)
- Local monitoring (logs in `environments/local/logs/`)

### Testing Local Environment

1. Run backend tests:
   ```bash
   cd environments/local/backend
   npm test
   ```

2. Run frontend tests:
   ```bash
   cd environments/local/frontend
   npm test
   ```

3. Run integration tests:
   ```bash
   cd environments/local
   npm run test:integration
   ```

## AWS Deployment Guide

### Prerequisites

1. AWS CLI installed and configured:
   ```bash
   aws configure
   # Enter your AWS Access Key ID
   # Enter your AWS Secret Access Key
   # Enter your default region (e.g., us-east-1)
   # Enter your output format (json)
   ```

2. Terraform installed (version 1.0.0 or later):
   ```bash
   brew install terraform    # For macOS
   terraform version        # Verify installation
   ```

3. Domain name (optional, for custom domain setup)

### Infrastructure Setup with Terraform

#### 1. Initialize AWS Infrastructure

```bash
cd environments/aws/infrastructure
```

Create a `terraform.tfvars` file:
```hcl
# General
aws_region     = "us-east-1"
project_name   = "tasks-api"
environment    = "production"

# RDS Configuration
db_name        = "tasks_db"
db_username    = "admin"
db_password    = "your-secure-password"  # Change this
db_instance    = "db.t3.micro"

# Lambda Configuration
lambda_memory  = 256
lambda_timeout = 30

# Frontend Configuration
domain_name    = "your-domain.com"  # Optional
```

Initialize Terraform:
```bash
terraform init
```

#### 2. Review Infrastructure Plan

```bash
terraform plan
```

This will create:
- VPC with public and private subnets
- RDS PostgreSQL instance in private subnet
- Lambda function for API
- API Gateway with REST API
- S3 bucket for frontend
- CloudFront distribution
- Route53 records (if domain provided)
- CloudWatch log groups
- Required IAM roles and policiescd environments/aws/infrastructure
terraform init

#### 3. Apply Infrastructure

```bash
terraform apply
```

Save the outputs:
```bash
terraform output > deployment_outputs.txt
```

### Application Deployment

#### 1. Backend Deployment

1. Update Lambda function code:
   ```bash
   cd environments/aws/backend
   
   # Install dependencies
   npm install
   
   # Create deployment package
   zip -r function.zip ./*
   
   # Deploy to Lambda
   aws lambda update-function-code \
     --function-name $(terraform output -raw lambda_function_name) \
     --zip-file fileb://function.zip
   ```

2. Update Lambda environment variables:
   ```bash
   aws lambda update-function-configuration \
     --function-name $(terraform output -raw lambda_function_name) \
     --environment Variables="{
       DB_HOST=$(terraform output -raw rds_endpoint),
       DB_NAME=tasks_db,
       DB_USER=admin,
       DB_PASSWORD=your-secure-password
     }"
   ```

#### 2. Frontend Deployment

1. Update API endpoint in frontend configuration:
   ```bash
   cd environments/aws/frontend
   
   # Update API endpoint in config
   echo "API_ENDPOINT=$(terraform output -raw api_gateway_url)" > .env
   ```

2. Build and deploy frontend:
   ```bash
   # Install dependencies
   npm install
   
   # Build frontend
   npm run build
   
   # Deploy to S3
   aws s3 sync dist/ s3://$(terraform output -raw frontend_bucket_name)
   
   # Invalidate CloudFront cache
   aws cloudfront create-invalidation \
     --distribution-id $(terraform output -raw cloudfront_distribution_id) \
     --paths "/*"
   ```

### Monitoring Setup

#### 1. CloudWatch Dashboards

```bash
cd environments/aws/monitoring/cloudwatch
terraform apply
```

#### 2. Configure Splunk Integration

1. Set up Splunk HEC token in AWS Secrets Manager:
   ```bash
   aws secretsmanager create-secret \
     --name splunk-hec-token \
     --secret-string "your-splunk-hec-token"
   ```

2. Apply Splunk configuration:
   ```bash
   cd environments/aws/monitoring/splunk
   terraform apply
   ```

#### 3. Set up Sentry

1. Create project in Sentry
2. Update Lambda environment with Sentry DSN:
   ```bash
   aws lambda update-function-configuration \
     --function-name $(terraform output -raw lambda_function_name) \
     --environment Variables="{
       SENTRY_DSN=your-sentry-dsn
     }"
   ```

### Verification Steps

1. Test API Gateway endpoint:
   ```bash
   curl $(terraform output -raw api_gateway_url)/tasks
   ```

2. Access frontend:
   ```bash
   echo "Frontend URL: $(terraform output -raw cloudfront_domain_name)"
   ```

3. Verify monitoring:
   - Check CloudWatch dashboards
   - Verify logs in Splunk
   - Confirm error tracking in Sentry

### Infrastructure Updates

To update infrastructure:
```bash
cd environments/aws/infrastructure
terraform plan    # Review changes
terraform apply   # Apply changes
```

### Cleanup

To destroy infrastructure (BE CAREFUL!):
```bash
# Empty S3 bucket first
aws s3 rm s3://$(terraform output -raw frontend_bucket_name) --recursive

# Destroy infrastructure
terraform destroy
```

### Security Notes

1. Secrets Management:
   - Database credentials in AWS Secrets Manager
   - API keys in environment variables
   - SSL/TLS certificates managed by ACM

2. Network Security:
   - RDS in private subnet
   - VPC endpoints for AWS services
   - Security groups with minimal access

3. Access Control:
   - IAM roles with least privilege
   - CORS configured on API Gateway
   - WAF rules on CloudFront (optional)

## Monitoring

### Local Environment
- Logs are stored in `environments/local/logs/`
- Access logs through Docker Compose logs
- Optional Sentry integration for error tracking

### AWS Environment
- CloudWatch dashboards and alarms
- Splunk integration for log aggregation
- Sentry for error tracking
- SNS notifications for alerts

## CI/CD

GitHub Actions workflows are configured for:
- Automated testing
- Infrastructure validation
- Deployment to AWS
- Security scanning

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests locally
4. Submit a pull request

## Security

- Never commit `.env` files
- Use AWS Secrets Manager for sensitive data
- Follow the principle of least privilege
- Regular security updates
- Automated security scanning

## Testing the API

You can test the API endpoints using curl:

```bash
# Create a new task
curl -X POST https://[YOUR-API-GATEWAY-URL]/prod/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Task", "description": "This is a test task"}'

# Get all tasks
curl https://[YOUR-API-GATEWAY-URL]/prod/tasks
```

## Monitoring and Observability

### Sentry
- Error monitoring and reporting is configured in the Lambda function
- View errors and performance metrics at: https://sentry.io/organizations/[YOUR-ORG]/issues/

### CloudWatch
- CloudWatch Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=[REGION]#dashboards:name=tasks-api-dashboard
- Metrics monitored:
  - Lambda: Invocations, Errors, Duration
  - API Gateway: Request Count, 4XX/5XX Errors, Latency
  - RDS: CPU Utilization, Free Storage Space, Database Connections

### CloudWatch Alarms
The following alarms are configured:
1. Lambda Error Rate: Triggers when errors exceed 1 per 5 minutes
2. API Gateway Latency: Triggers when average latency exceeds 1000ms
3. API Gateway 5XX Errors: Triggers when 5XX errors exceed 5 per 5 minutes

## Security

- Database credentials are managed through AWS Secrets Manager
- API Gateway endpoints are secured with CORS policies
- Lambda functions run in a VPC with private subnets
- RDS instance is in a private subnet with restricted security group access

## Architecture Diagram

```
CloudFront
    ↓
API Gateway
    ↓
Lambda Function (VPC)
    ↓
RDS PostgreSQL (Private Subnet)
```

## Known Issues and Limitations

1. Rate Limiting: API Gateway is configured with default limits (10,000 requests per second)
2. Database Scaling: RDS instance is t3.micro (suitable for development/testing)
3. Cold Starts: Lambda functions in VPC may experience longer cold starts

## Future Improvements

1. Implement CI/CD pipeline with GitHub Actions
2. Add unit tests for Lambda functions
3. Set up Splunk integration for centralized logging
4. Implement custom domain names for API and frontend
5. Add authentication and authorization

## Splunk Integration Architecture

The application is designed to forward logs to Splunk using the following components:

1. **AWS Kinesis Firehose**:
   - Collects logs from CloudWatch Log Groups
   - Buffers and batches logs for efficient delivery
   - Provides reliable delivery with retry mechanisms
   - Compresses data using GZIP

2. **Log Sources**:
   - Lambda function logs
   - API Gateway access logs
   - RDS PostgreSQL logs
   - CloudWatch metrics

3. **Delivery Flow**:
```
CloudWatch Logs → CloudWatch Log Subscription → Kinesis Firehose → Splunk HTTP Event Collector (HEC)
```

4. **Backup and Error Handling**:
   - Failed deliveries are backed up to S3
   - Configurable retry duration (60 seconds)
   - Monitoring via CloudWatch metrics

5. **Required Splunk Configuration** (not included in this demo):
   - Splunk Enterprise or Splunk Cloud instance
   - HTTP Event Collector (HEC) token
   - Network access from AWS to Splunk HEC endpoint

To complete the Splunk integration in a production environment:
1. Replace `[SPLUNK-HEC-URL]` with your Splunk HEC endpoint
2. Set up a Splunk HEC token and update the `access_key` in Firehose configuration
3. Configure Splunk indexes and sourcetypes
4. Create Splunk dashboards for monitoring

Note: For this demo, the Splunk integration infrastructure is set up but not connected to an actual Splunk instance.
