# TLS certificates

Production TLS private keys/certificates are intentionally not included in this package.
Provision `privkey.pem` and `fullchain.pem` here (or mount them from a secret manager) before starting the nginx service.
