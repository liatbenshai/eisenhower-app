# הוראות ליצירת אייקונים ל-PWA

## אפשרות 1: שימוש ב-SVG (מומלץ)

האייקון SVG כבר נוצר ב-`public/icon.svg`. כדי ליצור PNG מהאייקון:

### דרך 1: שימוש ב-Online Tool
1. פתחי את `public/icon.svg` בדפדפן
2. השתמשי בכלי כמו:
   - https://realfavicongenerator.net/
   - https://www.pwabuilder.com/imageGenerator
3. העלי את ה-SVG
4. הורידי את ה-PNG בגדלים:
   - 192x192 (icon-192.png)
   - 512x512 (icon-512.png)

### דרך 2: שימוש ב-ImageMagick (אם מותקן)
```bash
# התקנת ImageMagick (אם לא מותקן)
# Windows: choco install imagemagick
# Mac: brew install imagemagick

# המרת SVG ל-PNG
magick public/icon.svg -resize 192x192 public/icon-192.png
magick public/icon.svg -resize 512x512 public/icon-512.png
```

### דרך 3: שימוש ב-Node.js (אם יש לך sharp)
```bash
npm install sharp --save-dev
node -e "const sharp = require('sharp'); sharp('public/icon.svg').resize(192, 192).toFile('public/icon-192.png');"
node -e "const sharp = require('sharp'); sharp('public/icon.svg').resize(512, 512).toFile('public/icon-512.png');"
```

## אפשרות 2: יצירת אייקון מותאם

אם את רוצה אייקון מותאם יותר:
1. צרי אייקון ב-Figma, Canva, או כלי עיצוב אחר
2. שמרי כ-SVG או PNG
3. העתיקי ל-`public/icon.svg` (או PNG)
4. צרי PNG בגדלים 192x192 ו-512x512

## דרישות אייקון:
- **גודל מינימלי**: 192x192 פיקסלים
- **גודל מומלץ**: 512x512 פיקסלים
- **פורמט**: PNG עם רקע שקוף או SVG
- **עיצוב**: צריך להיות ברור גם בגדלים קטנים

## אחרי יצירת האייקונים:
1. שמרי את הקבצים ב-`public/`:
   - `icon-192.png` (192x192)
   - `icon-512.png` (512x512)
2. ה-manifest.json כבר מוגדר נכון
3. רענני את האפליקציה
4. בנייד: "הוסף למסך הבית" או "Add to Home Screen"

