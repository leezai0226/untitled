17:42:06.205 Running build in Washington, D.C., USA (East) – iad1
17:42:06.205 Build machine configuration: 2 cores, 8 GB
17:42:06.324 Cloning github.com/leezai0226/untitled (Branch: main, Commit: 3632f9b)
17:42:06.656 Cloning completed: 331.000ms
17:42:07.307 Restored build cache from previous deployment (3EwKxfLAQ4Y47VWVer7CTytswA7w)
17:42:07.569 Running "vercel build"
17:42:08.182 Vercel CLI 50.38.2
17:42:08.436 Installing dependencies...
17:42:10.007 
17:42:10.008 added 7 packages in 1s
17:42:10.008 
17:42:10.009 157 packages are looking for funding
17:42:10.009   run `npm fund` for details
17:42:10.036 Detected Next.js version: 16.1.7
17:42:10.040 Running "npm run build"
17:42:10.141 
17:42:10.141 > premiere-class@0.1.0 build
17:42:10.142 > next build
17:42:10.142 
17:42:11.170 ▲ Next.js 16.1.7 (Turbopack)
17:42:11.171 
17:42:11.178 ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
17:42:11.212   Creating an optimized production build ...
17:42:24.010 ✓ Compiled successfully in 12.2s
17:42:24.014   Running TypeScript ...
17:42:30.165 Failed to compile.
17:42:30.165 
17:42:30.166 ./src/app/api/portone/verify/route.ts:356:36
17:42:30.166 Type error: Property 'items' does not exist on type '{ items: string[]; orderType: "shop" | "class"; customerName: string; customerEmail: string; customerPhone: string; totalAmount: number; paymentMethod: string; } | { className: string; schedule: string; ... 5 more ...; paymentMethod: string; }'.
17:42:30.166   Property 'items' does not exist on type '{ className: string; schedule: string; orderType: "shop" | "class"; customerName: string; customerEmail: string; customerPhone: string; totalAmount: number; paymentMethod: string; }'.
17:42:30.166 
17:42:30.166 [0m [90m 354 |[39m
17:42:30.167  [90m 355 |[39m     [90m// 장바구니는 이미 삭제됐으므로 metadata에서 상품명 추출 시도[39m
17:42:30.167 [31m[1m>[22m[39m[90m 356 |[39m     [36mif[39m (isShopOrder [33m&&[39m ([33m![39memailData[33m.[39mitems [33m||[39m emailData[33m.[39mitems[33m.[39mlength [33m===[39m [35m0[39m)) {
17:42:30.167  [90m     |[39m                                    [31m[1m^[22m[39m
17:42:30.167  [90m 357 |[39m       emailData[33m.[39mitems [33m=[39m [sanitize(metadata[33m?[39m[33m.[39mproductName [36mas[39m string) [33m||[39m [32m"디지털 에셋"[39m][33m;[39m
17:42:30.167  [90m 358 |[39m     }
17:42:30.167  [90m 359 |[39m[0m
17:42:30.204 Next.js build worker exited with code: 1 and signal: null
17:42:30.248 Error: Command "npm run build" exited with 1