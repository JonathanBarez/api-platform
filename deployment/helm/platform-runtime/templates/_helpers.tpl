{{- define "platform-runtime.name" -}}
{{- printf "%s-runtime" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "platform-runtime.labels" -}}
app.kubernetes.io/name: platform-runtime
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: api-platform
platform.environment: {{ .Values.environment | quote }}
{{- end -}}

{{- define "platform-runtime.selector" -}}
app.kubernetes.io/name: platform-runtime
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "platform-runtime.secretName" -}}
{{- if .Values.secret.create -}}
{{- printf "%s-secret" (include "platform-runtime.name" .) -}}
{{- else -}}
{{- required "secret.existingName is required when secret.create=false" .Values.secret.existingName -}}
{{- end -}}
{{- end -}}
