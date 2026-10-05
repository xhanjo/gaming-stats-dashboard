/**
 * Вкладка "Активність" (Activity)
 * Використовує розраховані дані від Go Backend (data.recent_form.activity)
 */

import { $ } from '../utils/dom.js';
import * as Charts from '../charts/chartManager.js';

let activeMatchCounts = {};
let scrollListenersAttached = false;
let tabObserver = null;
let resizeObserver = null;

export function renderActivityTab(data) {
    const recent = data.recent_form || {};
    const activity = recent.activity;
    if (!activity) return;

    // Header stats
    const setTxt = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    setTxt('paMatches', activity.total_matches || 0);
    setTxt('paDays', activity.unique_days_count || 0);
    setTxt('paMonth', activity.most_active_month_name || activity.current_month_name || '-');
    setTxt('paMonthMatches', activity.most_active_month_matches ?? activity.current_month_matches ?? 0);
    setTxt('paHour', activity.most_active_hour_display || '-');

    const winrateVal = activity.most_active_hour_winrate !== undefined ? activity.most_active_hour_winrate : 0;
    setTxt('paHourWinrate', `${Number(winrateVal).toFixed(1)}%`);

    setTxt('paAvgDaily', activity.avg_daily_matches || 0);

    const trendEl = $('paDailyTrend');
    if (trendEl) {
        if (activity.daily_trend_display) {
            trendEl.textContent = activity.daily_trend_display;
            trendEl.className = activity.daily_trend_direction === 'down'
                ? 'text-xs text-red-500 font-bold'
                : 'text-xs text-green-500 font-bold';
            trendEl.classList.remove('hidden');
        } else {
            trendEl.textContent = '';
            trendEl.classList.add('hidden');
        }
    }

    const weeklyVal = activity.avg_weekly_matches !== undefined ? activity.avg_weekly_matches : 0;
    setTxt('paAvgWeekly', String(Number(weeklyVal).toFixed(1)).replace('.', ','));

    // Charts
    if (activity.hourly_distribution) {
        Charts.renderHourlyChart(activity.hourly_distribution);
    }
    if (activity.daily_distribution) {
        Charts.renderDailyChart(activity.daily_distribution);
    }

    // Heatmap
    activeMatchCounts = activity.match_counts_by_date || {};
    renderHeatmap();
    initHeatmapScrollSync();
}

function renderHeatmap() {
    const wrapper = $('heatmapMonthsWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';

    const monthNames = [
        "січень", "лютий", "березень", "квітень", "травень", "червень",
        "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"
    ];
    const now = new Date();

    // Визначаємо часовий діапазон: щонайменше 8 місяців (як на FACEIT), або за наявною історією
    const dates = Object.keys(activeMatchCounts).sort();
    let totalMonths = 8;
    if (dates.length > 0) {
        const earliest = new Date(dates[0]);
        const diff = (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1;
        totalMonths = Math.max(8, Math.min(24, diff));
    }

    // Генеруємо місяці хронологічно зліва направо (від найстарішого до поточного)
    for (let i = totalMonths - 1; i >= 0; i--) {
        const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = mDate.getFullYear();
        const monthIndex = mDate.getMonth();
        const monthName = monthNames[monthIndex];

        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const firstDay = new Date(year, monthIndex, 1).getDay();
        // Понеділок = 0, Неділя = 6
        const startOffset = (firstDay + 6) % 7;

        let monthHtml = `
            <div class="flex flex-col gap-2 min-w-max select-none">
                <div class="text-[11px] md:text-xs font-bold text-gray-400 text-center">${monthName}</div>
                <div class="grid grid-rows-7 grid-flow-col gap-1 md:gap-1.5 p-2 bg-[#121215] rounded-xl border border-gray-800/60 shadow-inner">
        `;

        // Порожні дні до 1 числа місяця
        for (let j = 0; j < startOffset; j++) {
            monthHtml += `<div class="w-3.5 h-3.5 md:w-4 md:h-4 rounded-[3px] opacity-0 pointer-events-none"></div>`;
        }

        // Дні місяця
        for (let d = 1; d <= daysInMonth; d++) {
            const cellDate = new Date(year, monthIndex, d);
            const isFuture = cellDate > now;
            const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const count = activeMatchCounts[dateStr] || 0;

            if (isFuture) {
                monthHtml += `<div class="w-3.5 h-3.5 md:w-4 md:h-4 rounded-[3px] bg-[#16161a] border border-gray-800/30 opacity-20 pointer-events-none"></div>`;
                continue;
            }

            let colorClass = 'bg-[#1e1e24] border border-[#2b2b34] hover:border-gray-500';
            if (count >= 5) {
                colorClass = 'bg-[#f43f5e] border border-[#ff007f] shadow-[0_0_8px_rgba(244,63,94,0.5)]';
            } else if (count >= 3) {
                colorClass = 'bg-[#c026d3] border border-[#d946ef] shadow-[0_0_6px_rgba(192,38,211,0.4)]';
            } else if (count >= 1) {
                colorClass = 'bg-[#701a75] border border-[#86198f]';
            }

            const niceDate = cellDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
            const title = count > 0
                ? `${niceDate}: зіграно ${count} ${declOfNum(count, ['матч', 'матчі', 'матчів'])}`
                : `${niceDate}: немає ігор`;

            monthHtml += `<div class="w-3.5 h-3.5 md:w-4 md:h-4 rounded-[3px] ${colorClass} transition-all duration-150 hover:scale-125 hover:z-20 relative cursor-pointer" title="${title}"></div>`;
        }

        // Порожні дні для вирівнювання останньої колонки до 7 рядків
        const totalRendered = startOffset + daysInMonth;
        const endPadding = (7 - (totalRendered % 7)) % 7;
        for (let p = 0; p < endPadding; p++) {
            monthHtml += `<div class="w-3.5 h-3.5 md:w-4 md:h-4 rounded-[3px] opacity-0 pointer-events-none"></div>`;
        }

        monthHtml += `</div></div>`;
        wrapper.innerHTML += monthHtml;
    }
}

export function scrollToLatestMonths() {
    const container = $('heatmapScrollContainer');
    const slider = $('heatmapScrollSlider');
    if (!container) return;

    // Подвійний rAF гарантує, що браузер завершив перерахунок геометрії після зняття hidden
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const maxScroll = container.scrollWidth - container.clientWidth;
            if (maxScroll > 0) {
                container.scrollLeft = maxScroll;
                if (slider) slider.value = 1000;
            }
        });
    });
}

