environment             = "prod"
aws_region              = "eu-west-2"
vpc_cidr                = "10.40.0.0/16"
database_instance_class = "db.r7g.large"
service_images = {
  control-plane      = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/control-plane@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  run-orchestrator   = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/run-orchestrator@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  policy-broker      = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/policy-broker@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  connector-broker   = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/connector-broker@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  release-controller = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/release-controller@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  evidence-projector = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/evidence-projector@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
}
