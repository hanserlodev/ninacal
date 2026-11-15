#!/usr/bin/env bash
# Create a temporary GCP VM that runs the NinaCal pipeline from a tarball.
#
# Prerequisites:
#   - gcloud authenticated with a project that has the $300 credit.
#   - A GCS bucket with the pipeline tarball (code + caches + raw data if needed).
#   - The tarball URL must be readable by the VM (public object or signed URL).
#
# Usage:
#   PROJECT=my-project BUCKET=my-bucket PIPELINE_TAR_URL=https://storage.googleapis.com/... \
#     ./deploy/gcp/create-vm.sh
set -euo pipefail

: "${PROJECT:?set PROJECT}"
: "${BUCKET:?set BUCKET (gs://... or bucket name)}"
: "${PIPELINE_TAR_URL:?set PIPELINE_TAR_URL}"

NAME="${NAME:-ninacal-pipeline}"
ZONE="${ZONE:-us-central1-a}"
MACHINE="${MACHINE:-e2-standard-16}"
DISK_GB="${DISK_GB:-250}"
BUCKET="${BUCKET#gs://}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

gcloud compute instances create "$NAME" \
  --project "$PROJECT" \
  --zone "$ZONE" \
  --machine-type "$MACHINE" \
  --image-family ubuntu-2204-lts \
  --image-project ubuntu-os-cloud \
  --boot-disk-size "${DISK_GB}GB" \
  --boot-disk-type pd-ssd \
  --scopes storage-rw \
  --metadata-from-file startup-script="$HERE/startup.sh" \
  --metadata pipeline-tar-url="$PIPELINE_TAR_URL",output-bucket="$BUCKET"

cat <<EOF
VM $NAME created in $ZONE.

Follow the run:
  gcloud compute ssh $NAME --zone $ZONE --project $PROJECT -- tail -f /var/log/ninacal-startup.log

Artifacts will be uploaded to:
  gs://$BUCKET/releases/<timestamp>/
EOF
