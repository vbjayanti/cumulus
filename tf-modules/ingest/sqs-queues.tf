resource "aws_sqs_queue" "background_processing" {
  name                       = "${var.prefix}-backgroundProcessing"
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 60
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.background_processing_failed.arn
    maxReceiveCount     = 30
  })
  tags = var.tags
}

resource "aws_sqs_queue" "background_processing_failed" {
  name = "${var.prefix}-backgroundProcessing-failed"
  tags = var.tags
}

resource "aws_sqs_queue" "kinesis_failure" {
  name                       = "${var.prefix}-kinesisFailure"
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 20
  tags                       = var.tags
}

resource "aws_sqs_queue" "schedule_sf_dead_letter_queue" {
  name                       = "${var.prefix}-ScheduleSFDeadLetterQueue"
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 60
  message_retention_seconds  = 1209600
  tags                       = var.tags
}

# AWS recommends that SQS EventSourceMapping queues have at least 6x the lambda's timeout to allow retries on throttled invocations.
resource "aws_sqs_queue" "start_sf" {
  name                       = "${var.prefix}-startSF"
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = (local.sqs2sf_timeout * 6)
  redrive_policy = jsonencode(
    {
      deadLetterTargetArn = aws_sqs_queue.start_sf_failed.arn
      maxReceiveCount     = 30
  })
  tags = var.tags
}

resource "aws_sqs_queue" "start_sf_failed" {
  name = "${var.prefix}-startSF-failed"
  tags = var.tags
}

resource "aws_sqs_queue" "trigger_lambda_failure" {
  name                       = "${var.prefix}-triggerLambdaFailure"
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 60
  tags                       = var.tags
}
