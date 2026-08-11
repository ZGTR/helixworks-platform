variable "environment" {
  description = "Deployment environment. Local uses Compose and is not accepted here."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod"
  }
}

variable "aws_region" {
  description = "AWS region for this isolated environment."
  type        = string
  default     = "eu-west-2"
}

variable "vpc_cidr" {
  description = "CIDR for the environment VPC."
  type        = string
}

variable "service_images" {
  description = "Build-once image digest URI for each deployable. Tags are rejected by convention and CI."
  type        = map(string)

  validation {
    condition = alltrue([
      for image in values(var.service_images) : can(regex("@sha256:[a-f0-9]{64}$", image))
    ])
    error_message = "every service image must be pinned by sha256 digest"
  }
}

variable "database_instance_class" {
  description = "RDS instance class used by each service-owned PostgreSQL database."
  type        = string
  default     = "db.t4g.micro"
}

variable "desired_count" {
  description = "Desired ECS task count by deployable."
  type        = map(number)
  default     = {}
}
