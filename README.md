# Furniture Store

A production-minded furniture ecommerce application built as a modular Django REST monolith with PostgreSQL and a React + TypeScript frontend.

The project is designed around realistic ecommerce workflows including product variants, inventory management, cart and wishlist functionality, order processing, payment attempts, inventory reservations, and transactional consistency.

## Stack

* Python 3.13
* Django 5.2 LTS
* Django REST Framework
* PostgreSQL 16
* React + TypeScript + Vite
* Docker / Docker Compose
* pytest / pytest-django
* Redis + Celery — introduced when background jobs are implemented
* JWT authentication — implemented as part of the authentication phase
* Cloudinary/S3-compatible storage — planned for product images
* M-Pesa Daraja API + Stripe — planned payment providers

## Architecture

The backend follows a **modular monolith** architecture. Each Django application owns a specific business domain while remaining within a single deployable backend.

```text
furniture-store/
├── backend/
│   ├── config/
│   ├── common/
│   ├── accounts/
│   ├── catalog/
│   ├── inventory/
│   ├── cart/
│   ├── orders/
│   ├── payments/
│   ├── customers/
│   └── manage.py
├── frontend/
├── docs/
│   ├── database/
│   └── architecture/
├── docker-compose.yml
├── .env.example
└── pytest.ini
```

### Backend domains

| App         | Responsibility                                           |
| ----------- | -------------------------------------------------------- |
| `accounts`  | Users, roles and addresses                               |
| `catalog`   | Categories, products, images and product variants        |
| `inventory` | Stock levels and inventory reservations                  |
| `cart`      | Shopping carts, cart items and wishlists                 |
| `orders`    | Orders, order items and delivery                         |
| `payments`  | Payment attempts, provider integration and payment state |
| `customers` | Customer-facing features such as reviews                 |
| `common`    | Shared infrastructure and health checks                  |

## Key Design Decisions

### Product and ProductVariant

Products represent the furniture item customers see, while variants represent the actual sellable configuration/SKU.

For example:

```text
Product
└── Modern Oak Dining Table
    ├── Variant: Natural Oak / 4-Seater
    ├── Variant: Natural Oak / 6-Seater
    └── Variant: Walnut / 6-Seater
```

Inventory belongs to the **variant**, because stock is tracked against a specific sellable configuration.

### Inventory concurrency

Checkout uses database transactions and row-level locking:

```python
transaction.atomic()
select_for_update()
```

This prevents concurrent checkout requests from overselling the same inventory.

### Order snapshots

Orders store historical snapshots of important product and customer information.

`OrderItem` retains values such as:

* Product name
* Variant name
* SKU
* Unit price
* Quantity
* Line total

This means historical orders remain accurate even if a product's name, SKU or price changes later.

### Payment attempts

An order can have multiple payment attempts.

A failed payment does not mean the order itself is permanently failed. A customer may retry payment, creating another payment attempt.

Payment state is therefore tracked independently from the existence of a `Payment` record.

### Business logic

Business workflows are kept outside the models where appropriate.

The intended separation is:

```text
Models
  ↓
Database structure + constraints

Serializers
  ↓
API validation + representation

Views
  ↓
HTTP/API orchestration

Services
  ↓
Business workflows
  ↓
Transactions / external providers
```

This keeps complex workflows such as checkout, payment processing, refunds and order transitions from becoming oversized Django models or views.

## Local Setup

### 1. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env` with your local configuration.

### 2. Start the backend and PostgreSQL

```bash
docker compose up --build
```

### 3. Verify the health endpoint

```bash
curl http://localhost:8000/api/v1/health/
```

Expected response:

```json
{"status": "ok"}
```

### 4. Run tests

```bash
docker compose exec backend pytest
```

### 5. Generate migrations after model changes

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

## Development Progress

### Phase 1 — Foundation ✅

* [x] Project structure
* [x] Docker Compose
* [x] PostgreSQL service
* [x] Django backend service
* [x] Environment configuration
* [x] Django REST Framework
* [x] CORS configuration
* [x] pytest configuration
* [x] Health endpoint
* [x] Custom User model
* [x] Database models
* [x] Initial migrations
* [x] Foundation tests

