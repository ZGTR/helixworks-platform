environment             = "staging"
aws_region              = "eu-west-2"
vpc_cidr                = "10.30.0.0/16"
database_instance_class = "db.t4g.small"
service_images = {
  control-plane      = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/control-plane@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  run-orchestrator   = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/run-orchestrator@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  policy-broker      = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/policy-broker@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  connector-broker   = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/connector-broker@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  release-controller = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/release-controller@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  evidence-projector = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/evidence-projector@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
}
