// js/app.js
import { Storage } from './utils/storage.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Mek Portfolio PWA Initialized');
    
    // ตรวจสอบข้อมูลเบื้องต้น
    const myPortfolio = Storage.getPortfolio();
    console.log('Current Portfolio:', myPortfolio);

    // ระบบ Navigation ง่ายๆ
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const page = item.getAttribute('data-page');
            console.log(`Navigating to: ${page}`);
            // ในอนาคตเราจะเขียนฟังก์ชันเปลี่ยนหน้าตรงนี้
        });
    });
});

// Register Service Worker สำหรับ PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker Registered'));
}
