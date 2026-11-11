#!/bin/sh
# Builds the gallery and publishes it to Vercel (project "swipefile").
# Live at https://swipefile-psi.vercel.app
# web/vercel/ adds the daily keep-alive function and its cron schedule.
set -e
cd "$(dirname "$0")"
npm --prefix web run build
cp -R web/vercel/. web/dist/
npx -y vercel@65.14.0 deploy web/dist --prod --yes --project swipefile
