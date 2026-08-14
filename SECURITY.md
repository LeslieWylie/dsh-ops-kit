# Security

Do not put credentials, access tokens, private keys, customer data, or sensitive logs in issues, commits, pull requests, or test fixtures.

For a suspected vulnerability in this internal repository, report it through the company's private security or repository-owner channel and include a minimal reproduction without secrets. Do not publish an exploit or sensitive evidence in a public issue.

The runtime tools in this package are intentionally read-only and reject credential-like paths. Integrators remain responsible for configuring narrow roots and reviewing any command or network action performed outside this package.
