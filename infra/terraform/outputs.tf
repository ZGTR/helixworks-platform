output "ecs_cluster_arn" {
  value = aws_ecs_cluster.platform.arn
}

output "domain_event_bus_arn" {
  value = aws_cloudwatch_event_bus.domain.arn
}

output "service_queue_arns" {
  value = { for name, queue in aws_sqs_queue.service : name => queue.arn }
}

output "artifact_bucket" {
  value = aws_s3_bucket.artifacts.id
}

output "database_secret_arns" {
  value     = { for name, database in aws_db_instance.service : name => database.master_user_secret[0].secret_arn }
  sensitive = true
}
