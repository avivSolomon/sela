# הרצת סלע ב-Windows

## דרך מהירה

1. התקן Node.js 24 LTS: `winget install OpenJS.NodeJS.LTS` (ופתח טרמינל חדש)
2. התקן Git for Windows: `winget install Git.Git`
3. העבר את הפרויקט לנתיב באנגלית בלבד, למשל `C:\sela` (ראה למטה למה)
4. הרץ:

```powershell
cd C:\sela
powershell -ExecutionPolicy Bypass -File .\start-sela.ps1
```

בהרצה הראשונה הסקריפט מתקין את התלויות הדרושות ובונה את האפליקציה (כמה דקות). אחר כך הוא מפעיל שרת קבצים מובנה, והדפדפן נפתח על http://localhost:3001. בפעמים הבאות ההפעלה לוקחת שניות. אפשרויות: `-Rebuild` (בנייה מחדש), `-NoBrowser` (בלי לפתוח דפדפן), `-Dev` (שרת פיתוח, התקנה מלאה).

## פתרון תקלות נפוצות

### `port 3001 is already in use`

חלון סלע אחר כבר פועל (פתח את http://localhost:3001) או תוכנה אחרת תופסת את הפורט. סגור אותה והרץ שוב. הפורט קבוע בכוונה: הדפדפן שומר את הנתונים לפי הכתובת.

### `Build failed`

הרץ שוב עם `-Rebuild`. אם זה נכשל שוב, הרץ עם `-Dev` כדי לראות את השגיאה המלאה.

### `Couldn't find the node_modules state file`

ההתקנה לא רצה או נכשלה. מחק את `node_modules` והרץ שוב את `start-sela.ps1` (או `node .\.yarn\releases\yarn-4.17.1.cjs install` להתקנה מלאה).

### `bcrypt / argon2 / better-sqlite3 / sharp couldn't be built`

המודולים האלה כוללים קוד C++. הסיבות הנפוצות:

- **גרסת Node חדשה מדי.** למודולים אין קבצים מוכנים לגרסאות חדשות (כמו 26) והם מנסים להתקמפל. התקן Node 24 LTS (`.nvmrc` מגדיר 24).
- **חסרים כלי בנייה.** התקן: `winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --passive"` ופתח טרמינל חדש.
- **נתיב עם עברית.** `C:\Users\...\Desktop\סלע` שובר בנייה של מודולים מקומיים (רואים בשגיאה `╫í╫£╫ó`). העבר את התיקייה ל-`C:\sela`.

אחרי תיקון, מחק את `node_modules` והרץ שוב את ההתקנה.

### `Cannot find module ...npm-run-all...`

תוצאה של התקנה שלא הושלמה. אותו פתרון כמו למעלה.

### `'sh' is not recognized`

חסר Git for Windows או שהוא לא ב-PATH. הסקריפט `start-sela.ps1` מטפל בזה אוטומטית.

### הפקודה הורצה פעמיים ברצף

בטרמינל, הדבק פקודה אחת בכל פעם (שגיאה כמו `Couldn't find a script named "start:browsernode"` נובעת משתי פקודות שהודבקו יחד).
