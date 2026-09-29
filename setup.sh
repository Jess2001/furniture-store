#!/usr/bin/env bash
set -e

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Update the secrets/passwords before production use."
fi

docker compose up --build -d

docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
docker compose exec backend pytest

echo "M1 setup complete. Health: http://localhost:8000/api/v1/health/"
