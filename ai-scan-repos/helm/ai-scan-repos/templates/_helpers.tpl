{{- define "ais.labels" -}}
app.kubernetes.io/part-of: ai-scan-repos
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}

{{- define "ais.image" -}}
{{- $root := index . 0 -}}{{- $name := index . 1 -}}
{{- with $root.Values.image -}}
{{- if .registry }}{{ .registry }}/{{ end }}{{ .repositoryPrefix }}/{{ $name }}:{{ .tag }}
{{- end -}}
{{- end }}

{{- define "ais.podSecurity" -}}
runAsNonRoot: true
runAsUser: {{ .uid }}
runAsGroup: {{ .uid }}
fsGroup: {{ .uid }}
seccompProfile:
  type: RuntimeDefault
{{- end }}

{{- define "ais.containerSecurity" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
runAsNonRoot: true
runAsUser: {{ .uid }}
capabilities:
  drop: ["ALL"]
{{- end }}

{{- define "ais.pullSecrets" -}}
{{- with .Values.imagePullSecrets }}
imagePullSecrets:
{{ toYaml . }}
{{- end }}
{{- end }}