### Phase 2 — Authentication & Authorization ✅

* [x] Custom user model
* [x] User roles
* [x] Authentication
* [x] JWT-based authentication
* [x] User permissions
* [x] Server-side authorization

### Phase 3 — Catalog ✅

* [x] Categories
* [x] Products
* [x] Product images
* [x] Product variants
* [x] SKU management
* [x] Catalog API
* [x] Catalog validation

### Phase 4 — Inventory & Cart ✅

* [x] Variant-level inventory
* [x] Available stock calculation
* [x] Inventory validation
* [x] Cart
* [x] Cart items
* [x] Wishlist
* [x] Cart validation

### Phase 5 — Orders & Checkout ✅

* [x] Order model
* [x] Order items
* [x] Delivery model
* [x] Order address snapshots
* [x] Order item historical snapshots
* [x] Order status lifecycle
* [x] Checkout workflow
* [x] Inventory reservation
* [x] Transactional checkout
* [x] Concurrent inventory protection
* [x] Order cancellation rules

### Phase 6 — Payments 🚧

**Current phase**

* [ ] Payment API
* [ ] Payment attempt lifecycle
* [ ] Payment validation
* [ ] Payment idempotency
* [ ] M-Pesa integration
* [ ] Stripe integration
* [ ] Provider callbacks/webhooks
* [ ] Successful payment → order state transition
* [ ] Failed payment handling
* [ ] Payment retries
* [ ] Refund workflow
* [ ] Refund state tracking
* [ ] Payment reconciliation

The backend will treat **provider callbacks/webhooks as the source of truth** for payment completion rather than trusting frontend payment responses.

### Phase 7 — Customer Features

* [ ] Customer profile
* [ ] Address management
* [ ] Order history
* [ ] Order tracking
* [ ] Product reviews
* [ ] Review validation
* [ ] Purchase verification

### Phase 8 — Staff & Administration

* [ ] Product management
* [ ] Category management
* [ ] Variant management
* [ ] Inventory management
* [ ] Order management
* [ ] Customer management
* [ ] Payment monitoring
* [ ] Role-based administrative operations

### Phase 9 — Background Processing

* [ ] Redis
* [ ] Celery
* [ ] Payment-related background jobs
* [ ] Expired reservation handling
* [ ] Email notifications
* [ ] Order notifications
* [ ] Scheduled cleanup tasks

### Phase 10 — Hardening & Production Readiness

* [ ] Rate limiting
* [ ] Concurrency tests
* [ ] Payment idempotency tests
* [ ] Security hardening
* [ ] API documentation with OpenAPI
* [ ] Structured logging
* [ ] Error monitoring
* [ ] Performance testing
* [ ] Database query optimization
* [ ] Production configuration

### Phase 11 — React Frontend

* [ ] React + TypeScript setup
* [ ] Authentication UI
* [ ] Product catalogue
* [ ] Product details
* [ ] Cart
* [ ] Wishlist
* [ ] Checkout
* [ ] Payment flow
* [ ] Customer account
* [ ] Order tracking
* [ ] Responsive design

## Database Documentation

The database ERD is maintained separately in DBML under:

```text
docs/database/furniture-store.dbml
```

The architecture documentation is maintained under:

```text
docs/architecture/
```

Database documentation should remain synchronized with the Django models and business rules as development progresses.

## Testing

The project uses pytest and pytest-django for automated testing.

Tests cover areas including:

* Model constraints
* API validation
* Authentication
* Authorization
* Catalog behaviour
* Inventory management
* Cart behaviour
* Checkout
* Order state transitions
* Inventory reservation
* Payment processing
* Payment idempotency
* Refund handling
* Concurrency-sensitive operations

Run the test suite with:

```bash
docker compose exec backend pytest
```

## Project Status

**Current phase: Phase 6 — Payments**

The core ecommerce foundation is in place through the complete order and checkout workflow. The next major milestone is integrating payment processing while maintaining transactional consistency, idempotency and reliable provider callbacks.

The project intentionally avoids unnecessary infrastructure such as microservices, Kubernetes, Kafka, GraphQL or an API gateway. The focus is on building a maintainable ecommerce system with sound domain modelling, database integrity, testing and production-minded backend practices.
