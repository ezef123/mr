<div align="center">

# 🏛 МояРеспублика

**Социальная сеть Республики Жакид**

*Голос каждого гражданина*

![HTML](https://img.shields.io/badge/HTML-5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JS](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20RTDB-FFCA28?style=flat-square&logo=firebase&logoColor=black)

</div>

---

## ✨ Возможности

| | | |
|:---:|:---:|:---:|
| 📝 Посты с картинками | ❤️ Лайки и 💬 комментарии | 👥 Подписки |
| 🔔 Уведомления | 🔍 Поиск граждан | ✅ Синяя галочка |
| 🛡 Админ-панель | 🌙 Тёмная тема | 📱 Адаптив |

---

## 📁 Структура

```
moya-respublika/
├── index.html
├── css/style.css
├── js/
│   ├── firebase-config.js
│   ├── utils.js
│   └── app.js
└── database.rules.json
```

## 🔐 Безопасность

Пароли — в **Firebase Auth**, в базе их нет.  
`verified` меняет **только админ** — правило БД не даст иначе.  
Профиль и посты правит только владелец (`auth.uid`).

---
## ✅ Верификация

У аккаунтов официальных лиц есть галочка, подтверждающая, что это реальное лицо,

а также подпись "подтверждён".

---

<div align="center">

**Республика Жакид · 2026**

*«МояРеспублика — голос каждого»*
