environment             = "dev"
aws_region              = "eu-west-2"
vpc_cidr                = "10.20.0.0/16"
database_instance_class = "db.t4g.micro"
service_images = {
  control-plane      = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/control-plane@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  run-orchestrator   = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/run-orchestrator@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  policy-broker      = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/policy-broker@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  connector-broker   = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/connector-broker@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  release-controller = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/release-controller@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  evidence-projector = "000000000000.dkr.ecr.eu-west-2.amazonaws.com/helixworks/evidence-projector@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
