# System Architecture

The application uses a modular monolith:

React + TypeScript → Django REST Framework → PostgreSQL

Redis and Celery will be introduced when asynchronous background jobs are implemented.

External integrations will include M-Pesa/Daraja, Stripe, object storage, and transactional email.
