# Lambda Error Rate Alarm
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.lambda_function_name}-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period             = "300"
  statistic          = "Sum"
  threshold          = "1"
  alarm_description  = "Lambda function error rate exceeded threshold"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = var.lambda_function_name
  }
}

# API Gateway Latency Alarm
resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${var.api_name}-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period             = "300"
  statistic          = "Average"
  threshold          = "1000"
  alarm_description  = "API Gateway latency exceeded threshold"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    ApiName = var.api_name
  }
}

# RDS High CPU Alarm
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.db_instance_id}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period             = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_description  = "RDS CPU utilization exceeded threshold"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.db_instance_id
  }
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "tasks-api-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}
