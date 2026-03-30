#!/bin/bash
cp /home/jas/src/quartz/quartz.config.local.ts /home/jas/src/quartz/quartz.config.ts
npx quartz build --serve --remoteDevHost 192.168.1.45
