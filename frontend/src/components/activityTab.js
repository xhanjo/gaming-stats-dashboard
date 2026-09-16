/**
 * Вкладка "Активність" (Activity)
 * Використовує готові розраховані дані від Go Backend (data.recent_form.activity)
 */

import { $ } from '../utils/dom.js';
import * as Charts from '../charts/chartManager.js';

export function renderActivityTab(data) {
    const recent = data.recent_form || {};
    const activity = recent.activity;
    if (!activity) return;

    // Header stats
    const setTxt = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    setTxt('paMatches', activity.total_matches || 0);
    setTxt('paDays', activity.unique_days_count || 0);
    setTxt('paMonth', activity.current_month_name || '-');
    setTxt('paMonthMatches', activity.current_month_matches || 0);
    setTxt('paHour', activity.most_active_hour_display || '-');
    setTxt('paHourWinrate', (activity.most_active_hour_winrate || 0) + '%');
    setTxt('paAvgDaily', activity.avg_daily_matches || 0);
    setTxt('paAvgWeekly', activity.avg_weekly_matches || 0);

    // Charts
    if (activity.hourly_distribution) {
        Charts.renderHourlyChart(activity.hourly_distribution);
    }
    if (activity.daily_distribution) {
        Charts.renderDailyChart(activity.daily_distribution);
    }

    // Heatmap
    renderHeatmap(activity.match_counts_by_date || {});
}

function renderHeatmap(matchCountsByDate) {
    const heatmapGrid = $('heatmapGrid');
    if (!heatmapGrid) return;
    heatmapGrid.innerHTML = '';

    const monthNames = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
        let mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        let year = mDate.getFullYear();
        let monthIndex = mDate.getMonth();
        let monthName = monthNames[monthIndex];

        let daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

        let firstDayIndex = new Date(year, monthIndex, 1).getDay();
        let offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

        let monthHtml = `
            <div class="flex flex-col gap-1.5 flex-1 min-w-[110px] md:min-w-0">
                <div class="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider">${monthName}</div>
                <div class="grid grid-cols-7 gap-1 md:gap-1.5 bg-gray-900/40 p-2 md:p-2.5 rounded-lg border border-gray-800/60">
        `;

        for (let j = 0; j < offset; j++) {
            monthHtml += `<div class="w-3 h-3 md:w-3.5 md:h-3.5 rounded-sm opacity-0 pointer-events-none"></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            let cellDate = new Date(year, monthIndex, d);

            if (cellDate > now) {
                monthHtml += `<div class="w-3 h-3 md:w-3.5 md:h-3.5 rounded-sm bg-[#18181b] border border-gray-800/50 opacity-40 pointer-events-none"></div>`;
                continue;
            }

            let dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            let count = matchCountsByDate[dateStr] || 0;

            let colorClass = 'bg-[#18181b] border border-gray-800/50';
            if (count >= 5) colorClass = 'bg-[#d946ef]';
            else if (count >= 3) colorClass = 'bg-[#a21caf]';
            else if (count >= 1) colorClass = 'bg-[#6b21a8]';

            let niceDate = cellDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
            let title = count > 0 ? `${niceDate}: ігор — ${count}` : `${niceDate}: немає ігор`;

            monthHtml += `<div class="w-3 h-3 md:w-3.5 md:h-3.5 rounded-sm ${colorClass} transition-all hover:scale-125 hover:z-10 relative cursor-crosshair" title="${title}"></div>`;
        }

        monthHtml += `</div></div>`;
        heatmapGrid.innerHTML += monthHtml;
    }
}
