from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
import reportlab
from django.contrib.auth import authenticate, login, logout
from django.db.models import Q
from django.http import HttpResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.renderers import BaseRenderer
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.prospects.models import AuditLog, CommercialStatus, Prospect
from apps.questionnaires import services
from apps.questionnaires.models import QuestionnaireSession, SessionStatus
from apps.questionnaires.schema import ALL_FIELDS, REQUIRED_BY_STEP, STEP_LABELS
from apps.tracking.stats import build_stats, filter_sessions
from .permissions import AdminOnly, StaffRolePermission
from .roles import role_of


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        user = authenticate(request, username=request.data.get("username", ""), password=request.data.get("password", ""))
        if user is None or role_of(user) is None:  # message identique : pas d'indice sur l'existence du compte
            return Response({"detail": "Identifiants invalides."}, status=status.HTTP_400_BAD_REQUEST)
        login(request, user)
        return Response({"username": user.get_username(), "role": role_of(user)})


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=204)


class MeView(APIView):
    def get(self, request):
        role = role_of(request.user)
        if role is None:
            return Response({"detail": "Accès refusé."}, status=403)
        return Response({"username": request.user.get_username(), "role": role})


class StaffView(APIView):
    permission_classes = [IsAuthenticated, StaffRolePermission]


class StatsView(StaffView):
    def get(self, request):
        return Response(build_stats(request.query_params))


def contact_of(session):
    """Nom/e-mail/tél. Prospect consenti si disponible ; sinon valeurs partielles saisies (jamais exportées)."""
    p = session.prospect
    if p:
        return {"name": p.full_name, "email": p.email, "phone": p.phone}
    a = {r.field: r.value for r in session.responses.all() if r.field in ("first", "last", "email", "whatsapp")}
    name = f"{a.get('first', '')} {a.get('last', '')}".strip()
    return {"name": name or None, "email": a.get("email") or None, "phone": a.get("whatsapp") or None}


def row(session):
    c = contact_of(session)
    p = session.prospect
    return {"id": str(session.id), "identified": bool(p or c["email"] or c["phone"]), **c,
            "prospect_id": str(p.id) if p else None, "started_at": session.started_at,
            "last_activity_at": session.last_activity_at, "current_step": session.current_step,
            "current_step_label": STEP_LABELS[session.current_step], "last_completed_step": session.last_completed_step,
            "progress_percent": session.progress_percent, "status": session.status,
            "commercial_status": p.commercial_status if p else None, "submitted_at": session.submitted_at,
            "utm_source": session.utm_source}


