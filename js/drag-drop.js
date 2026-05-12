// ประกาศตัวแปร Global ไว้เพื่อให้ไฟล์อื่นรู้ว่าตอนนี้เปิดแฟ้มไหนอยู่
window.currentActiveCategory = 'All'; 

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('watchlist-container');
    if (!container) return;

    let draggingItem = null;
    let placeholder = null;
    let longPressTimer = null;
    let isDragging = false;

    // 📌 แก้ไขฟังก์ชันอัปเดตลำดับ ให้เซฟลงหมวดหมู่ปัจจุบัน (Category)
    const saveNewOrder = () => {
        const currentElements = Array.from(container.querySelectorAll('.watchlist-item'));
        const newOrderSymbols = currentElements.map(el => el.getAttribute('data-symbol'));
        
        // ดึงข้อมูลเดิมจากเครื่อง
        const savedData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{}');
        
        // ถ้าไม่มีโครงสร้าง watchlists หรือไม่มีหมวดหมู่นี้ ให้หยุดทำงาน
        if (!savedData.watchlists || !savedData.watchlists[window.currentActiveCategory]) return;

        // ดึงข้อมูลหุ้นในหมวดหมู่ปัจจุบันมาเรียงใหม่
        const currentCategoryList = savedData.watchlists[window.currentActiveCategory];
        const newWatchlistArray = newOrderSymbols.map(sym => {
            return currentCategoryList.find(s => s.symbol === sym);
        }).filter(item => item !== undefined); 

        // เซฟทับของเดิมเฉพาะหมวดหมู่นี้
        savedData.watchlists[window.currentActiveCategory] = newWatchlistArray;
        localStorage.setItem('koda_portfolio_data', JSON.stringify(savedData));
    };

    const createPlaceholder = (element) => {
        const p = document.createElement('div');
        p.className = element.className;
        p.style.backgroundColor = 'transparent';
        p.style.border = '2px dashed #34a8eb'; 
        p.style.opacity = '0.3';
        p.style.height = `${element.offsetHeight}px`;
        p.innerHTML = ''; 
        return p;
    };

    container.addEventListener('touchstart', (e) => {
        // 📌 จุดสำคัญ: ถ้ามีการเปิด Filter อยู่ ห้ามลากวางเด็ดขาด (เพื่อความปลอดภัยของข้อมูล)
        if (window.activeFilters && window.activeFilters.size > 0) {
            alert("กรุณาล้างตัวกรอง (Scanner) ก่อนจึงจะสามารถจัดเรียงลำดับด้วยตนเองได้");
            return;
        }

        const item = e.target.closest('.watchlist-item');
        if (!item) return;
        // ... (โค้ดเดิมด้านล่าง) ...

        longPressTimer = setTimeout(() => {
            isDragging = true;
            draggingItem = item;
            
            if (navigator.vibrate) navigator.vibrate(50);
            document.body.style.overflow = 'hidden';
            
            placeholder = createPlaceholder(draggingItem);
            const rect = draggingItem.getBoundingClientRect();
            
            draggingItem.style.position = 'fixed';
            draggingItem.style.zIndex = '1000';
            draggingItem.style.width = `${rect.width}px`;
            draggingItem.style.backgroundColor = '#1e293b'; 
            draggingItem.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5)';
            draggingItem.style.opacity = '0.95';
            draggingItem.style.pointerEvents = 'none';

            container.insertBefore(placeholder, draggingItem.nextSibling);
            moveItem(e.touches[0].clientY);
        }, 500); 
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        if (!isDragging) {
            clearTimeout(longPressTimer);
            return;
        }

        e.preventDefault(); 
        const touchY = e.touches[0].clientY;
        moveItem(touchY);

        const elemUnderTouch = document.elementFromPoint(e.touches[0].clientX, touchY);
        if (elemUnderTouch) {
            const targetItem = elemUnderTouch.closest('.watchlist-item');
            if (targetItem && targetItem !== draggingItem && targetItem !== placeholder) {
                const targetRect = targetItem.getBoundingClientRect();
                const targetCenter = targetRect.top + targetRect.height / 2;
                if (touchY < targetCenter) {
                    container.insertBefore(placeholder, targetItem);
                } else {
                    container.insertBefore(placeholder, targetItem.nextSibling);
                }
            }
        }
    }, { passive: false });

    const endDrag = (e) => {
        clearTimeout(longPressTimer);
        if (!isDragging || !draggingItem) return;

        e.preventDefault();
        document.body.style.overflow = '';
        container.insertBefore(draggingItem, placeholder);
        
        if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);

        draggingItem.style.position = '';
        draggingItem.style.zIndex = '';
        draggingItem.style.width = '';
        draggingItem.style.backgroundColor = '';
        draggingItem.style.boxShadow = '';
        draggingItem.style.opacity = '';
        draggingItem.style.top = '';
        draggingItem.style.left = '';
        draggingItem.style.transform = '';
        draggingItem.style.pointerEvents = '';

        saveNewOrder(); // เซฟระบบใหม่

        draggingItem = null;
        placeholder = null;
        isDragging = false;
    };

    container.addEventListener('touchend', endDrag);
    container.addEventListener('touchcancel', endDrag);
    container.addEventListener('contextmenu', (e) => e.preventDefault());

    function moveItem(clientY) {
        if (!draggingItem) return;
        const halfHeight = draggingItem.offsetHeight / 2;
        draggingItem.style.top = `${clientY - halfHeight}px`;
        draggingItem.style.left = '50%';
        draggingItem.style.transform = 'translateX(-50%)';
    }
});
