# 🪐 KODA — AI-Powered Portfolio & Quant Analytics Dashboard

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.0.0-34a8eb?style=for-the-badge&logo=github" alt="Version">
  <img src="https://img.shields.io/badge/Environment-Vercel-000000?style=for-the-badge&logo=vercel" alt="Deployment">
  <img src="https://img.shields.io/badge/Stack-Vanilla%20JS%20%7C%20Tailwind-161c2b?style=for-the-badge&logo=javascript" alt="Stack">
  <img src="https://img.shields.io/badge/License-MIT-00c076?style=for-the-badge&logo=opensourceinitiative" alt="License">
</p>

---

## ⚡ Overview
**KODA** คือเว็บแอปพลิเคชันระบบกระดานเทรดและการบริหารจัดการพอร์ตโฟลิโอส่วนบุคคลระดับสูง ออกแบบมาเพื่อลดสัญญาณรบกวนในตลาด (Market Noise) และโฟกัสไปที่ **"แก่นแท้ของข้อมูลเชิงลึก"** โดยผสมผสานลอจิกคณิตศาสตร์ขั้นสูง (S/R Algorithms) เข้ากับพลังประมวลผลเชิงวิเคราะห์ของ AI (Gemini 2.5 Flash) เพื่อสร้างกลยุทธ์การลงทุน (Investment Thesis) ที่เฉียบขาดและเป็นรูปธรรมที่สุดสำหรับรายย่อย

> 💡 **Core Philosophy:** ไม่ได้จำมาตอบ เรียนรู้จากอดีตและวัฏจักรของตลาด (Market Cycles) มองการณ์ไกล ไร้อคติ และนำเสนอข้อมูลด้วยตัวเลขที่เป็นความจริงเท่านั้น (Pure Data-Driven, Zero Hype)

---

## 🎯 Key Features

### 1. Real-Time Premium Ticker (Tick-by-Tick)
* **Rolling Number UI:** ยกระดับประสบการณ์การมองเห็นด้วยตัวเลขราคาที่ไหลหมุนนับอย่างนุ่มนวล (Smooth Animation ที่ 60fps) แทนการ Fade เลือนหายแบบเดิม ครอบคลุมทั้งราคาหลักและราคานอกเวลาทำการ (Pre/Post Market)
* **Border Flash:** ระบบตอบสนองเชิงสัญชาตญาณ กระพริบเส้นกรอบสีเขียว/แดงสว่างวาบทันทีตามการเคลื่อนไหวของราคาแบบ Tick-by-Tick

### 2. KODA Lab — Advanced S/R & Profit Matrix
* **Algorithmic S/R Swing:** ถอดลอจิกสวิงราคา (Lookback Pivot Point) ตรวจหาแนวรับ-แนวต้านที่มีนัยสำคัญทางสถิติ พร้อมคัดกรองสัญญาณหลอกด้วยระดับความแข็งแกร่ง (Strong S2 / R2 Lines)
* **Interactive Profit Matrix:** คำนวณอัตราส่วนผลตอบแทนเทียบต่อความเสี่ยง (Risk/Reward Grid) และจำลองเมทริกซ์กำไรตามระดับราคาทันทีเมื่อปรับเปลี่ยนเงินทุน

### 3. Smart PWA & Secure Data Engine
* **Flexible Multi-Currency:** สลับการแสดงผลมูลค่าพอร์ตสลับไปมาระหว่างสกุลเงิน USD และ THB (฿) แบบเรียลไทม์โดยไม่มีอาการภาพกระตุกกวนใจ
* **Version 2 Data Bundle:** ระบบ Backup & Restore ขั้นสูง มัดรวมทั้งรายชื่อหุ้น เงินสด (Cash) และข้อมูลเส้นประวัติกราฟมูลค่าพอร์ตรวม (Equity History) ย้อนหลัง ไว้ใน JSON ไฟล์เดียว เพื่อไม่ให้ต้องนับหนึ่งใหม่เมื่อล้างแคช

---

## 🛠️ Architecture & Tech Stack

แอปพลิเคชันถูกออกแบบด้วยสถาปัตยกรรมแบบ **Modular Monolith Lightweight** โหลดทำงานแบบไร้รอยต่อโดยไม่ง้อ Framework หนักๆ เพื่อให้ทำผลงานได้ยอดเยี่ยมที่สุดบนอุปกรณ์เคลื่อนที่

* **Frontend:** Vanilla JavaScript (ES6+), Tailwind CSS (Forms & Container Queries)
* **Charts:** Lightweight Charts (By TradingView), Chart.js (Stable V4)
* **Intelligence:** Gemini 2.5 Flash API Engine
* **Deployment:** Vercel Production Environment (Serverless Edge Functions Proxy)
* **Data Aggregator:** Yahoo Finance Real-time API, Finnhub Global Financial Webhook, Binance 24h Ticker API

---

## 📦 Directory Structure

```text
KODA/
├── api/                  # 🌐 Serverless Edge Functions (Vercel Backend)
│   ├── chart.js          # ระบบดึงและจัดการข้อมูลกราฟหลัก
│   ├── keys.js           # สคริปต์ความปลอดภัยสำหรับแยกแยะสิทธิ์ API Keys
│   ├── price.py          # ขุมพลังคำนวณราคา & โครงสร้างข้อมูลทางเทคนิค (Python)
│   └── yahoo.js          # ตัวกลางยิงตรงไปดึงข้อมูลสดจาก Yahoo Finance
├── js/                   # ⚡ Modular Frontend Logic
│   ├── api.js            # ระบบจัดการสเตทพอร์ตโฟลิโอ, ตารางคำนวณ และ Real-time Loop
│   ├── stock-detail.js   # ลอจิกควบคุมหน้าข้อมูลหุ้นรายตัว และระบบ Rolling Number
│   ├── portfolio-calc.js # ตัวประมวลผลข้อมูล holdings และคำนวณมูลค่าพอร์ตรวม + เงินสด
│   ├── analytics.js      # ระบบวิเคราะห์ขั้นสูง, DCA Engine และตัวคำนวณ KODA Lab
│   ├── ai-helper.js      # ตัวจัดการคิวประมวลผลคำแปล และจับคู่ภาพประกอบข่าวเชิงวิเคราะห์
│   ├── market-plus.js    # โมดูลคณิตศาสตร์สำหรับคำนวณดัชนีชี้วัดทางเทคนิค (RSI ฯลฯ)
│   ├── markets.js        # ตัวควบคุมหน้า Market Overview และ Fear & Greed Index
│   └── nav.js            # ระบบจัดการแถบเมนูด้านล่างแบบข้ามหน้าจอ (Dynamic Navigation)
├── *.html                # 📱 หน้าตา UI ดีไซน์ Glassmorphism รองรับ Container Queries
├── sw.js                 # ระบบจัดการ Service Worker (ควบคุมสถานะ Cache)
├── vercel.json           # ไฟล์ตั้งค่าระบบ Routing และ Serverless Environment บน Vercel
├── manifest.json         # โครงสร้างคอนฟิกสำหรับฟีเจอร์ Progressive Web App (PWA)
└── requirements.txt      # รายการไลบรารีของ Python ที่ใช้บนสภาพแวดล้อมระบบ Edge
