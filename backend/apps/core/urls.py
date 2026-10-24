from django.urls import path
from apps.questionnaires import views as q
from . import admin_views as a

urlpatterns = [
    # Public (jeton de session requis sauf création)
    path("sessions/", q.SessionCreate.as_view()),
    path("sessions/<uuid:pk>/", q.SessionDetail.as_view()),
    path("sessions/<uuid:pk>/steps/<int:step>/", q.StepSave.as_view()),
    path("sessions/<uuid:pk>/events/", q.EventCreate.as_view()),
    path("sessions/<uuid:pk>/submit/", q.SessionSubmit.as_view()),
    # Authentification interne
    path("auth/csrf/", a.CsrfView.as_view()),
    path("auth/login/", a.LoginView.as_view()),
    path("auth/logout/", a.LogoutView.as_view()),
    path("auth/me/", a.MeView.as_view()),
    # Administration
    path("admin/stats/", a.StatsView.as_view()),
    path("admin/sessions/", a.SessionList.as_view()),
    path("admin/sessions/<uuid:pk>/", a.SessionDetailAdmin.as_view()),
    path("admin/sessions/<uuid:pk>/pdf/", a.ClientPdfView.as_view()),
    path("admin/prospects/<uuid:pk>/", a.ProspectUpdate.as_view()),
]
