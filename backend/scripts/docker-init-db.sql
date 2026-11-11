-- Local Docker only: the app connects as a non-superuser so Row-Level Security applies.
CREATE ROLE compliance_app LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'local_dev_only';
CREATE DATABASE compliance_hub OWNER compliance_app;
