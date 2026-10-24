from django.contrib import admin
from .models import AuditLog, ConsentRecord, Prospect

admin.site.register(Prospect)
admin.site.register(ConsentRecord)
admin.site.register(AuditLog)
