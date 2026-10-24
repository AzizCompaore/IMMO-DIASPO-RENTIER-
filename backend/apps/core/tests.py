from datetime import timedelta
from django.contrib.auth.models import Group, User
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.prospects.models import AuditLog, Prospect
from apps.questionnaires import services
from apps.questionnaires.models import QuestionnaireSession, SessionStatus
from apps.tracking.models import TrackingEvent

S0 = {"country": "France", "employment": "CDI de 3 ans ou plus", "family": "Marié(e)", "housing": "Locataire"}
S1 = {"income": "Plus de 6 000 €", "savings": "Plus de 30 000 €"}
S2 = {"budget": "De 150 000 € à 250 000 €", "deposit": "Plus de 60 000 €", "horizon": "De 3 à 6 mois"}
S3 = {"first": "Awa", "last": "Koné", "whatsapp": "+33 6 00 00 00 00", "email": "Awa@Exemple.com", "consent": True}
STEPS = [S0, S1, S2, S3]


class Base(TestCase):
    def setUp(self):
        cache.clear()
        self.c = APIClient()
        for r in ("Administrateur", "Commercial", "Lecture seule"):
            Group.objects.create(name=r)

    def start(self, **utm):
        r = self.c.post("/api/v1/sessions/", utm, format="json")
        self.assertEqual(r.status_code, 201)
        return r.data["id"], {"HTTP_X_SESSION_TOKEN": r.data["token"]}

    def save(self, sid, h, step, answers, complete=True):
        return self.c.put(f"/api/v1/sessions/{sid}/steps/{step}/", {"answers": answers, "complete": complete}, format="json", **h)

    def fill(self, sid, h, upto=3):
        for i in range(upto + 1):
            self.assertEqual(self.save(sid, h, i, STEPS[i]).status_code, 200)

    def user(self, name, role=None, superuser=False):
        u = User.objects.create_user(name, password="x" * 14, is_superuser=superuser)
        if role:
            u.groups.add(Group.objects.get(name=role))
        return u

    def as_user(self, u):
        c = APIClient()
        c.force_login(u)
        return c


