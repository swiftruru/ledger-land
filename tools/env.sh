# LedgerLand 專案隔離環境（09 第 7.5 節）。用法：source tools/env.sh
# 套件、store、快取、Playwright 瀏覽器、wrangler 設定與記錄檔、暫存檔都只寫在 repo 內的 .pnpm-store/ 與 .cache/（兩者已在 .gitignore）。
# 不做全域安裝：pnpm 以 npx 依 package.json 的 packageManager 版本執行；Node 由 pnpm 的 devEngines.runtime 下載到專案內（下方 PATH 會優先使用）。
LL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
export LL_ROOT
export npm_config_cache="$LL_ROOT/.cache/npm"
export npm_config_update_notifier=false
export PNPM_HOME="$LL_ROOT/.cache/pnpm-home"
export pnpm_config_state_dir="$LL_ROOT/.cache/pnpm/state"
export PLAYWRIGHT_BROWSERS_PATH="$LL_ROOT/.cache/ms-playwright"
export XDG_CACHE_HOME="$LL_ROOT/.cache/xdg"
export XDG_STATE_HOME="$LL_ROOT/.cache/xdg-state"
export XDG_CONFIG_HOME="$LL_ROOT/.cache/xdg-config"
export XDG_DATA_HOME="$LL_ROOT/.cache/xdg-data"
export WRANGLER_LOG_PATH="$LL_ROOT/.cache/wrangler-logs"
export WRANGLER_SEND_METRICS=false
export TMPDIR="$LL_ROOT/.cache/tmp/"
# gh 與 git 仍用使用者自己的設定（憑證不放在專案內）
export GH_CONFIG_DIR="${GH_CONFIG_DIR:-$HOME/.config/gh}"
mkdir -p "$npm_config_cache" "$PNPM_HOME" "$pnpm_config_state_dir" "$PLAYWRIGHT_BROWSERS_PATH" "$XDG_CACHE_HOME" "$XDG_STATE_HOME" "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$WRANGLER_LOG_PATH" "$TMPDIR"
# 專案內的 Node（pnpm devEngines.runtime 下載後放在 .cache/node）優先；還沒下載時用系統上任何 22.22 以上的 Node 啟動
for d in $(find "$LL_ROOT/.cache/node" -maxdepth 2 -type d -name bin 2>/dev/null); do
  [ -x "$d/node" ] && export PATH="$d:$PATH"
done
export PATH="$PNPM_HOME:$PATH"
LL_PNPM_VERSION="$(sed -n 's/.*"packageManager": *"pnpm@\([0-9.]*\)".*/\1/p' "$LL_ROOT/package.json" 2>/dev/null)"
export LL_PNPM_VERSION="${LL_PNPM_VERSION:-11.28.5}"
# npx 會用啟動它的 Node 檢查目前目錄 package.json 的 devEngines，而 npm 不認得 onFail: download，
# 所以從 .cache 底下的中立目錄啟動 pnpm，再用 --dir 指回呼叫時的目錄（pnpm 自己會處理 devEngines 並下載 Node）
mkdir -p "$LL_ROOT/.cache/npx-boot"; [ -f "$LL_ROOT/.cache/npx-boot/package.json" ] || printf '{ "name": "ll-npx-boot", "private": true }\n' > "$LL_ROOT/.cache/npx-boot/package.json"
pnpm() { local d="$PWD"; ( cd "$LL_ROOT/.cache/npx-boot" && npx -y "pnpm@$LL_PNPM_VERSION" --dir "$d" "$@" ); }
# 給子程序用的 pnpm 墊片（tools/ 的腳本以 execSync('pnpm ...') 呼叫；shell 函式對子程序不可見）
if [ ! -x "$PNPM_HOME/pnpm" ]; then
  printf '#!/bin/sh\nd="$PWD"\ncd "%s/.cache/npx-boot" && exec npx -y "pnpm@%s" --dir "$d" "$@"\n' "$LL_ROOT" "$LL_PNPM_VERSION" > "$PNPM_HOME/pnpm"
  chmod +x "$PNPM_HOME/pnpm"
fi
