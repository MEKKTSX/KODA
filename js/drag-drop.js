document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('watchlist-container');
    if (!container) return;

    let draggingItem = null;
    let placeholder = null;
    let longPressTimer = null;
    let isDragging = false;

    // ฟังก์ชันช่วยอัปเดตลำดับข้อมูลใน LocalStorage ทันทีที่ปล่อยนิ้ว
    const saveNewOrder = () => {
        const currentElements = Array.from(container.querySelectorAll('.watchlist-item'));
        const newOrderSymbols = currentElements.map(el => el.getAttribute('data-symbol'));
        
        // ดึงข้อมูลเดิมจากเครื่อง
        const savedData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{}');
        if (!savedData.watchlist) return;

        // จัดเรียงอาร์เรย์ watchlist ใหม่ตามลำดับสัญลักษณ์ที่ดึงมาจากหน้าจอ
        const newWatchlistArray = newOrderSymbols.map(sym => {
            return savedData.watchlist.find(s => s.symbol === sym);
        }).filter(item => item !== undefined); // เผื่อเหนียวกันพัง

        // เซฟทับของเดิม
        savedData.watchlist = newWatchlistArray;
        localStorage.setItem('koda_portfolio_data', JSON.stringify(savedData));
        
        // อัปเดตข้อมูลบน Window ให้ตรงกันด้วย
        if (window.kodaApiData) window.kodaApiData.watchlist = newWatchlistArray;
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

    // --- เริ่มกด (กดค้าง 500ms ถึงจะเข้าโหมดลาก) ---
    container.addEventListener('touchstart', (e) => {
        const item = e.target.closest('.watchlist-item');
        if (!item) return;

        // ตั้งเวลาจับการกดค้าง (500 ms)
        longPressTimer = setTimeout(() => {
            isDragging = true;
            draggingItem = item;
            
            // สั่นมือถือเบาๆ ให้รู้ว่าลากได้แล้ว (ถ้าเบราว์เซอร์รองรับ)
            if (navigator.vibrate) navigator.vibrate(50);

            // ป้องกันขยับจอ
            document.body.style.overflow = 'hidden';
            
            placeholder = createPlaceholder(draggingItem);
            const rect = draggingItem.getBoundingClientRect();
            
            draggingItem.style.position = 'fixed';
            draggingItem.style.zIndex = '1000';
            draggingItem.style.width = `${rect.width}px`;
            draggingItem.style.backgroundColor = '#1e293b'; 
            draggingItem.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5)';
            draggingItem.style.opacity = '0.95';
            draggingItem.style.pointerEvents = 'none'; // ทะลุนิ้ว

            container.insertBefore(placeholder, draggingItem.nextSibling);
            moveItem(e.touches[0].clientY);

        }, 500); // 500 มิลลิวินาที

    }, { passive: false });

    // --- ถ้านิ้วขยับก่อนถึง 500ms (แปลว่าแค่จะเลื่อนจอ) ให้ยกเลิกการตั้งเวลา ---
    container.addEventListener('touchmove', (e) => {
        if (!isDragging) {
            clearTimeout(longPressTimer);
            return; // ปล่อยให้เบราว์เซอร์เลื่อนจอไปตามปกติ
        }

        // ถ้ายืนยันว่ากำลังลากอยู่ ห้ามเลื่อนจอ
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

    // --- ปล่อยนิ้ว ---
    const endDrag = (e) => {
        clearTimeout(longPressTimer); // ยกเลิกการจับเวลากดค้าง

        // ถ้าปล่อยนิ้วก่อน 500ms (isDragging = false) โค้ดจะอนุญาตให้ลิงก์ทำงานปกติ (เด้งไปหน้ารายละเอียดหุ้น)
        if (!isDragging || !draggingItem) return;

        // ถ้ากำลังลากอยู่ ให้ทำการวางและเซฟลำดับ
        e.preventDefault();

        document.body.style.overflow = '';
        container.insertBefore(draggingItem, placeholder);
        
        if (placeholder && placeholder.parentNode) {
            placeholder.parentNode.removeChild(placeholder);
        }

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

        // 📌 📌 สั่งเซฟลำดับใหม่ลง LocalStorage ทันที!
        saveNewOrder();

        draggingItem = null;
        placeholder = null;
        isDragging = false;
    };

    container.addEventListener('touchend', endDrag);
    container.addEventListener('touchcancel', endDrag);

    // ช่วยให้กดขวาคลิก (Context menu) บนมือถือไม่ขัดจังหวะ
    container.addEventListener('contextmenu', (e) => e.preventDefault());

    function moveItem(clientY) {
        if (!draggingItem) return;
        const halfHeight = draggingItem.offsetHeight / 2;
        draggingItem.style.top = `${clientY - halfHeight}px`;
        draggingItem.style.left = '50%';
        draggingItem.style.transform = 'translateX(-50%)';
    }
});