function initHeatmapScrollSync() {
    const container = $('heatmapScrollContainer');
    const slider = $('heatmapScrollSlider');
    if (!container || !slider) return;

    scrollToLatestMonths();

    // IntersectionObserver спрацьовує коли вкладка стає видимою користувачеві
    if (tabObserver) {
        tabObserver.disconnect();
    }
    if (typeof IntersectionObserver !== 'undefined') {
        tabObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting && entry.intersectionRatio > 0) {
                    scrollToLatestMonths();
                }
            }
        }, { threshold: 0.05 });
        tabObserver.observe(container);
    }

    // ResizeObserver спрацьовує коли контейнер отримує реальну ширину
    if (resizeObserver) {
        resizeObserver.disconnect();
    }
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    const maxScroll = container.scrollWidth - container.clientWidth;
                    if (maxScroll > 0 && container.scrollLeft === 0 && slider && slider.value === '1000') {
                        container.scrollLeft = maxScroll;
                    }
                }
            }
        });
        resizeObserver.observe(container);
    }

    if (!scrollListenersAttached) {
        scrollListenersAttached = true;

        // Слухаємо перемикання вкладок
        window.addEventListener('tab-switched', (e) => {
            if (e.detail && e.detail.tabId === 'tab-activity') {
                scrollToLatestMonths();
            }
        });

        // Синхронізація при русі слайдера
        slider.addEventListener('input', (e) => {
            const maxScroll = container.scrollWidth - container.clientWidth;
            if (maxScroll > 0) {
                const ratio = parseFloat(e.target.value) / 1000;
                container.scrollLeft = ratio * maxScroll;
            }
        });

        // Синхронізація при скролі контейнера (тач, трекпад, коліщатко)
        container.addEventListener('scroll', () => {
            const maxScroll = container.scrollWidth - container.clientWidth;
            if (maxScroll > 0) {
                const ratio = container.scrollLeft / maxScroll;
                slider.value = Math.round(ratio * 1000);
            }
        });

        // Плавний drag-to-scroll мишею по самому контейнеру теплової карти
        let isDown = false;
        let startX = 0;
        let startScrollLeft = 0;

        container.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - container.offsetLeft;
            startScrollLeft = container.scrollLeft;
        });

        window.addEventListener('mouseup', () => {
            isDown = false;
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 1.5;
            container.scrollLeft = startScrollLeft - walk;
        });

        window.addEventListener('resize', () => {
            const maxScroll = container.scrollWidth - container.clientWidth;
            if (maxScroll > 0) {
                const ratio = parseFloat(slider.value) / 1000;
                container.scrollLeft = ratio * maxScroll;
            }
        });
    }
}

function declOfNum(n, titles) {
    const cases = [2, 0, 1, 1, 1, 2];
    return titles[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[(n % 10 < 5) ? n % 10 : 5]];
}
