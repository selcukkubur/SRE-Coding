variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project, used for resource naming"
  type        = string
  default     = "tasks-api"
}

variable "environment" {
  description = "Environment name (e.g., prod, dev, staging)"
  type        = string
  default     = "prod"
}

variable "frontend_bucket_name" {
  description = "Name of the S3 bucket for frontend hosting"
  type        = string
}

variable "database_name" {
  description = "Name of the PostgreSQL database"
  type        = string
  default     = "tasks_db"
}

variable "database_username" {
  description = "Username for the PostgreSQL database"
  type        = string
  default     = "admin"
}

variable "database_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "sentry_dsn" {
  description = "Sentry DSN for error tracking"
  type        = string
  sensitive   = true
}

variable "splunk_hec_url" {
  description = "Splunk HEC URL for log forwarding"
  type        = string
  sensitive   = true
}

variable "splunk_hec_token" {
  description = "Splunk HEC token for authentication"
  type        = string
  sensitive   = true
}

variable "alert_email" {
  description = "Email address for CloudWatch alerts"
  type        = string
}

variable "lambda_memory" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 256
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
}

variable "enable_vpc_endpoints" {
  description = "Enable VPC endpoints for enhanced security"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {
    Project     = "SRE-Coding-Exercise"
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}
