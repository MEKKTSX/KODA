// js/financial-details.js

document.addEventListener('DOMContentLoaded', () => {
    const btnFinDetail = document.getElementById('btn-fin-detail');
    const modalFinDetail = document.getElementById('modal-fin-detail');
    const modalFinContent = document.getElementById('modal-fin-content');
    const btnCloseFin = document.getElementById('btn-close-fin-detail');
    const finModalBody = document.getElementById('fin-modal-body');

    // 📌 ข้อมูลคู่มือการเงิน
    const finDictionaryHtml = `
        <div>
            <h4 class="text-primary font-bold mb-1 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">account_balance_wallet</span> 1. FCF (Free Cash Flow)</h4>
            <p class="text-white font-bold text-xs mb-1">"เงินสดเหลือจริง" (ควรมีที่สุด)</p>
            <p class="text-slate-400 text-xs leading-relaxed"><strong>ทำไมต้องมี:</strong> สำคัญมากสำหรับหุ้นที่ Net Income ยังติดลบ เพราะบางครั้ง "กำไรทางบัญชี" ติดลบ แต่บริษัทอาจจะมี "เงินสดไหลเข้า" จริงๆ ก็ได้ FCF จะบอกเราว่าบริษัทต้องแบมือขอเงินผู้ถือหุ้นเพิ่ม (เพิ่มทุน) หรือกู้เงินเพิ่มในเร็วๆ นี้ไหม</p>
        </div>

        <div>
            <h4 class="text-primary font-bold mb-1 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">trending_up</span> 2. ROE (Return on Equity)</h4>
            <p class="text-white font-bold text-xs mb-1">"ความเก่งในการใช้เงินเรา"</p>
            <p class="text-slate-400 text-xs leading-relaxed"><strong>ทำไมต้องมี:</strong> ตัวเลขนี้บอกว่า ผู้บริหารเอาเงินของผู้ถือหุ้น (อย่างเรา) ไปสร้างกำไรได้กี่เปอร์เซ็นต์ ถ้าค่านี้สูง แปลว่าเขาใช้เงินเราได้คุ้มค่ามาก</p>
        </div>

        <div>
            <h4 class="text-primary font-bold mb-1 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">water_drop</span> 3. Current Ratio</h4>
            <p class="text-white font-bold text-xs mb-1">"สภาพคล่อง/ความเสี่ยง"</p>
            <p class="text-slate-400 text-xs leading-relaxed"><strong>ทำไมต้องมี:</strong> คือการเอา (สินทรัพย์หมุนเวียน ÷ หนี้สินหมุนเวียน) ถ้าค่านี้ <strong class="text-danger">ต่ำกว่า 1</strong> คือสัญญาณอันตรายว่าบริษัทอาจไม่มีเงินจ่ายหนี้ในระยะสั้น (ปีหน้า) เหมาะมากที่จะวางคู่กับ EPS เพื่อดูความเสี่ยง</p>
        </div>

        <div>
            <h4 class="text-primary font-bold mb-1 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">credit_score</span> 4. Debt to Equity (D/E Ratio)</h4>
            <p class="text-white font-bold text-xs mb-1">"ระดับหนี้สิน"</p>
            <p class="text-slate-400 text-xs leading-relaxed"><strong>ทำไมต้องมี:</strong> บอกว่าบริษัทนี้ใช้ "เงินกู้" หรือ "เงินเรา" ทำธุรกิจมากกว่ากัน ถ้า D/E สูงเกินไป (เช่น > 2) ในช่วงที่ดอกเบี้ยแพงแบบนี้ บริษัทอาจจะเหนื่อยหนักเพราะต้องจ่ายดอกเบี้ยสูง</p>
        </div>

        <hr class="border-border-dark/50 my-2">

        <div>
            <h4 class="text-slate-300 font-bold mb-1 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">monetization_on</span> EPS (TTM)</h4>
            <p class="text-slate-400 text-xs leading-relaxed"><strong>กำไรต่อหุ้น (รอบ 12 เดือนล่าสุด):</strong> ตัวชี้วัดพื้นฐานที่สุดว่า 1 หุ้นที่คุณถือ บริษัททำกำไรได้กี่บาท ถ้าค่านี้เป็นบวกและเติบโตสม่ำเสมอ คือสัญญาณของหุ้นชั้นดี</p>
        </div>

        <div>
            <h4 class="text-slate-300 font-bold mb-1 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">sell</span> P/E & P/S Ratio</h4>
            <p class="text-slate-400 text-xs leading-relaxed"><strong>ความถูกแพงของหุ้น:</strong><br>
            • <strong class="text-white">P/E:</strong> จ่ายเงินซื้อหุ้นวันนี้ อีกกี่ปีถึงจะคืนทุน (จากกำไร)<br>
            • <strong class="text-white">P/S:</strong> จ่ายเงินซื้อหุ้นวันนี้ อีกกี่ปีถึงจะคืนทุน (จากยอดขาย) <em>*เหมาะกับหุ้น Tech ที่ยังไม่ทำกำไร</em></p>
        </div>
    `;

    // ยัด HTML ลงไปใน Body ของ Modal
    if (finModalBody) finModalBody.innerHTML = finDictionaryHtml;

    // เปิด Modal
    if (btnFinDetail) {
        btnFinDetail.addEventListener('click', () => {
            modalFinDetail.classList.remove('hidden');
            modalFinDetail.classList.add('flex');
            // หน่วงเวลาให้ Transition ทำงาน
            setTimeout(() => {
                modalFinDetail.classList.remove('opacity-0');
                modalFinContent.classList.remove('scale-95');
            }, 10);
        });
    }

    // ฟังก์ชันปิด Modal
    const closeModal = () => {
        modalFinDetail.classList.add('opacity-0');
        modalFinContent.classList.add('scale-95');
        setTimeout(() => {
            modalFinDetail.classList.add('hidden');
            modalFinDetail.classList.remove('flex');
        }, 200); // รอให้ Transition เล่นจบ
    };

    if (btnCloseFin) btnCloseFin.addEventListener('click', closeModal);

    // ปิดเมื่อคลิกพื้นที่ว่างรอบๆ (Backdrop)
    if (modalFinDetail) {
        modalFinDetail.addEventListener('click', (e) => {
            if (e.target === modalFinDetail) closeModal();
        });
    }
});