class Pager(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 100


ORDERINGS = {"started_at", "last_activity_at", "current_step", "progress", "status", "submitted_at"}


class SessionList(StaffView):
    def get(self, request):
        p = request.query_params
        qs = filter_sessions(QuestionnaireSession.objects.select_related("prospect").prefetch_related("responses"), p)
        if p.get("status") in SessionStatus.values:
            qs = qs.filter(status=p["status"])
        if p.get("step", "").isdigit():
            qs = qs.filter(current_step=int(p["step"]))
        if p.get("commercial_status") in CommercialStatus.values:
            qs = qs.filter(prospect__commercial_status=p["commercial_status"])
        q = (p.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(prospect__first_name__icontains=q) | Q(prospect__last_name__icontains=q) |
                           Q(prospect__email__icontains=q) | Q(prospect__phone__icontains=q) | Q(id__startswith=q.lower()))
        o = p.get("ordering", "-last_activity_at")
        field = o.lstrip("-")
        if field in ORDERINGS:
            qs = qs.order_by(("-" if o.startswith("-") else "") + ("last_completed_step" if field == "progress" else field))
        pager = Pager()
        page = pager.paginate_queryset(qs, request)
        return pager.get_paginated_response([row(s) for s in page])


def detail_payload(session):
    answers = services.answers_of(session)
    missing = [{"step": i, "step_label": STEP_LABELS[i], "field": f} for i, fs in REQUIRED_BY_STEP.items()
               for f in fs if answers.get(f) in (None, "", False)]
    p = session.prospect
    return {**row(session), "answers": answers, "missing_fields": missing,
            "utm": {k: getattr(session, k) for k in services.UTM_FIELDS},
            "prospect": {"id": str(p.id), "commercial_status": p.commercial_status, "internal_notes": p.internal_notes,
                         "crm_external_id": p.crm_external_id,
                         "consents": [{"purpose": c.purpose, "text_version": c.text_version, "given_at": c.given_at,
                                       "withdrawn_at": c.withdrawn_at} for c in p.consents.all()]} if p else None,
            "timeline": [{"type": e.type, "label": e.get_type_display(), "step": e.step, "at": e.created_at}
                         for e in session.events.all()]}


class SessionDetailAdmin(StaffView):
    def get(self, request, pk):
        s = get_object_or_404(QuestionnaireSession.objects.select_related("prospect"), pk=pk)
        return Response(detail_payload(s))


class ProspectUpdate(StaffView):
    def patch(self, request, pk):
        prospect = get_object_or_404(Prospect, pk=pk)
        new_status, notes = request.data.get("commercial_status"), request.data.get("internal_notes")
        if new_status is not None:
            if new_status not in CommercialStatus.values:
                return Response({"detail": "Statut commercial inconnu."}, status=400)
            if new_status != prospect.commercial_status:
                AuditLog.objects.create(user=request.user, action="commercial_status", prospect=prospect, field="commercial_status",
                                        old_value=prospect.commercial_status, new_value=new_status)
                prospect.commercial_status = new_status
        if notes is not None:
            if not isinstance(notes, str) or len(notes) > 5000:
                return Response({"detail": "Notes invalides."}, status=400)
            if notes != prospect.internal_notes:
                AuditLog.objects.create(user=request.user, action="notes", prospect=prospect, field="internal_notes")  # contenu non journalisé
                prospect.internal_notes = notes
        prospect.save()
        return Response({"commercial_status": prospect.commercial_status, "internal_notes": prospect.internal_notes})


FIELD_LABELS = {
    "country": "Pays de résidence", "otherCountry": "Autre pays", "employment": "Situation professionnelle",
    "family": "Situation familiale", "housing": "Logement", "income": "Revenus mensuels nets",
    "savings": "Épargne", "budget": "Budget immobilier", "deposit": "Apport",
    "horizon": "Délai d'acquisition", "first": "Prénom", "last": "Nom",
    "whatsapp": "Téléphone WhatsApp", "email": "E-mail",
}
CLIENT_FIELDS = ("first", "last", "email", "whatsapp")


def _pdf_paragraph(value, style):
    text = escape(str(value)).replace("\n", "<br/>") or "—"
    return Paragraph(text, style)


def _client_pdf(session):
    prospect = session.prospect
    font_path = Path(reportlab.__file__).parent / "fonts" / "Vera.ttf"
    if "Vera" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("Vera", str(font_path)))
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="PdfTitle", parent=styles["Title"], fontName="Vera", fontSize=18, leading=23,
                              textColor=colors.HexColor("#143b32"), alignment=TA_CENTER, spaceAfter=5 * mm))
    styles.add(ParagraphStyle(name="PdfHeading", parent=styles["Heading2"], fontName="Vera", fontSize=12, leading=16,
                              textColor=colors.HexColor("#143b32"), spaceBefore=4 * mm, spaceAfter=2 * mm))
    styles.add(ParagraphStyle(name="PdfBody", parent=styles["BodyText"], fontName="Vera", fontSize=9, leading=13))
    styles.add(ParagraphStyle(name="PdfLabel", parent=styles["BodyText"], fontName="Vera", fontSize=9, leading=13,
                              textColor=colors.HexColor("#42534d")))
    styles.add(ParagraphStyle(name="PdfSmall", parent=styles["BodyText"], fontName="Vera", fontSize=8, leading=11,
                              textColor=colors.HexColor("#68736f")))
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
                                 topMargin=17 * mm, bottomMargin=17 * mm,
                                 title=f"Fiche client - {prospect.full_name}", author="URIEL GROUP")
    body = styles["PdfBody"]
    label = styles["PdfLabel"]

    def data_table(rows):
        table = Table([[_pdf_paragraph(k, label), _pdf_paragraph(v, body)] for k, v in rows],
                      colWidths=[48 * mm, 126 * mm], hAlign="LEFT")
        table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f3")),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#dce4e0")),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        return table

    body_flow = [
        Paragraph("Fiche client", styles["PdfTitle"]),
        _pdf_paragraph(f"Document généré le {timezone.localtime().strftime('%d/%m/%Y à %H:%M')}", styles["PdfSmall"]),
        Spacer(1, 3 * mm),
        Paragraph("Coordonnées", styles["PdfHeading"]),
        data_table([
            ("Nom complet", prospect.full_name),
            ("E-mail", prospect.email),
            ("Téléphone WhatsApp", prospect.phone),
            ("Statut commercial", prospect.get_commercial_status_display()),
        ]),
        Paragraph("Informations du projet", styles["PdfHeading"]),
    ]
    answers = services.answers_of(session)
    body_flow.append(data_table([
        (FIELD_LABELS[field], "Oui" if answers[field] is True else "Non" if answers[field] is False else answers[field])
        for field in ALL_FIELDS if field not in CLIENT_FIELDS and field != "consent" and answers.get(field) not in (None, "")
    ] or [("Réponses", "Aucune réponse enregistrée.")]))
    body_flow.extend([
        Paragraph("Suivi de la session", styles["PdfHeading"]),
        data_table([
            ("Identifiant de session", session.id),
            ("Statut du questionnaire", session.get_status_display()),
            ("Début", timezone.localtime(session.started_at).strftime("%d/%m/%Y à %H:%M")),
            ("Dernière activité", timezone.localtime(session.last_activity_at).strftime("%d/%m/%Y à %H:%M")),
            ("Soumis le", timezone.localtime(session.submitted_at).strftime("%d/%m/%Y à %H:%M") if session.submitted_at else "—"),
        ]),
        Paragraph("Consentement", styles["PdfHeading"]),
    ])
    consents = list(prospect.consents.all())
    body_flow.append(data_table([
        (f"{consent.purpose} — texte {consent.text_version}",
         f"Accordé le {timezone.localtime(consent.given_at).strftime('%d/%m/%Y à %H:%M')}"
         + (f" · retiré le {timezone.localtime(consent.withdrawn_at).strftime('%d/%m/%Y à %H:%M')}" if consent.withdrawn_at else ""))
        for consent in consents
    ] or [("Consentement", "Aucun consentement enregistré.")]))
    if prospect.internal_notes:
        body_flow.extend([
            Paragraph("Notes internes", styles["PdfHeading"]),
            _pdf_paragraph(prospect.internal_notes, body),
        ])

    def footer(canvas, _document):
        canvas.saveState()
        canvas.setFont("Vera", 8)
        canvas.setFillColor(colors.HexColor("#68736f"))
        canvas.drawString(18 * mm, 10 * mm, "URIEL GROUP — Informations confidentielles")
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {_document.page}")
        canvas.restoreState()

    document.build(body_flow, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


class PdfRenderer(BaseRenderer):
    media_type = "application/pdf"
    format = "pdf"
    charset = None

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class ClientPdfView(APIView):
    """Téléchargement PDF d'un prospect consenti, réservé aux administrateurs et journalisé."""
    permission_classes = [IsAuthenticated, AdminOnly]
    renderer_classes = [PdfRenderer]

    def get(self, request, pk):
        session = get_object_or_404(
            QuestionnaireSession.objects.filter(prospect__isnull=False, status=SessionStatus.SUBMITTED)
            .filter(prospect__consents__withdrawn_at__isnull=True).distinct()
            .select_related("prospect").prefetch_related("responses", "prospect__consents"),
            pk=pk,
        )
        response = HttpResponse(_client_pdf(session), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="client-{session.prospect_id}.pdf"'
        response["Cache-Control"] = "private, no-store"
        AuditLog.objects.create(user=request.user, action="export_pdf", prospect=session.prospect,
                                new_value=str(session.id))
        return response
