/**
 * סקריפט ליצירת אייקונים ל-PWA
 * 
 * שימוש:
 * node scripts/generate-icons.js
 * 
 * דרישות:
 * - ImageMagick מותקן (magick command)
 * - או sharp: npm install sharp --save-dev
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');
const iconSvg = join(publicDir, 'icon.svg');

async function generateWithSharp() {
  try {
    const sharp = (await import('sharp')).default;
    
    console.log('📦 משתמש ב-sharp ליצירת אייקונים...');
    
    // יצירת icon-192.png
    await sharp(iconSvg)
      .resize(192, 192)
      .png()
      .toFile(join(publicDir, 'icon-192.png'));
    console.log('✅ נוצר icon-192.png');
    
    // יצירת icon-512.png
    await sharp(iconSvg)
      .resize(512, 512)
      .png()
      .toFile(join(publicDir, 'icon-512.png'));
    console.log('✅ נוצר icon-512.png');
    
    console.log('🎉 כל האייקונים נוצרו בהצלחה!');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('⚠️ sharp לא מותקן. מנסה ImageMagick...');
      return false;
    }
    throw err;
  }
  return true;
}

async function generateWithImageMagick() {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    console.log('📦 משתמש ב-ImageMagick ליצירת אייקונים...');
    
    // יצירת icon-192.png
    await execAsync(`magick "${iconSvg}" -resize 192x192 "${join(publicDir, 'icon-192.png')}"`);
    console.log('✅ נוצר icon-192.png');
    
    // יצירת icon-512.png
    await execAsync(`magick "${iconSvg}" -resize 512x512 "${join(publicDir, 'icon-512.png')}"`);
    console.log('✅ נוצר icon-512.png');
    
    console.log('🎉 כל האייקונים נוצרו בהצלחה!');
    return true;
  } catch (err) {
    console.error('❌ שגיאה ב-ImageMagick:', err.message);
    return false;
  }
}

async function main() {
  if (!existsSync(iconSvg)) {
    console.error('❌ לא נמצא icon.svg ב-public/');
    process.exit(1);
  }
  
  console.log('🎨 יוצר אייקונים ל-PWA...\n');
  
  // ננסה קודם עם sharp
  const sharpSuccess = await generateWithSharp();
  if (sharpSuccess) {
    return;
  }
  
  // אם sharp לא עובד, ננסה ImageMagick
  const magickSuccess = await generateWithImageMagick();
  if (magickSuccess) {
    return;
  }
  
  console.log('\n❌ לא נמצא כלי ליצירת אייקונים!');
  console.log('\nאפשרויות:');
  console.log('1. התקני sharp: npm install sharp --save-dev');
  console.log('2. התקני ImageMagick: https://imagemagick.org/script/download.php');
  console.log('3. השתמשי בכלי online: https://realfavicongenerator.net/');
  process.exit(1);
}

main();