class PublicFunnelTests(Base):
    def test_init_session_is_anonymous_with_unpredictable_token(self):
        sid, h = self.start(utm_source="facebook")
        s = QuestionnaireSession.objects.get(pk=sid)
        self.assertEqual((s.status, s.current_step, s.last_completed_step, s.utm_source), ("in_progress", 0, -1, "facebook"))
        self.assertIsNone(s.prospect)
        self.assertNotIn(h["HTTP_X_SESSION_TOKEN"], s.token_hash)
        self.assertTrue(TrackingEvent.objects.filter(session=s, type="session_started").exists())

    def test_progressive_save_is_idempotent_and_resumable(self):
        sid, h = self.start()
        self.save(sid, h, 0, S0, complete=False)
        self.save(sid, h, 0, S0, complete=False)
        self.assertEqual(QuestionnaireSession.objects.count(), 1)
        self.assertEqual(QuestionnaireSession.objects.get(pk=sid).responses.count(), 4)
        r = self.c.get(f"/api/v1/sessions/{sid}/", **h)
        self.assertEqual(r.data["answers"]["country"], "France")
        self.save(sid, h, 0, S0)
        self.assertEqual(self.c.get(f"/api/v1/sessions/{sid}/", **h).data["last_completed_step"], 0)

    def test_session_confidentiality_between_sessions(self):
        a, ha = self.start()
        b, hb = self.start()
        self.assertEqual(self.c.get(f"/api/v1/sessions/{a}/", **hb).status_code, 404)
        self.assertEqual(self.c.get(f"/api/v1/sessions/{a}/").status_code, 404)
        self.assertEqual(self.save(a, hb, 0, S0).status_code, 404)

    def test_step_order_enforced_server_side(self):
        sid, h = self.start()
        r = self.save(sid, h, 2, S2)
        self.assertEqual(r.status_code, 400)

    def test_validation_errors_and_no_false_success(self):
        sid, h = self.start()
        r = self.save(sid, h, 0, {**S0, "country": "Atlantide"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("country", r.data["errors"])
        self.assertEqual(QuestionnaireSession.objects.get(pk=sid).last_completed_step, -1)
        r = self.save(sid, h, 0, {**S0, "country": "Autre"})
        self.assertIn("otherCountry", r.data["errors"])
        self.fill(sid, h, 2)
        r = self.save(sid, h, 3, {**S3, "consent": False})
        self.assertEqual(r.status_code, 400)
        r = self.save(sid, h, 3, {**S3, "email": "pas-un-email"})
        self.assertIn("email", r.data["errors"])

    def test_submit_requires_complete_and_consent_then_creates_prospect(self):
        sid, h = self.start()
        self.fill(sid, h, 2)
        self.assertEqual(self.c.post(f"/api/v1/sessions/{sid}/submit/", **h).status_code, 400)
        self.assertEqual(Prospect.objects.count(), 0)
        self.save(sid, h, 3, S3)
        r = self.c.post(f"/api/v1/sessions/{sid}/submit/", **h)
        self.assertEqual((r.status_code, r.data["status"]), (200, "submitted"))
        p = Prospect.objects.get()
        self.assertEqual((p.email, p.phone, p.commercial_status), ("awa@exemple.com", "+33600000000", "new"))
        self.assertEqual(p.consents.count(), 1)
        self.assertEqual(self.c.post(f"/api/v1/sessions/{sid}/submit/", **h).status_code, 200)  # idempotent
        self.assertEqual((Prospect.objects.count(), p.consents.count()), (1, 1))
        self.assertEqual(self.save(sid, h, 0, S0).status_code, 409)

    def test_partial_contact_does_not_create_prospect(self):
        sid, h = self.start()
        self.fill(sid, h, 2)
        self.save(sid, h, 3, {"email": "a@b.co", "consent": False}, complete=False)
        self.assertEqual(Prospect.objects.count(), 0)

    def test_client_cannot_forge_server_events(self):
        sid, h = self.start()
        r = self.c.post(f"/api/v1/sessions/{sid}/events/", {"type": "session_submitted", "step": 3}, format="json", **h)
        self.assertEqual(r.status_code, 400)
        r = self.c.post(f"/api/v1/sessions/{sid}/events/", {"type": "step_viewed", "step": 1}, format="json", **h)
        self.assertEqual(r.status_code, 204)

    def test_session_creation_is_throttled(self):
        for _ in range(20):
            self.c.post("/api/v1/sessions/", {}, format="json")
        self.assertEqual(self.c.post("/api/v1/sessions/", {}, format="json").status_code, 429)


class AbandonmentTests(Base):
    def test_abandon_after_configured_inactivity_only(self):
        sid, h = self.start()
        self.save(sid, h, 0, S0)
        s = QuestionnaireSession.objects.get(pk=sid)
        self.assertEqual(services.mark_abandoned(), 0)  # actif : pas abandonné
        QuestionnaireSession.objects.filter(pk=sid).update(last_activity_at=timezone.now() - timedelta(minutes=31))
        self.assertEqual(services.mark_abandoned(), 1)
        s.refresh_from_db()
        self.assertEqual((s.status, s.current_step, s.last_completed_step), ("abandoned", 1, 0))
        self.assertTrue(TrackingEvent.objects.filter(session=s, type="session_abandoned").exists())
        self.assertEqual(services.mark_abandoned(), 0)  # pas de doublon d'événement

    def test_custom_threshold(self):
        sid, h = self.start()
        QuestionnaireSession.objects.filter(pk=sid).update(last_activity_at=timezone.now() - timedelta(minutes=5))
        self.assertEqual(services.mark_abandoned(minutes=10), 0)
        self.assertEqual(services.mark_abandoned(minutes=3), 1)

    def test_submitted_session_never_becomes_abandoned(self):
        sid, h = self.start()
        self.fill(sid, h)
        self.c.post(f"/api/v1/sessions/{sid}/submit/", **h)
        QuestionnaireSession.objects.filter(pk=sid).update(last_activity_at=timezone.now() - timedelta(days=90))
        services.mark_abandoned()
        services.expire_old()
        self.assertEqual(QuestionnaireSession.objects.get(pk=sid).status, "submitted")
        with self.assertRaises(ValueError):
            QuestionnaireSession.objects.get(pk=sid).transition(SessionStatus.ABANDONED)

    def test_abandoned_session_can_resume_then_expire_later(self):
        sid, h = self.start()
        self.save(sid, h, 0, S0)
        QuestionnaireSession.objects.filter(pk=sid).update(last_activity_at=timezone.now() - timedelta(hours=2))
        services.mark_abandoned()
        r = self.save(sid, h, 1, S1)
        self.assertEqual(r.data["status"], "in_progress")
        self.assertTrue(TrackingEvent.objects.filter(session_id=sid, type="session_resumed").exists())
        services.mark_abandoned(minutes=0)
        QuestionnaireSession.objects.filter(pk=sid).update(last_activity_at=timezone.now() - timedelta(days=31))
        self.assertEqual(services.expire_old(), 1)
        self.assertEqual(self.save(sid, h, 2, S2).status_code, 409)


class AdminApiTests(Base):
    def setUp(self):
        super().setUp()
        self.admin = self.user("boss", "Administrateur")
        self.sales = self.user("sales", "Commercial")
        self.ro = self.user("ro", "Lecture seule")
        self.norole = self.user("nobody")
        # 1 soumise, 1 abandonnée à l'étape 2, 1 anonyme en cours
        a, ha = self.start(utm_source="fb")
        self.fill(a, ha)
        self.c.post(f"/api/v1/sessions/{a}/submit/", **ha)
        b, hb = self.start(utm_source="fb")
        self.save(b, hb, 0, S0)
        self.save(b, hb, 1, S1)
        self.save(b, hb, 2, {"budget": S2["budget"]}, complete=False)
        QuestionnaireSession.objects.filter(pk=b).update(last_activity_at=timezone.now() - timedelta(hours=1))
        services.mark_abandoned()
        self.sid_done, self.sid_ab = a, b
        self.sid_anon, _ = self.start()

    def test_endpoints_require_authentication_and_a_role(self):
        for url in ("stats/", "sessions/", f"sessions/{self.sid_done}/",
                    f"sessions/{self.sid_done}/pdf/"):
            self.assertEqual(self.c.get(f"/api/v1/admin/{url}").status_code, 403, url)
            self.assertEqual(self.as_user(self.norole).get(f"/api/v1/admin/{url}").status_code, 403, url)

    def test_stats_come_from_real_data(self):
        d = self.as_user(self.ro).get("/api/v1/admin/stats/").data
        self.assertEqual((d["total_started"], d["submitted"], d["abandoned"], d["in_progress"]), (3, 1, 1, 1))
        self.assertEqual(d["completion_rate"], 33.3)
        self.assertEqual(d["abandonment_rate"], 33.3)
        self.assertEqual(d["dropoff_by_step"][2], 1)
        self.assertIsNotNone(d["avg_completion_seconds"])
        self.assertEqual(self.as_user(self.ro).get("/api/v1/admin/stats/?utm_source=fb").data["total_started"], 2)

    def test_list_filters_search_sort_pagination(self):
        c = self.as_user(self.sales)
        r = c.get("/api/v1/admin/sessions/").data
        self.assertEqual(r["count"], 3)
        self.assertEqual(c.get("/api/v1/admin/sessions/?status=abandoned").data["count"], 1)
        self.assertEqual(c.get("/api/v1/admin/sessions/?step=2&status=abandoned").data["results"][0]["id"], self.sid_ab)
        self.assertEqual(c.get("/api/v1/admin/sessions/?q=awa").data["count"], 1)
        self.assertEqual(c.get("/api/v1/admin/sessions/?page_size=1").data["count"], 3)
        self.assertEqual(len(c.get("/api/v1/admin/sessions/?page_size=1").data["results"]), 1)
        anon = [x for x in r["results"] if x["id"] == self.sid_anon][0]
        self.assertFalse(anon["identified"])
        self.assertIsNone(anon["email"])

    def test_detail_shows_answers_missing_fields_and_timeline_from_real_events(self):
        d = self.as_user(self.ro).get(f"/api/v1/admin/sessions/{self.sid_ab}/").data
        self.assertEqual(d["answers"]["income"], "Plus de 6 000 €")
        fields = {m["field"] for m in d["missing_fields"]}
        self.assertTrue({"first", "email", "consent", "deposit"} <= fields)
        types = [e["type"] for e in d["timeline"]]
        self.assertEqual((types[0], types[-1]), ("session_started", "session_abandoned"))
        self.assertIn("step_completed", types)
        self.assertIsNone(d["prospect"])

    def test_commercial_status_permissions_and_audit(self):
        pid = self.as_user(self.ro).get(f"/api/v1/admin/sessions/{self.sid_done}/").data["prospect"]["id"]
        url = f"/api/v1/admin/prospects/{pid}/"
        self.assertEqual(self.as_user(self.ro).patch(url, {"commercial_status": "qualified"}, format="json").status_code, 403)
        self.assertEqual(self.as_user(self.sales).patch(url, {"commercial_status": "nope"}, format="json").status_code, 400)
        self.assertEqual(self.as_user(self.sales).patch(url, {"commercial_status": "to_contact", "internal_notes": "x"}, format="json").status_code, 200)
        p = Prospect.objects.get(pk=pid)
        self.assertEqual(p.commercial_status, "to_contact")
        self.assertEqual(AuditLog.objects.filter(prospect=p, action="commercial_status", old_value="new", new_value="to_contact").count(), 1)
        self.assertEqual(QuestionnaireSession.objects.get(pk=self.sid_done).status, "submitted")  # statuts distincts

    def test_client_pdf_is_admin_only_and_contains_only_submitted_prospects(self):
        url = f"/api/v1/admin/sessions/{self.sid_done}/pdf/"
        self.assertEqual(self.as_user(self.sales).get(url).status_code, 403)
        self.assertEqual(self.as_user(self.ro).get(url).status_code, 403)
        admin = self.as_user(self.admin)
        response = admin.get(url, HTTP_ACCEPT="application/pdf")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn(".pdf", response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"%PDF-"))
        prospect = QuestionnaireSession.objects.get(pk=self.sid_done).prospect
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertTrue(AuditLog.objects.filter(action="export_pdf", prospect=prospect,
                                                new_value=str(self.sid_done)).exists())
        self.assertEqual(admin.get(f"/api/v1/admin/sessions/{self.sid_ab}/pdf/").status_code, 404)
        self.assertEqual(admin.get(f"/api/v1/admin/sessions/{self.sid_anon}/pdf/").status_code, 404)
        prospect.consents.update(withdrawn_at=timezone.now())
        self.assertEqual(admin.get(url).status_code, 404)
        self.assertEqual(admin.get("/api/v1/admin/export/").status_code, 404)

    def test_login_logout_and_me(self):
        User.objects.create_user("jane", password="correct-horse-battery").groups.add(Group.objects.get(name="Commercial"))
        c = APIClient()
        self.assertEqual(c.post("/api/v1/auth/login/", {"username": "jane", "password": "bad"}, format="json").status_code, 400)
        self.assertEqual(c.post("/api/v1/auth/login/", {"username": "nobody", "password": "x" * 14}, format="json").status_code, 400)
        self.assertEqual(c.post("/api/v1/auth/login/", {"username": "jane", "password": "correct-horse-battery"}, format="json").data["role"], "Commercial")
        self.assertEqual(c.get("/api/v1/auth/me/").status_code, 200)
        c.post("/api/v1/auth/logout/")
        self.assertEqual(c.get("/api/v1/auth/me/").status_code, 403)
