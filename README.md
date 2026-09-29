# Furniture Store

A production-minded furniture ecommerce application built as a modular Django REST monolith with PostgreSQL and a React + TypeScript frontend.

## Stack

- Python 3.13
- Django 5.2 LTS
- Django REST Framework
- PostgreSQL 16
- React + TypeScript + Vite (frontend)
- Docker / Docker Compose
- Redis + Celery (introduced when background jobs are implemented)

## Project structure

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

## Local setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Start the backend and PostgreSQL:

```bash
docker compose up --build
```

3. Verify the health endpoint:

```bash
curl http://localhost:8000/api/v1/health/
```

Expected response:

```json
{"status": "ok"}
```

4. Run tests:

```bash
docker compose exec backend pytest
```

5. Generate migrations after model changes:

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

## Current milestone

M1 — Foundation:

- [x] Project structure
- [x] Docker Compose
- [x] PostgreSQL service
- [x] Django backend service
- [x] Environment configuration
- [x] Django REST Framework
- [x] CORS configuration
- [x] pytest configuration
- [x] Health endpoint
- [x] Custom User model skeleton
- [ ] Run containers locally
- [ ] Generate initial migrations
- [ ] Verify tests locally

## Database documentation

The database ERD is maintained separately in DBML under `docs/database/`.
