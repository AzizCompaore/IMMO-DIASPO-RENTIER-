from django.contrib import admin
from .models import QuestionnaireResponse, QuestionnaireSession

admin.site.register(QuestionnaireSession)
admin.site.register(QuestionnaireResponse)
