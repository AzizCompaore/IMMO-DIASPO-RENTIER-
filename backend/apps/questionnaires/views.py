from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.http import Http404

from apps.tracking.models import CLIENT_EVENT_TYPES, EventType
from . import services
from .models import QuestionnaireSession, SessionStatus
from .schema import STEP_LABELS, TOTAL_STEPS


def session_payload(session):
    return {"id": str(session.id), "status": session.status, "current_step": session.current_step,
            "last_completed_step": session.last_completed_step, "progress_percent": session.progress_percent,
            "answers": services.answers_of(session)}


class PublicBase(APIView):
    """Endpoints publics : aucune authentification, mais le jeton de reprise de la session est exigé.
    Un jeton absent ou faux renvoie 404 (pas d'énumération de sessions)."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_write"

    def get_session(self, pk):
        session = get_object_or_404(QuestionnaireSession, pk=pk)
        if not session.check_token(self.request.headers.get("X-Session-Token", "")):
            raise Http404
        return session

    def fail(self, e):
        return Response({"detail": e.message, "errors": e.errors}, status=e.status)


class SessionCreate(PublicBase):
    throttle_scope = "session_create"

    def post(self, request):
        utm = {k: request.data.get(k, "") for k in services.UTM_FIELDS if isinstance(request.data.get(k, ""), str)}
        session, token = services.create_session(utm)
        return Response({**session_payload(session), "token": token}, status=status.HTTP_201_CREATED)


class SessionDetail(PublicBase):
    def get(self, request, pk):
        session = self.get_session(pk)
        if session.status in (SessionStatus.SUBMITTED, SessionStatus.EXPIRED, SessionStatus.INVALIDATED):
            return Response({"id": str(session.id), "status": session.status}, status=status.HTTP_409_CONFLICT)
        return Response(session_payload(session))


class StepSave(PublicBase):
    def put(self, request, pk, step):
        session = self.get_session(pk)
        data = request.data.get("answers", {})
        if not isinstance(data, dict):
            return Response({"detail": "Format invalide."}, status=400)
        try:
            session = services.save_step(session, step, data, bool(request.data.get("complete", False)))
        except services.ServiceError as e:
            return self.fail(e)
        return Response(session_payload(session))


class EventCreate(PublicBase):
    def post(self, request, pk):
        session = self.get_session(pk)
        type_ = request.data.get("type")
        step = request.data.get("step")
        if type_ not in CLIENT_EVENT_TYPES or not isinstance(step, int) or not 0 <= step < TOTAL_STEPS:
            return Response({"detail": "Événement non autorisé."}, status=400)
        if session.status in (SessionStatus.IN_PROGRESS, SessionStatus.ABANDONED):
            services.log_event(session, EventType(type_), step)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionSubmit(PublicBase):
    def post(self, request, pk):
        session = self.get_session(pk)
        try:
            session = services.submit(session)
        except services.ServiceError as e:
            return self.fail(e)
        return Response({"id": str(session.id), "status": session.status, "submitted_at": session.submitted_at})
