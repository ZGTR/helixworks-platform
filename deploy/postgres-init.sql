CREATE DATABASE helixworks_control_plane;
CREATE DATABASE helixworks_run_orchestrator;
CREATE DATABASE helixworks_policy_broker;
CREATE DATABASE helixworks_connector_broker;
CREATE DATABASE helixworks_release_controller;
CREATE DATABASE helixworks_evidence;

REVOKE CONNECT ON DATABASE helixworks_control_plane FROM PUBLIC;
REVOKE CONNECT ON DATABASE helixworks_run_orchestrator FROM PUBLIC;
REVOKE CONNECT ON DATABASE helixworks_policy_broker FROM PUBLIC;
REVOKE CONNECT ON DATABASE helixworks_connector_broker FROM PUBLIC;
REVOKE CONNECT ON DATABASE helixworks_release_controller FROM PUBLIC;
REVOKE CONNECT ON DATABASE helixworks_evidence FROM PUBLIC;
