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
- Required IAM roles and policies

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
