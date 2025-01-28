# Kinesis Firehose for Splunk integration
resource "aws_kinesis_firehose_delivery_stream" "splunk" {
  name        = "tasks-api-logs-to-splunk"
  destination = "splunk"

  splunk_configuration {
    hec_endpoint               = var.splunk_hec_url
    hec_token                 = var.splunk_hec_token
    hec_acknowledgment_timeout = 300
    retry_duration            = 300

    processing_configuration {
      enabled = true

      processors {
        type = "Lambda"

        parameters {
          parameter_name  = "LambdaArn"
          parameter_value = aws_lambda_function.log_processor.arn
        }
      }
    }
  }
}

# IAM role for CloudWatch Logs to Kinesis Firehose
resource "aws_iam_role" "cloudwatch_to_firehose" {
  name = "cloudwatch-to-firehose-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "logs.amazonaws.com"
        }
      }
    ]
  })
}

# CloudWatch Log Subscription Filter
resource "aws_cloudwatch_log_subscription_filter" "lambda_logs_to_splunk" {
  name            = "lambda-logs-to-splunk"
  log_group_name  = "/aws/lambda/${var.lambda_function_name}"
  filter_pattern  = ""
  destination_arn = aws_kinesis_firehose_delivery_stream.splunk.arn
  role_arn        = aws_iam_role.cloudwatch_to_firehose.arn
}
