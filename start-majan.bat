@echo off
chcp 65001 >nul
setlocal

rem 麻雀トレーナーを起動する
rem このファイルを置いたフォルダ（例: C:\majan）の中にアプリをダウンロードして起動します

set "BASE=%~dp0"
set "APP=%BASE%majan-trainer"
set "REPO=https://github.com/ToooOOmuch/majan-trainer.git"
set "BRANCH=01"

where git >nul 2>nul
if errorlevel 1 (
  echo Git が見つかりません。https://git-scm.com からインストールしてください。
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js が見つかりません。https://nodejs.org から LTS 版をインストールしてください。
  pause
  exit /b 1
)

if not exist "%APP%\.git" (
  echo 初回なので、アプリをダウンロードします...
  git clone -b %BRANCH% %REPO% "%APP%"
  if errorlevel 1 goto error
) else (
  echo 最新版を確認しています...
  git -C "%APP%" pull --ff-only origin %BRANCH%
  if errorlevel 1 echo 最新版を取得できませんでした。今あるバージョンで起動します。
)

cd /d "%APP%"
if errorlevel 1 goto error

echo 必要な部品を準備しています...
call npm install
if errorlevel 1 goto error

echo.
echo ブラウザで麻雀トレーナーが開きます。
echo 終わるときは、この黒い画面を閉じてください。
echo.
call npm run dev -- --open
goto :eof

:error
echo.
echo エラーが起きました。上のメッセージを確認してください。
pause
exit /b 1
