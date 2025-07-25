#!/bin/bash
# Récupérer le token (remplacez par votre token)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInBzZXVkbyI6InRlc3R1c2VyIiwiaWF0IjoxNzUyNzY1NDY4LCJleHAiOjE3NTI3NjkwNjh9.5izzXT0BM-c3-HjWzPJRU_XgGrEoqZKO2Ul2aHz2dM8"

echo "=== Test API Routes ==="

echo "1. Profil utilisateur 1:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/users/1/profile | jq .

echo -e "\n2. Lister les tournois:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/tournaments | jq .

echo -e "\n3. Créer un tournoi:"
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"name":"Test Tournoi","description":"Test","max_players":8}' \
     http://localhost:8000/api/tournaments | jq .

echo -e "\n4. Historique matchs utilisateur 1:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/users/1/matches | jq .