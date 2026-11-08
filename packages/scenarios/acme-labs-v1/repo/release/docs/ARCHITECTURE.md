# Architecture

The API (`src/api`) is a stateless Fastify service behind the Acme edge.
Billing jobs run nightly and write invoices to Postgres. Search indexes are
built per tenant and cached in-process.
