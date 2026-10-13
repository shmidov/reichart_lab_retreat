window.APP_CONFIG = {
  // The site's name (browser tab title).
  GAME_TITLE: 'Reichart Group Retreat',

  // What everyone sees until the host starts an activity (placeholder; to be designed).
  WELCOME: {
    title: 'Welcome to the retreat!',
  },

  // The parts of the day the host can switch between, in order.
  //   type 'lecture': the title, on the projector and on phones
  //   type 'game':    the opinion game (questions from the Google Sheet)
  //   type 'submit':  phones submit a link (e.g. a Google Doc); saved to the Sheet tab named in `sheet`,
  //                   one row per person (resubmitting replaces that person's row).
  //                   mode 'personal' = everyone submits their own; 'group' = anyone may submit their group's.
  //                   chooseTopics: N = first pick N topics (the game's question titles), saved to `topicsSheet`.
  //   parts: optional steps the host switches between (see the blogpost below); titles become "Title: label".
  //   accent: the activity's palette color ('sage', 'terracotta', 'sand' or 'slate').
  // The host can also show the built-in Agenda page, which lists these activities.
  ACTIVITIES: [
    {
      id: 'review',
      type: 'lecture',
      name: 'Discussion by Roi',
      title: 'The review process and its transformation',
      accent: 'sage',
    },
    {
      id: 'game',
      type: 'game',
      name: 'Game and discussion',
      title: 'Research identity, impact and publication in the AI era',
      accent: 'slate',
    },
    {
      id: 'blogpost',
      type: 'submit',
      mode: 'group',
      name: 'Group writing',
      title: 'Position paper / Blogpost draft',
      chooseTopics: 3,
      topicInstructions: 'Choose the three topics you would most like to write about. We will form the groups from your choices.',
      topicsSheet: 'Position topics',
      // The host switches between these parts. kind: 'topics' (pick topics), 'submit' (paste the link),
      // 'text' (just show text: screenText on the projector, phoneText on phones, or `text` on both).
      parts: [
        { id: 'topics', kind: 'topics', label: 'Topic choice' },
        { id: 'writing', kind: 'submit', label: 'Group writing' },
        {
          id: 'presentations',
          kind: 'text',
          label: 'Presentations',
          screenText: 'Each group has 5 minutes to present and 5 minutes for questions.',
          phoneText: 'You have 5 minutes to present with your group and 5 minutes for questions.',
        },
      ],
      // The writing brief, shown on the projector and on phones during the writing part.
      // Format: "## " heading, "1. " numbered item, "* " bullet, **bold**; links become clickable.
      instructions: `
## רקע
תרומה מדעית ומחקרית אינה מתבטאת רק במענה על שאלות אמפיריות, אלא גם בזיהוי תופעות, באתגור מוסכמות ובבחינה ביקורתית של מתודולוגיות ופרקטיקות הנהוגות בקהילה המדעית. לצד בלוגים אישיים ופלטפורמות שבהן חוקרים משתפים תובנות ועמדות, קיימות גם במות פרסום אקדמיות פורמליות, בכתבי עת ובכנסים מדעיים, המאפשרות פרסום של Blogposts ו-Position Papers במסגרת תהליך של ביקורת עמיתים.

## מטרה
להשתמש בידע, בניסיון ובפרספקטיבה שלנו כקבוצת מחקר כדי לגבש רעיונות ותובנות שיכולים לתרום לשיח בקהילת ה-NLP וה-AI ולהשפיע על האופן שבו אנו חוקרים ופועלים. בסיום הפעילות נשאף לגבש טיוטות שיוכלו לשמש בסיס לפרסום.

## הנחיות
כל קבוצה תיצור outline שיכלול:
1. **כותרת** - קצרה, עניינית, שמכילה את הטענה המרכזית שנרצה להעביר
2. **מוטיבציה** - מהי הבעיה/ההנחה המקובלת שאותה אתם מאתגרים? מדוע דחוף לעסוק בה כעת? מי קהל היעד שיושפע משינוי התפיסה?
3. **טיעונים** - אילו דוגמאות או ראיות יכולות לבסס את הטענה המרכזית? אפשר להוסיף גם התייחסויות לטענות נגדיות.
4. **הצעה לפתרון** - מה אנחנו מציעים לעשות אחרת? אילו המלצות, שינויים או כיווני פעולה נובעים מהטענה שלנו? זהו החלק המרכזי בעבודה.
5. **בונוס** - באיזו פלטפורמה ננסה לפרסם את התוצר?

בסיום הפעילות, כל קבוצה תציג את הרעיון שלה במשך 5 דקות, ולאחר מכן יוקצו 5 דקות לשאלות ולדיון.

## מקורות נוספים
* https://icml.cc/Conferences/2026/CallForPositionPapers
* https://iclr.cc/Conferences/2026/CallForBlogPosts
* https://www.nature.com/natmachintell/content
`,
      sheet: 'Position blogpost',
      accent: 'terracotta',
    },
    {
      id: 'future',
      type: 'submit',
      mode: 'personal',
      name: 'Personal writing',
      title: 'Future works',
      instructions: `
**בנק עבודות המשך קבוצתי**

## מטרה
לזהות רעיונות למחקרי המשך שצומחים מתוך העבודות, הממצאים, השיטות או היכולות שכבר פותחו במעבדה, אך מסיבות שונות אינם מקודמים כרגע.
נציף שאלות מחקר וכיוונים חדשים שעלו במהלך העבודה, או מחקרים שהיינו רוצים לקדם אילו עמדו לרשותנו יותר זמן ומשאבים, ולגבש מאגר קונקרטי של רעיונות למחקר עתידי.
מאגר זה יוכל לשמש אותנו הן לקידום שיתופי פעולה ויוזמות מחקר חדשות כבר עכשיו, והן כנקודת מוצא לסטודנטים שיצטרפו למעבדה ויחפשו הזדמנויות להשתלב בפרויקטים.

## הנחיות
עליכם לכתוב פסקה (לפחות) המתארת רעיון לעבודת המשך, בהתבסס על פרויקט שאתם מובילים, שותפים להם או מכירים היטב.
הרעיון יכול להיות:
* **שאלת מחקר שנותרה פתוחה:** כיוון מעניין שלא היה מקום לבחון במסגרת העבודה המקורית.
* **הרחבה של מחקר קיים:** יישום של שיטה, מודל או ממצא על בעיה, אוכלוסייה, נתונים או תחום אחר.
* **העמקה של ממצא או תוצאה:** בדיקה נוספת שיכולה להסביר, לבסס או להרחיב תוצאה קיימת.
* **כיוון הדורש מומחיות נוספת:** רעיון שאינו בתחום ההתמחות של החוקר המקורי, ויכול להוות בסיס לשיתוף פעולה עם חוקרים אחרים במעבדה.

בפסקה כדאי להתייחס לנקודות הבאות:
1. מאיזו עבודה או תוצאה צמח הרעיון?
2. מה הרעיון מוסיף למחקר המקורי, ומה יכולה להיות תרומתו לשדה המחקרי הרחב?
3. אילו ממצאים, תובנות או לקחים מהמחקר המקורי יכולים לסייע בתכנון מחקר ההמשך?
4. הצעה לצעדים פרקטיים, למשל, איסוף דאטה או תיאור אנליזות ראשוניות.

בסיום הפעילות תהיה אפשרות לשתף את הקבוצה ברעיון.
`,
      sheet: 'Future works',
      parts: [
        { id: 'writing', kind: 'submit', label: 'Personal writing' },
        {
          id: 'presentations',
          kind: 'text',
          label: 'Presentations',
          text: 'You should present your research direction in 5 minutes, and explain how it is derived from your work or why you find it interesting.',
        },
      ],
      accent: 'sand',
    },
  ],

  // The Agenda page, in order: an activity id from ACTIVITIES (shown numbered, with its title), or any other
  // text, e.g. a meal (shown without a number, with an empty neutral circle).
  AGENDA: [
    'Welcome & Refreshments',
    'review',
    'game',
    'Lunch',
    'blogpost',
    'future',
    'Vivino',
  ],

  // Apps Script web-app URL (ends with /exec). See SETUP.md.
  API_URL: 'https://script.google.com/macros/s/AKfycbwbvGGEVrz3mSHzmiGxzTtpbA-H6bgYyh02rPnci9slc4SHDqDPvdwrkwC4dC9ma-o3/exec',

  // Separates this game's live messages from anyone else's on the public relays.
  // Change it to start a completely fresh game.
  GAME_ID: 'reichart-retreat-2026-4qjs1ta7',

  // Only separates the host from the players; it is not real security.
  HOST_PASSWORD: 'reichart',

  // Public MQTT relays. Every message goes through all of them, so the site works as long as any one is
  // reachable. shiftr.io runs on port 443 (like normal websites), so it also gets through networks that
  // block the other relays' ports (common on university and company networks).
  BROKERS: [
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://broker.emqx.io:8084/mqtt',
    { url: 'wss://public.cloud.shiftr.io:443', username: 'public', password: 'public' },
  ],
};
