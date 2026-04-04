document.addEventListener('DOMContentLoaded', () => {
    const navContainer = document.getElementById('bottom-nav-container');
    if (!navContainer) return;

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    const isHome = currentPath === 'index.html' || currentPath === '';
    const isMarkets = currentPath === 'watchlist.html' || currentPath === 'portfolio.html' || currentPath === 'stock-detail.html';
    const isWorld = currentPath === 'world-news.html';
    const isAiOps = currentPath === 'ai-ops.html';
    const isConfig = currentPath === 'config.html';

    const navHTML = `
        <div class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-background-dark/95 backdrop-blur-lg border-t border-border-dark z-50">
            <nav class="flex justify-between items-center px-4 pb-5 pt-2">
                <a class="flex flex-col items-center gap-1 w-12 ${isHome ? 'text-primary' : 'text-slate-500 hover:text-primary transition-colors'}" href="index.html">
                    <span class="material-symbols-outlined ${isHome ? 'fill-icon' : ''}">home</span>
                    <p class="text-[9px] font-bold uppercase tracking-tighter">Home</p>
                </a>
                <a class="flex flex-col items-center gap-1 w-12 ${isMarkets ? 'text-primary' : 'text-slate-500 hover:text-primary transition-colors'}" href="watchlist.html">
                    <span class="material-symbols-outlined ${isMarkets ? 'fill-icon' : ''}">bar_chart</span>
                    <p class="text-[9px] font-bold uppercase tracking-tighter">Markets</p>
                </a>
                <a class="flex flex-col items-center gap-1 w-12 ${isWorld ? 'text-primary' : 'text-slate-500 hover:text-primary transition-colors'}" href="world-news.html">
                    <span class="material-symbols-outlined ${isWorld ? 'fill-icon' : ''}">public</span>
                    <p class="text-[9px] font-bold uppercase tracking-tighter">World</p>
                </a>
                <a class="flex flex-col items-center gap-1 w-12 ${isAiOps ? 'text-primary' : 'text-slate-500 hover:text-primary transition-colors'}" href="ai-ops.html">
                    <span class="material-symbols-outlined ${isAiOps ? 'fill-icon' : ''}">insights</span>
                    <p class="text-[9px] font-bold uppercase tracking-tighter">AI Ops</p>
                </a>
                <a class="flex flex-col items-center gap-1 w-12 ${isConfig ? 'text-primary' : 'text-slate-500 hover:text-primary transition-colors'}" href="config.html">
                    <span class="material-symbols-outlined ${isConfig ? 'fill-icon' : ''}">settings</span>
                    <p class="text-[9px] font-bold uppercase tracking-tighter">Config</p>
                </a>
            </nav>
        </div>
    `;

    navContainer.innerHTML = navHTML;
});