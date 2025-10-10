@echo off
echo === UPGRADE TO ANGULAR 19 STACK ===
echo.

cd frontend

echo Suppression de node_modules...
rmdir /s /q node_modules 2>nul

echo Mise a jour package.json...
(
echo {
echo   "name": "regalica-frontend",
echo   "version": "0.0.2",
echo   "scripts": {
echo     "ng": "ng",
echo     "start": "ng serve --host 0.0.0.0 --port 4200",
echo     "build": "ng build --configuration production",
echo     "watch": "ng build --watch --configuration development",
echo     "test": "ng test"
echo   },
echo   "private": true,
echo   "dependencies": {
echo     "@angular/animations": "^19.0.0",
echo     "@angular/cdk": "^19.1.2",
echo     "@angular/common": "^19.0.0",
echo     "@angular/compiler": "^19.0.0",
echo     "@angular/core": "^19.0.0",
echo     "@angular/forms": "^19.0.0",
echo     "@angular/material": "^19.1.2",
echo     "@angular/platform-browser": "^19.0.0",
echo     "@angular/platform-browser-dynamic": "^19.0.0",
echo     "@angular/router": "^19.0.0",
echo     "tailwindcss": "^3.4.17",
echo     "echarts": "^5.6.0",
echo     "ngx-echarts": "^19.0.0",
echo     "rxjs": "~7.8.0",
echo     "tslib": "^2.3.0",
echo     "zone.js": "~0.15.0"
echo   },
echo   "devDependencies": {
echo     "@angular-devkit/build-angular": "^19.0.6",
echo     "@angular/cli": "^19.0.6",
echo     "@angular/compiler-cli": "^19.0.0",
echo     "typescript": "~5.6.2"
echo   }
echo }
) > package.json

echo Installation des dependances...
npm install

echo.
echo === UPGRADE COMPLETE ===
echo Angular 19.0.0 installe !
echo.
pause