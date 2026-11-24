#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
test -z "$(git status --porcelain)" || { echo "Commit or remove untracked changes before publishing."; exit 1; }
python3 scripts/scan-history.py
gh auth status >/dev/null 2>&1 || gh auth login --web
test "$(gh api user --jq .login)" = itspsr
if ! gh repo view itspsr/limitless-ai >/dev/null 2>&1; then
  gh repo create itspsr/limitless-ai --public --description "Free, open-source AI router. Connect all your AI tools, track limits, auto-switch when one runs out."
fi
test "$(gh repo view itspsr/limitless-ai --json visibility --jq .visibility)" = PUBLIC
gh auth setup-git
git push https://github.com/itspsr/limitless-ai.git main:main
gh repo edit itspsr/limitless-ai --enable-issues --enable-discussions --add-topic llm,ai-router,byok,gemini,groq,openrouter,open-source,nextjs,self-hosted
head_sha=$(git rev-parse HEAD)
for attempt in $(seq 1 20); do
  run_id=$(gh run list --repo itspsr/limitless-ai --workflow CI --commit "$head_sha" --json databaseId --jq '.[0].databaseId // empty')
  if [ -n "$run_id" ]; then exec gh run watch "$run_id" --repo itspsr/limitless-ai --exit-status; fi
  sleep 3
done
echo "No CI run appeared for the pushed commit." >&2
exit 1
