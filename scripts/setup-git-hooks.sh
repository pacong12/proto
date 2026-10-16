#!/bin/sh
set -e

HOOK_DIR="$(git rev-parse --git-dir)/hooks"
HOOK_FILE="$HOOK_DIR/commit-msg"

if [ -d "$HOOK_DIR" ]; then
  cat <<'EOF' > "$HOOK_FILE"
#!/bin/sh
# Proto Atomic & Conventional Commit Guard
# Validates commit messages with commitlint before commit is finalized

if [ -z "$1" ]; then
  exit 0
fi

bunx commitlint --edit "$1"
EOF
  chmod +x "$HOOK_FILE"
  echo "Git commit-msg hook installed successfully."

  # DEVOPS-08: block committed secrets. Uses gitleaks when installed, otherwise a minimal check
  # for .env files and hex private keys in the staged diff.
  cat <<'HOOK' > "$HOOK_DIR/pre-commit"
#!/bin/sh
# Proto secret guard

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks protect --staged --redact --no-banner || exit 1
fi

ENV_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '(^|/)\.env(\.[^/]*)?$' | grep -vE '\.env\.example$')
if [ -n "$ENV_FILES" ]; then
  echo "pre-commit: refusing to commit environment files:" >&2
  echo "$ENV_FILES" >&2
  exit 1
fi

if git diff --cached -U0 --diff-filter=ACM | grep -E '^\+' \
  | grep -iqE '(private_?key|secret|mnemonic)[^=:]*[=:][[:space:]]*["'\'']?(0x)?[0-9a-fA-F]{64}'; then
  echo "pre-commit: staged changes look like they contain a private key." >&2
  echo "Move it to an untracked .env file (git commit --no-verify only for test fixtures)." >&2
  exit 1
fi
HOOK
  chmod +x "$HOOK_DIR/pre-commit"
  echo "Git pre-commit secret guard installed successfully."
fi
