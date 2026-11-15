#!/usr/bin/env bash
# GCP startup script: run the NinaCal pipeline on a temporary VM and upload the
# release artifacts to GCS. Invoked by create-vm.sh through instance metadata.
set -euo pipefail

exec > >(tee -a /var/log/ninacal-startup.log) 2>&1

TAR_URL="$(curl -fsS -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/instance/attributes/pipeline-tar-url')"
BUCKET="$(curl -fsS -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/instance/attributes/output-bucket')"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK=/opt/ninacal-pipeline

echo "== packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl git zstd build-essential

echo "== google cloud sdk"
if ! command -v gcloud >/dev/null; then
  curl -fsSL https://sdk.cloud.google.com | bash -s -- --disable-prompts >/dev/null
fi
export PATH="/root/google-cloud-sdk/bin:$PATH"

echo "== uv + python"
curl -fsSL https://astral.sh/uv/install.sh | sh
export PATH="/root/.local/bin:$PATH"
uv python install 3.12

echo "== pipeline"
mkdir -p "$WORK"
cd "$WORK"
curl -fL "$TAR_URL" -o pipeline.tar.zst
tar --no-same-owner -I zstd -xf pipeline.tar.zst
rm -f pipeline.tar.zst

cd "$WORK"
uv venv --python 3.12 .venv
. .venv/bin/activate
uv pip install -r requirements-v2.txt

echo "== make models export report test verify"
make models export report test verify

echo "== upload"
gcloud storage cp --recursive web/data/v2 "gs://$BUCKET/releases/$STAMP/web/data/v2"
gcloud storage cp data/derived/v2/ninacal.sqlite "gs://$BUCKET/releases/$STAMP/ninacal.sqlite"
gcloud storage cp /var/log/ninacal-startup.log "gs://$BUCKET/releases/$STAMP/startup.log"

echo "== done $STAMP"
# Stop the VM so only the disk keeps billing.
shutdown -h +1 || true
