resource "aws_cloudwatch_dashboard" "tasks_api" {
  dashboard_name = "tasks-api-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", var.lambda_function_name],
            ["AWS/Lambda", "Errors", "FunctionName", var.lambda_function_name],
            ["AWS/Lambda", "Duration", "FunctionName", var.lambda_function_name]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "Lambda Metrics"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", var.api_name],
            ["AWS/ApiGateway", "4XXError", "ApiName", var.api_name],
            ["AWS/ApiGateway", "5XXError", "ApiName", var.api_name],
            ["AWS/ApiGateway", "Latency", "ApiName", var.api_name]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "API Gateway Metrics"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.db_instance_id],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.db_instance_id],
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", var.db_instance_id]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "RDS Metrics"
        }
      }
    ]
  })
}
