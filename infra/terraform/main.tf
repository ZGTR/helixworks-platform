locals {
  business_services = toset([
    "control-plane",
    "run-orchestrator",
    "policy-broker",
    "connector-broker",
    "release-controller",
  ])
  deployables       = setunion(local.business_services, toset(["evidence-projector"]))
  stateful_services = local.deployables
  azs               = slice(data.aws_availability_zones.available.names, 0, 2)
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_kms_key" "platform" {
  description             = "HelixWorks ${var.environment} data key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_vpc" "platform" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
}

resource "aws_internet_gateway" "platform" {
  vpc_id = aws_vpc.platform.id
}

resource "aws_subnet" "public" {
  for_each = { for index, az in local.azs : az => index }

  vpc_id                  = aws_vpc.platform.id
  availability_zone       = each.key
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, each.value)
  map_public_ip_on_launch = false
}

resource "aws_subnet" "private" {
  for_each = { for index, az in local.azs : az => index }

  vpc_id            = aws_vpc.platform.id
  availability_zone = each.key
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, each.value + 8)
}

resource "aws_eip" "nat" {
  domain = "vpc"

  depends_on = [aws_internet_gateway.platform]
}

resource "aws_nat_gateway" "platform" {
  allocation_id = aws_eip.nat.id
  subnet_id     = values(aws_subnet.public)[0].id

  depends_on = [aws_internet_gateway.platform]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.platform.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.platform.id
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.platform.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.platform.id
  }
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private.id
}

resource "aws_security_group" "service" {
  name_prefix = "helixworks-${var.environment}-service-"
  description = "Egress for HelixWorks private ECS tasks"
  vpc_id      = aws_vpc.platform.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "database" {
  name_prefix = "helixworks-${var.environment}-database-"
  description = "PostgreSQL only from HelixWorks ECS tasks"
  vpc_id      = aws_vpc.platform.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.service.id]
  }
}

resource "aws_db_subnet_group" "platform" {
  name       = "helixworks-${var.environment}"
  subnet_ids = values(aws_subnet.private)[*].id
}

resource "aws_db_instance" "service" {
  for_each = local.stateful_services

  identifier                   = "helixworks-${var.environment}-${each.key}"
  engine                       = "postgres"
  engine_version               = "17.6"
  instance_class               = var.database_instance_class
  allocated_storage            = var.environment == "prod" ? 100 : 20
  max_allocated_storage        = var.environment == "prod" ? 500 : 100
  storage_encrypted            = true
  kms_key_id                   = aws_kms_key.platform.arn
  db_name                      = replace(each.key, "-", "_")
  username                     = "service_owner"
  manage_master_user_password  = true
  db_subnet_group_name         = aws_db_subnet_group.platform.name
  vpc_security_group_ids       = [aws_security_group.database.id]
  publicly_accessible          = false
  multi_az                     = var.environment == "prod"
  backup_retention_period      = var.environment == "prod" ? 35 : 7
  deletion_protection          = var.environment == "prod"
  skip_final_snapshot          = var.environment != "prod"
  performance_insights_enabled = true
  apply_immediately            = false
}

resource "aws_ecs_cluster" "platform" {
  name = "helixworks-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecr_repository" "service" {
  for_each = local.deployables

  name                 = "helixworks/${each.key}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.platform.arn
  }
}

resource "aws_cloudwatch_log_group" "service" {
  for_each = local.deployables

  name              = "/helixworks/${var.environment}/${each.key}"
  retention_in_days = var.environment == "prod" ? 365 : 30
  kms_key_id        = aws_kms_key.platform.arn
}

resource "aws_cloudwatch_event_bus" "domain" {
  name = "helixworks-${var.environment}-domain"
}

resource "aws_sqs_queue" "dead_letter" {
  for_each = local.deployables

  name                      = "helixworks-${var.environment}-${each.key}-dlq"
  message_retention_seconds = 1209600
  kms_master_key_id         = aws_kms_key.platform.arn
}

resource "aws_sqs_queue" "service" {
  for_each = local.deployables

  name                       = "helixworks-${var.environment}-${each.key}"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600
  kms_master_key_id          = aws_kms_key.platform.arn
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dead_letter[each.key].arn
    maxReceiveCount     = 5
  })
}

resource "aws_s3_bucket" "artifacts" {
  bucket = "helixworks-${var.environment}-${data.aws_caller_identity.current.account_id}-artifacts"
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.platform.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "helixworks-${var.environment}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  for_each = local.deployables

  name               = "helixworks-${var.environment}-${each.key}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "task" {
  for_each = local.deployables

  statement {
    sid = "ReadOwnDatabaseCredential"
    actions = [
      "secretsmanager:GetSecretValue",
      "kms:Decrypt",
    ]
    resources = [
      aws_db_instance.service[each.key].master_user_secret[0].secret_arn,
      aws_kms_key.platform.arn,
    ]
  }

  statement {
    sid       = "PublishDomainFacts"
    actions   = ["events:PutEvents"]
    resources = [aws_cloudwatch_event_bus.domain.arn]
  }

  statement {
    sid = "ConsumeOwnQueue"
    actions = [
      "sqs:ChangeMessageVisibility",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:ReceiveMessage",
    ]
    resources = [aws_sqs_queue.service[each.key].arn]
  }
}

resource "aws_iam_role_policy" "task" {
  for_each = local.deployables

  name   = "least-privilege-runtime"
  role   = aws_iam_role.task[each.key].id
  policy = data.aws_iam_policy_document.task[each.key].json
}

resource "aws_ecs_task_definition" "service" {
  for_each = local.deployables

  family                   = "helixworks-${var.environment}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task[each.key].arn

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = var.service_images[each.key]
      essential = true
      portMappings = each.key == "evidence-projector" ? [] : [
        {
          name          = "http"
          containerPort = 3000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "HELIXWORKS_ENVIRONMENT", value = var.environment },
        { name = "DATABASE_SECRET_ARN", value = aws_db_instance.service[each.key].master_user_secret[0].secret_arn },
        { name = "DOMAIN_EVENT_BUS_NAME", value = aws_cloudwatch_event_bus.domain.name },
        { name = "SERVICE_QUEUE_URL", value = aws_sqs_queue.service[each.key].url },
      ]
      readonlyRootFilesystem = true
      user                   = "10001"
      healthCheck = each.key == "evidence-projector" ? null : {
        command     = ["CMD-SHELL", "node healthcheck.mjs"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 20
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.service[each.key].name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "service"
        }
      }
    }
  ])

  runtime_platform {
    cpu_architecture        = "ARM64"
    operating_system_family = "LINUX"
  }
}

resource "aws_ecs_service" "service" {
  for_each = local.deployables

  name            = each.key
  cluster         = aws_ecs_cluster.platform.id
  task_definition = aws_ecs_task_definition.service[each.key].arn
  desired_count   = lookup(var.desired_count, each.key, var.environment == "prod" ? 2 : 1)
  launch_type     = "FARGATE"

  enable_execute_command = false
  propagate_tags         = "SERVICE"

  network_configuration {
    assign_public_ip = false
    security_groups  = [aws_security_group.service.id]
    subnets          = values(aws_subnet.private)[*].id
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}
