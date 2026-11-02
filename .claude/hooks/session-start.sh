#!/bin/bash
# Claude Code のクラウドセッションで、Node・pnpm・依存関係を用意する
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# .node-version の Node を /opt/node に入れる（入っていれば飛ばす）
node_version=$(tr -d '[:space:]' < .node-version)
node_dir=/opt/node
if [ "$("$node_dir/bin/node" --version 2>/dev/null)" != "v$node_version" ]; then
  archive=$(mktemp)
  curl -fsSL "https://nodejs.org/dist/v$node_version/node-v$node_version-linux-x64.tar.xz" -o "$archive"
  rm -rf "$node_dir"
  mkdir -p "$node_dir"
  tar -xJf "$archive" -C "$node_dir" --strip-components=1
  rm -f "$archive"
fi

# package.json の packageManager の pnpm を入れる（入っていれば飛ばす）
package_manager=$("$node_dir/bin/node" -p 'require("./package.json").packageManager')
if [ "pnpm@$("$node_dir/bin/pnpm" --version 2>/dev/null)" != "$package_manager" ]; then
  "$node_dir/bin/npm" install -g --prefix "$node_dir" "$package_manager"
fi

# コンテナの PATH では /opt/node22/bin が先にあるため、前に足す
export PATH="$node_dir/bin:$PWD/node_modules/.bin:$PATH"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$node_dir/bin:$PWD/node_modules/.bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

# 依存関係を決めるファイルが前回のインストールから変わったときだけ入れ直す
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  # 失敗したときに次回やり直すよう、先に消す
  rm -f "$hashes"
  pnpm install --frozen-lockfile
  sha256sum .claude/hooks/session-start.sh .node-version package.json pnpm-lock.yaml pnpm-workspace.yaml > "$hashes"
fi
