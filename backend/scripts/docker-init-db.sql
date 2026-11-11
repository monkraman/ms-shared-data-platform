-- Local Docker only: a non-superuser owner with CREATEROLE (like Neon's owner role).
CREATE ROLE compliance_app LOGIN NOSUPERUSER CREATEROLE PASSWORD 'local_dev_only';
CREATE DATABASE compliance_hub OWNER compliance_app;
