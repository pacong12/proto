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
fi
