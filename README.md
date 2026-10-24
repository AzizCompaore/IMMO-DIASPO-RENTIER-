# IMMO DIASPO RENTIER — application complète (URIEL GROUP)

Tunnel de conversion (landing → questionnaire 4 étapes → remerciement) + tableau de bord d'administration.
Stack : React 18 + Vite + TypeScript · Django 5.2 + Django REST Framework · PostgreSQL 16 · Docker Compose. Python 3.12.

## Lancement local
```bash
cd backend && pip install -r requirements.txt
export DJANGO_DEBUG=1 DB_ENGINE=sqlite      # SQLite pour tester vite ; sans DB_ENGINE : PostgreSQL (POSTGRES_*)
python manage.py migrate && python manage.py setup_roles
python manage.py createsuperuser            # compte Administrateur
python manage.py runserver                  # http://localhost:8000
cd ../frontend && npm install && npm run dev   # http://localhost:5173 (admin : /admin) ; /api proxifié vers Django
```
Détection d'abandon (hors Docker) : planifier `python manage.py mark_abandoned` toutes les 5 minutes.

## Déploiement Docker
```bash
cp .env.example .env     # remplir secrets et URLs
docker compose up -d --build            # web sur :8080 ; placer un proxy HTTPS devant
docker compose exec backend python manage.py createsuperuser
```
Services : `db`, `backend` (Gunicorn), `scheduler` (abandons toutes les 5 min), `web` (Nginx + React). Sauvegardes : planifier `pg_dump` (non automatisé).

## Tests
`cd backend && DB_ENGINE=sqlite DJANGO_DEBUG=1 python manage.py test` · `cd frontend && npm test`.

## Authentification et rôles
- Admin : session Django (cookie HttpOnly, SameSite=Lax) + CSRF. Aucun jeton en `localStorage`.
- Visiteur : UUID4 de session + jeton de reprise aléatoire (seul son SHA-256 est stocké) envoyé en `X-Session-Token`. Conservé dans `localStorage` pour la reprise (il ne donne accès qu'à son propre formulaire anonyme), supprimé à la soumission. Jeton absent/faux → 404.
- Rôles (groupes, créés par `setup_roles`) : Administrateur (tout + téléchargement PDF des fiches client), Commercial (lecture + statut/notes), Lecture seule. Contrôlés côté backend ; sans rôle = refus.

## Statuts
Questionnaire : `in_progress → abandoned` (inactivité > `ABANDON_AFTER_MINUTES`) · `abandoned → in_progress` (reprise) · `→ submitted` · `abandoned → expired` (après `EXPIRE_AFTER_DAYS`) · `→ invalidated`. `submitted`, `expired`, `invalidated` sont définitifs. L'abandon ne modifie pas `last_activity_at`.
Commercial (sur `Prospect`, distinct) : Nouveau, À contacter, Contacté, En qualification, Qualifié, Non retenu, Converti ; modifications journalisées (`AuditLog`). Un questionnaire terminé n'est jamais automatiquement « Qualifié ».

## Anonyme vs identifié
Le `Prospect` n'est créé qu'à la soumission validée avec consentement (`ConsentRecord` : version du texte, date). Avant, les coordonnées partielles sont de simples réponses techniques, visibles du personnel mais jamais exportées. Aucune IP ni empreinte navigateur ; seuls les UTM sont conservés.

## Statistiques
Période/source filtrent sur la date de début. Complétion = soumis ÷ sessions commencées. Abandon = (abandonnés + expirés) ÷ sessions commencées (les sessions en cours ne sont pas des abandons ; les taux évoluent). Durée moyenne = moyenne (soumission − début) des sessions soumises.

## API `/api/v1/`
Public : `POST sessions/` · `GET sessions/{id}/` · `PUT sessions/{id}/steps/{0-3}/` `{answers, complete}` · `POST sessions/{id}/events/` (seul `step_viewed`) · `POST sessions/{id}/submit/` (idempotent).
Auth : `auth/csrf/`, `auth/login/`, `auth/logout/`, `auth/me/`.
Admin : `admin/stats/` · `admin/sessions/` (filtres `status, step, commercial_status, q, date_from, date_to, utm_source, ordering, page`) · `admin/sessions/{id}/` · `GET admin/sessions/{id}/pdf/` (fiche PDF, administrateurs uniquement, prospects consentis et soumis, journalisé) · `PATCH admin/prospects/{id}/`.

## Préparation CRM
`Prospect.crm_external_id` / `crm_synced_at` existent ; aucune API CRM n'est branchée. À construire plus tard : file d'envoi avec reprises, idempotence (e-mail), journal de synchronisation.

## À fournir / valider avant production
URL vidéos, lien WhatsApp, pages légales, **texte de consentement et mentions validés juridiquement** (obligations ivoiriennes à confirmer par URIEL GROUP), durées de conservation (défauts : abandon 30 min, expiration 30 j), logo officiel, domaine + HTTPS, secrets, comptes/rôles, sauvegardes, règle de suppression.

## Limites connues
Docker et PostgreSQL non exécutés dans l'environnement de développement ; pas de tests de composants React ; questions dupliquées entre `frontend/src/questionnaireSchema.ts` et `backend/apps/questionnaires/schema.py` ; pas de purge automatique au-delà de l'expiration.
