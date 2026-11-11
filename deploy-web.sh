#!/bin/sh
# Builds the gallery and publishes it to Vercel (project "swipefile").
# Live at https://swipefile-psi.vercel.app
set -e
cd "$(dirname "$0")"
npm --prefix web run build
npx -y vercel@65.14.0 deploy web/dist --prod --yes --project swipefile
